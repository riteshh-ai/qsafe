const { containerBootstrap } = require('@nlpjs/core');
const { Nlp } = require('@nlpjs/nlp');
const { Language } = require('@nlpjs/language-min');
const fs = require('fs');
const path = require('path');

function parseCsv(csvText) {
    const rows = [];
    let current = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i += 1) {
        const ch = csvText[i];

        if (inQuotes) {
            if (ch === '"') {
                if (csvText[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            current.push(field);
            field = '';
        } else if (ch === '\r') {
            continue;
        } else if (ch === '\n') {
            current.push(field);
            rows.push(current);
            current = [];
            field = '';
        } else {
            field += ch;
        }
    }

    if (field.length > 0 || current.length > 0) {
        current.push(field);
        rows.push(current);
    }

    return rows;
}

function detectLocale(text) {
    return /[\u0900-\u097F]/.test(text) ? 'ne' : 'en';
}

async function evaluateModel() {
    console.log('🔍 Loading offline model...');

    const modelPath = path.join(__dirname, 'model.nlp.json');
    if (!fs.existsSync(modelPath)) {
        console.error('❌ Model file not found:', modelPath);
        process.exit(1);
    }

    const modelJson = fs.readFileSync(modelPath, 'utf8');
    const modelData = JSON.parse(modelJson);

    const container = await containerBootstrap();
    container.use(Nlp);
    container.use(Language);

    const nlp = container.get('nlp');
    nlp.settings.autoSave = false;
    nlp.settings.autoLoad = false;
    nlp.fromJSON(modelData);

    const csvPath = path.join(__dirname, 'datasets', 'training_dataset.csv');
    if (!fs.existsSync(csvPath)) {
        throw new Error(`Missing dataset: ${csvPath}`);
    }

    const csvText = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCsv(csvText);
    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const textIndex = header.indexOf('text');
    const intentIndex = header.indexOf('intent');
    const splitIndex = header.indexOf('split');

    if (textIndex < 0 || intentIndex < 0 || splitIndex < 0) {
        throw new Error('training_dataset.csv must include text, intent, and split columns');
    }

    const validationRows = rows.slice(1).filter((row) => {
        if (!row || row.length <= Math.max(textIndex, intentIndex, splitIndex)) {
            return false;
        }
        return row[splitIndex].trim().toLowerCase() === 'validation';
    });

    if (validationRows.length === 0) {
        throw new Error('No validation rows found in training_dataset.csv');
    }

    let correct = 0;
    let total = 0;
    const results = [];

    for (const row of validationRows) {
        const text = row[textIndex].trim();
        const expected = row[intentIndex].trim();
        const locale = detectLocale(text);
        const response = await nlp.process(locale, text);
        const predicted = response.intent;
        const score = response.score || 0;
        total += 1;
        if (predicted === expected) {
            correct += 1;
        }
        results.push({ text, expected, predicted, score });
    }

    const accuracy = total ? (correct / total) * 100 : 0;
    console.log(`✅ Validation accuracy: ${accuracy.toFixed(2)}% (${correct}/${total})`);
    console.log('---');
    console.log('Top 10 low-confidence / misclassified validation examples:');

    results.sort((a, b) => a.score - b.score || a.expected.localeCompare(b.expected));
    const sample = results.slice(0, 10);
    sample.forEach((item, index) => {
        console.log(`${index + 1}. [${item.score.toFixed(4)}] expected=${item.expected} predicted=${item.predicted}`);
        console.log(`   ${item.text}`);
    });
}

evaluateModel().catch((err) => {
    console.error('❌ Evaluation failed:', err);
    process.exit(1);
});
