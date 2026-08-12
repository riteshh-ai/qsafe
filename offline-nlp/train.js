const { containerBootstrap } = require('@nlpjs/core');
const { Nlp } = require('@nlpjs/nlp');
const { Language } = require('@nlpjs/language-min');
const fs = require('fs');
const path = require('path');

async function compileOfflineModel() {
    console.log("🔄 Initializing local NLP model training...");

    const container = await containerBootstrap();
    container.use(Nlp);
    container.use(Language);

    const nlp = container.get('nlp');
    nlp.settings.autoSave = false;
    nlp.settings.autoLoad = false;
    nlp.addLanguage(['en', 'ne']);

    // Read local bilingual training corpus
    const corpusPath = path.join(__dirname, 'corpus.json');
    const corpusData = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

    // Feed dataset arrays to training manager
    await nlp.addCorpus(corpusData);

    console.log("🧠 Executing classification neural training...");
    await nlp.train();

    // Export model calculation weights mapping
    const modelJson = nlp.export(true);

    // Save directly into your frontend public asset pipeline
    const outputPath = path.join(__dirname, '../frontend/public/model.nlp.json');

    // Ensure parent directory fallback protection exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, modelJson, 'utf8');
    fs.writeFileSync(path.join(__dirname, 'model.nlp.json'), modelJson, 'utf8');
    console.log(`✅ Success! Offline model saved to: ${outputPath}`);
    console.log(`✅ Also saved local copy to: ${path.join(__dirname, 'model.nlp.json')}`);
}

compileOfflineModel().catch(err => {
    console.error("❌ Training failure:", err);
    process.exit(1);
});