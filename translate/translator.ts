import {
    ModelConfig, ProviderType,
    PROVIDER_DEFS, TranslationRecord,
    getBuiltinModels,
} from '../ai/providers';
import { logger } from '../utils/logger';
import { requestUrl } from 'obsidian';

// ============================================================
// Settings
// ============================================================

export interface TranslateSettings {
    models: ModelConfig[];
    defaultModel: string;
    targetLanguage: string;
    languageOptions: string[];   // e.g. ['Chinese', 'English']
    history: TranslationRecord[];
    maxHistorySize: number;
}

export function createDefaultSettings(): TranslateSettings {
    return {
        models: getBuiltinModels(),
        defaultModel: 'openai:gpt-4o',
        targetLanguage: 'Chinese',
        languageOptions: ['Chinese', 'English'],
        history: [],
        maxHistorySize: 50,
    };
}

/**
 * Migrate settings from old formats.
 */
export function migrateOldSettings(saved: any): TranslateSettings | null {
    // Old per-provider-key format
    if (saved && saved.openaiApiKey !== undefined) {
        const settings = createDefaultSettings();
        const keyMap: Record<string, string> = {
            openaiApiKey: 'openai', anthropicApiKey: 'anthropic',
            kimiApiKey: 'kimi', qwenApiKey: 'qwen',
            deepseekApiKey: 'deepseek', minimaxApiKey: 'minimax', zlmApiKey: 'zlm',
        };
        for (const [oldKey, providerId] of Object.entries(keyMap)) {
            if (saved[oldKey]) {
                for (const m of settings.models) {
                    if (m.provider === providerId && !m.customApiKey) {
                        m.customApiKey = saved[oldKey];
                    }
                }
            }
        }
        if (saved.targetLanguage) settings.targetLanguage = saved.targetLanguage;
        if (saved.defaultProvider) {
            const model = settings.models.find(m => m.provider === saved.defaultProvider && m.enabled);
            if (model) settings.defaultModel = model.id;
        }
        return settings;
    }

    // Old format with providers record
    if (saved && saved.providers !== undefined) {
        const settings = createDefaultSettings();
        // migrate API keys from providers into model customApiKey
        if (saved.providers && typeof saved.providers === 'object') {
            for (const [providerId, config] of Object.entries(saved.providers as Record<string, any>)) {
                if (config?.apiKey) {
                    const models = saved.models || settings.models;
                    for (const m of models) {
                        if (m.provider === providerId && !m.customApiKey) {
                            m.customApiKey = config.apiKey;
                        }
                    }
                }
            }
        }
        if (saved.models) settings.models = saved.models;
        if (saved.defaultModel) settings.defaultModel = saved.defaultModel;
        if (saved.targetLanguage) settings.targetLanguage = saved.targetLanguage;
        if (saved.history) settings.history = saved.history;
        // Remove old providers field
        return settings;
    }

    return null;
}

// ============================================================
// Translator
// ============================================================

export class Translator {
    settings: TranslateSettings;

    constructor(settings: TranslateSettings) {
        this.settings = settings;
    }

    updateSettings(settings: TranslateSettings): void {
        this.settings = settings;
    }

    getEnabledModels(): ModelConfig[] {
        return this.settings.models.filter(m => m.enabled);
    }

    /**
     * Translate text. Supports overriding target language.
     */
    async translate(text: string, modelId?: string, targetLang?: string): Promise<string> {
        const id = modelId || this.settings.defaultModel;
        const model = this.settings.models.find(m => m.id === id);
        if (!model) throw new Error(`Model "${id}" not found`);
        if (!model.enabled) throw new Error(`Model "${model.displayName}" is disabled`);

        const providerDef = PROVIDER_DEFS[model.provider];
        if (!providerDef) throw new Error(`Provider "${model.provider}" not found`);

        const apiKey = model.customApiKey;
        const baseUrl = (
            model.customBaseUrl || providerDef.defaultBaseUrl
        ).replace(/\/+$/, '');

        if (!apiKey) {
            throw new Error(
                `API key not configured for model "${model.displayName}". Edit the model to set an API key.`
            );
        }

        const lang = targetLang || this.settings.targetLanguage;
        logger.info(`Translating with ${model.displayName} (${providerDef.name}) -> ${lang}`);

        let translatedText: string;
        try {
            if (providerDef.apiFormat === 'anthropic') {
                translatedText = await this.callAnthropic(text, model, apiKey, baseUrl, lang);
            } else {
                translatedText = await this.callOpenAI(text, model, apiKey, baseUrl, lang);
            }
        } catch (error: any) {
            const msg = error?.message || String(error);
            logger.error(`Translation failed: ${msg}`);
            throw new Error(`Translation failed (${model.displayName}): ${msg}`);
        }

        this.addToHistory({
            id: crypto.randomUUID(),
            originalText: text,
            translatedText,
            model: model.displayName,
            provider: providerDef.name,
            timestamp: Date.now(),
        });

        return translatedText;
    }

