import OpenAI from 'openai';
import dotenv from 'dotenv';
import { bus, EVENTS } from '../core/event_bus.js';
import { withRetries } from '../core/retries.js';

dotenv.config();

// Models known to support response_format: json_object on Groq
const JSON_MODE_SUPPORTED = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'gemma-7b-it',
];

export class GroqProvider {
  constructor(config = {}) {
    this.client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || 'no-key-provided',
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.model = config.model || 'llama-3.3-70b-versatile';
    this.temperature = config.temperature || 0.1;
    this.maxTokens = config.maxTokens || 4096;
  }

  setModel(modelId) {
    this.model = modelId;
    const supported = JSON_MODE_SUPPORTED.includes(modelId);
    if (!supported) {
      process.stderr.write(`[Provider] Warning: ${modelId} may not support json_object mode. Will try without it.\n`);
    }
  }

  getModel() {
    return this.model;
  }

  supportsJsonMode() {
    return JSON_MODE_SUPPORTED.includes(this.model);
  }

  async generate(messages) {
    return await withRetries(async () => {
      try {
        const requestParams = {
          model: this.model,
          messages: messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        };

        // Only add json_object mode for models that support it
        if (this.supportsJsonMode()) {
          requestParams.response_format = { type: 'json_object' };
        }

        const response = await this.client.chat.completions.create(requestParams);

        const usage = response.usage;
        if (usage) {
          bus.emit(EVENTS.TOKEN_USAGE, usage);
        }

        return response.choices[0].message.content;
      } catch (error) {
        if (error.status === 401) {
          throw new Error('Unauthorized: Invalid API Key.'); // Don't retry 401
        }
        if (error.status === 400) {
          throw new Error(`Bad Request (400): ${error.message} — Try switching to a supported model with /modelchange`);
        }
        if (error.status === 413) {
          throw new Error(`Context too large (413): history is too long for this model's token limit. Type /clear to reset memory and try again.`);
        }
        throw error;
      }
    }, 3, 1000);
  }
}