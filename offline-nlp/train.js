const { NlpManager } = require('@nlpjs/nlp');
const fs = require('fs');

async function trainOfflineNLP() {
  const manager = new NlpManager({ 
    languages: ['en', 'ne'], 
    forceNER: true, // Crucial: forces Named Entity Recognition to run
    autoSave: false 
  });

  console.log('⏳ Parsing 8-Intent Data Corpus...');
  const corpusData = JSON.parse(fs.readFileSync('./corpus.json', 'utf8'));
  
  // 1. Hydrate documents with intents
  corpusData.data.forEach(item => {
    item.utterances.forEach(utterance => {
      manager.addDocument('en', utterance, item.intent);
      manager.addDocument('ne', utterance, item.intent);
    });
  });

  // 2. DEFINE OFFLINE ENTITIES (NER)
  // Define a 'location' entity with regex rules for prominent cities/places in Nepal
  manager.addRegexRule('en', 'location', /Kathmandu|Lalitpur|Bhaktapur|Pokhara|Lalitpur|Gorkha/gi);
  manager.addRegexRule('ne', 'location', /काठमाडौं|ललितपुर|भक्तपुर|पोखरा|गोरखा/gi);

  // Define a 'damage_target' entity to know what structural element is affected
  manager.addNamedEntityText('en', 'damage_target', 'house', ['house', 'home', 'building', 'apartment']);
  manager.addNamedEntityText('en', 'damage_target', 'wall', ['wall', 'pillar', 'ceiling', 'roof']);
  manager.addNamedEntityText('ne', 'damage_target', 'घर', ['घर', 'भवन', 'कोठा']);
  manager.addNamedEntityText('ne', 'damage_target', 'भित्ता', ['भित्ता', 'खम्बा', 'पिलर', 'गारो']);

  console.log('🤖 Training Classifier & NER Extraction Rules...');
  await manager.train();
  
  console.log('💾 Compiling standalone binary to "model.nlp"...');
  manager.save('./model.nlp');
  console.log('✅ Model generated successfully with NER support!');
}

trainOfflineNLP().catch(err => console.error('❌ Training Pipeline Error:', err));