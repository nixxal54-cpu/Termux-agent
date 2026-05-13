import OpenAI from 'openai';
import dotenv from 'dotenv';
import { bus, EVENTS } from '../core/event_bus.js';
import { withRetries } from '../core/retries.js';

dotenv.config();

// Free-tier Gemini models available via Google AI Studio (no billing required)
export const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash',            label: 'Gemini 2.0 Flash         (fast, smart, free)' },
  { id: 'gemini-2.0-flash-lite',       label: 'Gemini 2.0 Flash Lite    (lightest, fastest, free)' },
  { id: 'gemini-1.5-flash',            label: 'Gemini 1.5 Flash         (stable, 1M ctx, free)' },
  { id: 'gemini-1.5-flash-8b',         label: 'Gemini 1.5 Flash-8B      (smallest, free)' },
  { id: 'gemini-1.5-pro',              label: 'Gemini 1.5 Pro           (most capable, free tier limited)' },
];

// Models that reliably support JSON mode on Gemini OpenAI-compat endpoint
const JSON_MODE_SUPPORTED = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

export class GeminiProvider {
  constructor(config = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not set.\n' +
        'Get a free key at: https://aistudio.google.com/app/apikey\n' +
        'Then add it to your .env file:  GEMINI_API_KEY="your-key-here"'
      );
    }

    // Google exposes a Gemini OpenAI-compatible endpoint
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });

    this.model = config.model || 'gemini-2.0-flash';
    this.temperature = config.temperature ?? 0.1;
    this.maxTokens = config.maxTokens || 4096;
  }

  setModel(modelId) {
    this.model = modelId;
    const supported = JSON_MODE_SUPPORTED.includes(modelId);
    if (!supported) {
      process.stderr.write(
        `[GeminiProvider] Warning: ${modelId} may not support json_object mode. Will try without it.\n`
      );
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
          messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        };

        if (this.supportsJsonMode()) {
          requestParams.response_format = { type: 'json_object' };
        }

        const response = await this.client.chat.completions.create(requestParams);

        const usage = response.usage;
        if (usage) bus.emit(EVENTS.TOKEN_USAGE, usage);

        return response.choices[0].message.content;
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          throw new Error('Gemini: Invalid or missing API key. Check GEMINI_API_KEY in your .env');
        }
        if (error.status === 400) {
          throw new Error(
            `Gemini Bad Request (400): ${error.message} — Try /modelchange to switch model`
          );
        }
        if (error.status === 429) {
          throw new Error(
            'Gemini rate limit hit (429). Free tier allows 15 RPM / 1500 RPD. Wait a moment and retry.'
          );
        }
        if (error.status === 413) {
          throw new Error(
            'Gemini: Context too large. Type /clear to reset memory and try again.'
          );
        }
        throw error;
      }
    }, 3, 1500);
  }
}