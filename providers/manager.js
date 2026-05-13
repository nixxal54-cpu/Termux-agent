import { GroqProvider } from './groq.js';
import { GeminiProvider } from './gemini.js';
import chalk from 'chalk';

export class ProviderManager {
    constructor(config) {
        this.config = config;
        this.providerInstance = null;
        this.switchProvider(config.provider, config.model, false);
    }

    switchProvider(providerName, modelName, showLog = true) {
        this.config.provider = providerName;
        this.config.model = modelName;

        if (providerName === 'gemini') {
            this.providerInstance = new GeminiProvider({ model: modelName });
        } else if (providerName === 'groq') {
            this.providerInstance = new GroqProvider({ model: modelName });
        } else {
            throw new Error(`Unknown provider: ${providerName}. Valid options: groq, gemini`);
        }

        if (showLog) {
            console.log(chalk.green(`\n[+] AI Link Established: ${providerName.toUpperCase()} [${modelName}]`));
        }
    }

    getModel() {
        return this.providerInstance?.getModel?.() ?? this.config.model;
    }

    setModel(modelId) {
        this.providerInstance?.setModel?.(modelId);
        this.config.model = modelId;
    }

    async generateResponse(messages) {
        if (!this.providerInstance) {
            throw new Error("No AI Provider initialized.");
        }
        return await this.providerInstance.generateResponse(messages);
    }
}