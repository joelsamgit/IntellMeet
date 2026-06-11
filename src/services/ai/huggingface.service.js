import { HfInference } from '@huggingface/inference';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      console.warn('HUGGINGFACE_API_KEY not set — HuggingFace features will be unavailable');
      return null;
    }
    client = new HfInference(apiKey);
  }
  return client;
}

/**
 * Analyze sentiment of text using DistilBERT.
 * @param {string} text - Text to analyze
 * @returns {Promise<{label: string, score: number}>}
 */
export async function analyzeSentiment(text) {
  const hf = getClient();
  if (!hf) {
    return { label: 'NEUTRAL', score: 0.5 };
  }

  try {
    const result = await hf.textClassification({
      model: 'distilbert-base-uncased-finetuned-sst-2-english',
      inputs: text.slice(0, 5000),
    });

    if (Array.isArray(result) && result.length > 0) {
      return { label: result[0].label, score: result[0].score };
    }
    return { label: 'NEUTRAL', score: 0.5 };
  } catch (err) {
    console.error('HuggingFace sentiment analysis error:', err.message);
    return { label: 'NEUTRAL', score: 0.5 };
  }
}

/**
 * Summarize text using a HuggingFace summarization model.
 * @param {string} text - Text to summarize
 * @returns {Promise<string>}
 */
export async function summarizeText(text) {
  const hf = getClient();
  if (!hf) return '';

  try {
    const result = await hf.summarization({
      model: 'facebook/bart-large-cnn',
      inputs: text.slice(0, 4000),
      parameters: {
        max_length: 250,
        min_length: 50,
      },
    });
    return result.summary_text || '';
  } catch (err) {
    console.error('HuggingFace summarization error:', err.message);
    return '';
  }
}

/**
 * Run generic inference on any HuggingFace model.
 * @param {string} model - Model ID
 * @param {*} inputs - Model inputs
 * @param {string} task - Task type
 * @returns {Promise<*>}
 */
export async function runInference(model, inputs, task = 'text-classification') {
  const hf = getClient();
  if (!hf) return null;

  try {
    switch (task) {
      case 'text-classification':
        return await hf.textClassification({ model, inputs });
      case 'summarization':
        return await hf.summarization({ model, inputs });
      case 'token-classification':
        return await hf.tokenClassification({ model, inputs });
      default:
        console.warn(`Unsupported task: ${task}`);
        return null;
    }
  } catch (err) {
    console.error(`HuggingFace inference error (${model}):`, err.message);
    return null;
  }
}
