// ============================================================
// Provider & Model type definitions
// ============================================================

export type ProviderType =
    | 'openai' | 'anthropic' | 'deepseek' | 'kimi'
    | 'qwen' | 'minimax' | 'zlm' | 'openrouter'
    | 'xai' | 'gemini';

export interface ProviderDef {
    id: ProviderType;
    name: string;
    defaultBaseUrl: string;
    apiFormat: 'openai' | 'anthropic';
    apiKeyUrl?: string;
}

export interface ModelConfig {
    id: string;              // unique key, e.g. "openai:gpt-4o"
    name: string;            // model name sent to API
    displayName: string;     // shown in UI
    provider: ProviderType;
    enabled: boolean;
    isBuiltin: boolean;
    customBaseUrl?: string;  // override provider base URL
    customApiKey?: string;   // override provider API key
    customPrompt?: string;   // custom system prompt (empty = use default)
    noSystemRole?: boolean;  // merge system prompt into user message (for APIs that don't support system role)
}

export interface ProviderConfig {
    apiKey: string;
    baseUrl: string;
}

export interface TranslationRecord {
    id: string;
    originalText: string;
    translatedText: string;
    model: string;
    provider: string;
    timestamp: number;
}

// ============================================================
// Provider definitions
// ============================================================

export const PROVIDER_DEFS: Record<ProviderType, ProviderDef> = {
    openai: {
        id: 'openai',
        name: 'OpenAI',
        defaultBaseUrl: 'https://api.openai.com/v1',
        apiFormat: 'openai',
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        apiFormat: 'anthropic',
    },
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        defaultBaseUrl: 'https://api.deepseek.com/v1',
        apiFormat: 'openai',
    },
    kimi: {
        id: 'kimi',
        name: 'Kimi',
        defaultBaseUrl: 'https://api.moonshot.cn/v1',
        apiFormat: 'openai',
    },
    qwen: {
        id: 'qwen',
        name: 'Qwen',
        defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiFormat: 'openai',
    },
    minimax: {
        id: 'minimax',
        name: 'MiniMax',
        defaultBaseUrl: 'https://api.minimax.chat/v1',
        apiFormat: 'openai',
    },
    zlm: {
        id: 'zlm',
        name: 'ZLM',
        defaultBaseUrl: 'https://api.zhiangsci.com/v1',
        apiFormat: 'openai',
    },
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
        apiFormat: 'openai',
        apiKeyUrl: 'https://openrouter.ai/keys',
    },
    xai: {
        id: 'xai',
        name: 'XAI',
        defaultBaseUrl: 'https://api.x.ai/v1',
        apiFormat: 'openai',
    },
    gemini: {
        id: 'gemini',
        name: 'Gemini',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiFormat: 'openai',
    },
};

export const ALL_PROVIDER_TYPES: ProviderType[] = [
    'openai', 'anthropic', 'deepseek', 'kimi', 'qwen',
    'minimax', 'zlm', 'openrouter', 'xai', 'gemini',
];

// ============================================================
// Built-in models
// ============================================================

export function getBuiltinModels(): ModelConfig[] {
    return [
        // OpenAI
        { id: 'openai:gpt-4o', name: 'gpt-4o', displayName: 'GPT-4o', provider: 'openai', enabled: true, isBuiltin: true },
        { id: 'openai:gpt-4o-mini', name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', provider: 'openai', enabled: true, isBuiltin: true },
        // Anthropic
        { id: 'anthropic:claude-sonnet-4-20250514', name: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', provider: 'anthropic', enabled: true, isBuiltin: true },
        { id: 'anthropic:claude-3-7-sonnet-latest', name: 'claude-3-7-sonnet-latest', displayName: 'Claude 3.7 Sonnet', provider: 'anthropic', enabled: true, isBuiltin: true },
        // DeepSeek
        { id: 'deepseek:deepseek-chat', name: 'deepseek-chat', displayName: 'DeepSeek Chat', provider: 'deepseek', enabled: true, isBuiltin: true },
        { id: 'deepseek:deepseek-reasoner', name: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', provider: 'deepseek', enabled: false, isBuiltin: true },
        // Kimi
        { id: 'kimi:moonshot-v1-8k', name: 'moonshot-v1-8k', displayName: 'Moonshot V1 8K', provider: 'kimi', enabled: true, isBuiltin: true },
        // Qwen
        { id: 'qwen:qwen-turbo', name: 'qwen-turbo', displayName: 'Qwen Turbo', provider: 'qwen', enabled: true, isBuiltin: true },
        { id: 'qwen:qwen-plus', name: 'qwen-plus', displayName: 'Qwen Plus', provider: 'qwen', enabled: false, isBuiltin: true },
        { id: 'qwen:qwen-mt-turbo', name: 'qwen-mt-turbo', displayName: 'Qwen MT Turbo', provider: 'qwen', enabled: false, isBuiltin: true, noSystemRole: true },
        // Gemini
        { id: 'gemini:gemini-2.5-flash', name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'gemini', enabled: true, isBuiltin: true },
        // XAI
        { id: 'xai:grok-3-beta', name: 'grok-3-beta', displayName: 'Grok 3 Beta', provider: 'xai', enabled: false, isBuiltin: true },
        // OpenRouter
        { id: 'openrouter:deepseek/deepseek-r1:free', name: 'deepseek/deepseek-r1:free', displayName: 'DeepSeek R1 (Free)', provider: 'openrouter', enabled: false, isBuiltin: true },
    ];
}
