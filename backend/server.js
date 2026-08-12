const express = require('express');
const fs = require('fs');
const path = require('path');
const { containerBootstrap } = require('@nlpjs/core');
const { Nlp } = require('@nlpjs/nlp');
const { Language } = require('@nlpjs/language-min');

const app = express();
const port = process.env.PORT || 3000;

function detectLocale(text) {
  return /[\u0900-\u097F]/.test(text) ? 'ne' : 'en';
}

async function loadModel() {
  const modelPath = path.resolve(__dirname, '..', 'offline-nlp', 'model.nlp.json');
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Offline model not found at ${modelPath}`);
  }

  const modelJson = fs.readFileSync(modelPath, 'utf8');
  const modelData = JSON.parse(modelJson);

  const container = await containerBootstrap();
  container.use(Nlp);
  container.use(Language);

  const nlp = container.get('nlp');
  nlp.settings.autoSave = false;
  nlp.settings.autoLoad = false;
  nlp.addLanguage(['en', 'ne']);
  nlp.fromJSON(modelData);

  return nlp;
}

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'frontend')));

app.post('/api/classify', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Request body must include a text string.' });
    }

    if (!app.locals.nlp) {
      return res.status(503).json({ error: 'NLP model is not loaded yet.' });
    }

    const locale = detectLocale(text);
    const result = await app.locals.nlp.process(locale, text);

    return res.json({ intent: result.intent, score: result.score, locale, utterance: result.utterance });
  } catch (error) {
    console.error('Classification error:', error);
    return res.status(500).json({ error: 'Classification failed.' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

loadModel()
  .then((nlp) => {
    app.locals.nlp = nlp;
    app.listen(port, () => {
      console.log(`🚀 QSAFE backend running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to load offline NLP model:', error);
    process.exit(1);
  });