    /**
     * Test connection with a model. Returns error message on failure, empty on success.
     */
    async testConnectionWithMessage(model: ModelConfig): Promise<string> {
        try {
            const providerDef = PROVIDER_DEFS[model.provider];
            if (!providerDef) return `Provider "${model.provider}" not found`;
            const apiKey = model.customApiKey;
            if (!apiKey) return 'API key not configured';
            const baseUrl = (model.customBaseUrl || providerDef.defaultBaseUrl).replace(/\/+$/, '');

            if (providerDef.apiFormat === 'anthropic') {
                await this.callAnthropic('Hello', model, apiKey, baseUrl, 'Chinese');
            } else {
                await this.callOpenAI('Hello', model, apiKey, baseUrl, 'Chinese');
            }
            return '';
        } catch (error: any) {
            return error?.message || String(error);
        }
    }

    // ------ OpenAI-compatible API ------

    private async callOpenAI(
        text: string, model: ModelConfig, apiKey: string, baseUrl: string, targetLang: string,
    ): Promise<string> {
        const url = `${baseUrl}/chat/completions`;

        const defaultPrompt = `You are a professional translator. Translate the following text to ${targetLang}. Only return the translation, nothing else.`;
        const systemPrompt = model.customPrompt?.trim() || defaultPrompt;

        // Some models (e.g. qwen-mt-turbo) only support user/assistant roles
        const messages = model.noSystemRole
            ? [{ role: 'user', content: `${systemPrompt}\n\n${text}` }]
            : [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
            ];

        const response = await requestUrl({
            url,
            method: 'POST',
            contentType: 'application/json',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: model.name,
                messages,
                temperature: 0.3,
            }),
            throw: false,
        });

        if (response.status !== 200) {
            const body = typeof response.json === 'object' ? JSON.stringify(response.json) : response.text;
            throw new Error(`API error ${response.status}: ${body}`);
        }

        return response.json.choices[0].message.content.trim();
    }

    // ------ Anthropic API ------

    private async callAnthropic(
        text: string, model: ModelConfig, apiKey: string, baseUrl: string, targetLang: string,
    ): Promise<string> {
        const url = `${baseUrl}/messages`;

        const defaultPrompt = `Translate the following text to ${targetLang}. Only return the translation, nothing else:\n\n${text}`;
        const userContent = model.customPrompt?.trim()
            ? `${model.customPrompt.trim()}\n\n${text}`
            : defaultPrompt;

        const response = await requestUrl({
            url,
            method: 'POST',
            contentType: 'application/json',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: model.name,
                max_tokens: 4096,
                messages: [
                    { role: 'user', content: userContent },
                ],
            }),
            throw: false,
        });

        if (response.status !== 200) {
            const body = typeof response.json === 'object' ? JSON.stringify(response.json) : response.text;
            throw new Error(`API error ${response.status}: ${body}`);
        }

        return response.json.content[0].text.trim();
    }

    // ------ History ------

    private addToHistory(record: TranslationRecord): void {
        this.settings.history.unshift(record);
        if (this.settings.history.length > this.settings.maxHistorySize) {
            this.settings.history = this.settings.history.slice(0, this.settings.maxHistorySize);
        }
    }

    getHistory(): TranslationRecord[] {
        return this.settings.history;
    }

    clearHistory(): void {
        this.settings.history = [];
    }
}
