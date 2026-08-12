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

async function compileOfflineModel() {
    console.log('🔄 Initializing offline NLP model training...');

    const container = await containerBootstrap();
    container.use(Nlp);
    container.use(Language);

    const nlp = container.get('nlp');
    nlp.settings.autoSave = false;
    nlp.settings.autoLoad = false;
    nlp.addLanguage(['en', 'ne']);

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

    let added = 0;
    for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row || row.length <= Math.max(textIndex, intentIndex, splitIndex)) {
            continue;
        }

        const text = row[textIndex].trim();
        const intent = row[intentIndex].trim();
        const split = row[splitIndex].trim().toLowerCase();

        if (!text || !intent || split !== 'train') {
            continue;
        }

        const locale = detectLocale(text);
        nlp.addDocument(locale, text, intent);
        added += 1;
    }

    if (added === 0) {
        throw new Error('No training examples were loaded from training_dataset.csv');
    }

    console.log(`🧠 Training on ${added} examples from training_dataset.csv...`);
    await nlp.train();

    const outputPath = path.join(__dirname, 'model.nlp.json');
    fs.writeFileSync(outputPath, nlp.export(true), 'utf8');
    console.log(`✅ Success! Offline model saved to: ${outputPath}`);
}

compileOfflineModel().catch((err) => {
    console.error('❌ Training failure:', err);
    process.exit(1);
});