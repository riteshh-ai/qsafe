const { containerBootstrap } = require('@nlpjs/core');
const { Nlp } = require('@nlpjs/nlp');
const { Language } = require('@nlpjs/language-min');
const fs = require('fs');
const path = require('path');

async function compileOfflineModel() {
    console.log("🔄 Initializing local NLP matrix...");
    
    // Instantiate NlpManager natively to match frontend processing architecture
    const nlp = new NlpManager({ languages: ['en', 'ne'], forceNER: true });
    
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
    console.log(`✅ Success! Local brain weights saved to: ${outputPath}`);
}

compileOfflineModel().catch(err => console.error("❌ Training failure:", err));