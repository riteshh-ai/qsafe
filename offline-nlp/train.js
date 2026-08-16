const { NlpManager } = require('@nlpjs/nlp');
const fs = require('fs');
const path = require('path');

async function compileOfflineModel() {
    console.log("🔄 Initializing local NLP matrix...");

    // Instantiate NlpManager with bilingual support
    const nlp = new NlpManager({ languages: ['en', 'ne'], forceNER: true });

    // Read local bilingual training corpus
    const corpusPath = path.join(__dirname, 'corpus.json');
    const corpusData = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

    // Feed dataset arrays to training manager
    await nlp.addCorpus(corpusData);

    console.log("🧠 Executing classification neural training...");
    await nlp.train();

    // Export model weights
    const modelJson = nlp.export(true);

    // Save model artifact locally in offline-nlp/ (not frontend)
    const outputPath = path.join(__dirname, 'model.nlp.json');
    fs.writeFileSync(outputPath, modelJson, 'utf8');
    console.log(`✅ Success! Local brain weights saved to: ${outputPath}`);
}

compileOfflineModel().catch(err => console.error("❌ Training failure:", err));