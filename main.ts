import { App, Editor, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, setIcon } from 'obsidian';
import { TranslateSettings, createDefaultSettings, migrateOldSettings, Translator } from './translate/translator';
import { TranslatePopover } from './translate/Popover';
import { ModelConfig, ProviderType, PROVIDER_DEFS, ALL_PROVIDER_TYPES, getBuiltinModels } from './ai/providers';

// ============================================================
// CSS Styles
// ============================================================

const SETTINGS_CSS = `
/* ---- Tab bar ---- */
.translate-settings .translate-tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--background-modifier-border);
    margin-bottom: 20px;
}
.translate-settings .translate-tab {
    padding: 10px 24px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
    user-select: none;
}
.translate-settings .translate-tab:hover {
    color: var(--text-normal);
}
.translate-settings .translate-tab.active {
    color: var(--interactive-accent);
    border-bottom-color: var(--interactive-accent);
}

/* ---- Model table ---- */
.translate-settings .translate-model-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}
.translate-settings .translate-model-header h3 {
    margin: 0;
    font-size: 16px;
}
.translate-settings .translate-model-actions {
    display: flex;
    gap: 8px;
}
.translate-settings .translate-btn {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--background-modifier-border);
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.translate-settings .translate-btn-primary,
.translate-modal .translate-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}
.translate-settings .translate-btn-primary:hover,
.translate-modal .translate-btn-primary:hover {
    filter: brightness(1.1);
}
.translate-settings .translate-btn-secondary,
.translate-modal .translate-btn-secondary {
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
}
.translate-settings .translate-btn-secondary:hover,
.translate-modal .translate-btn-secondary:hover {
    background: var(--background-modifier-hover);
}

.translate-settings .translate-model-table {
    width: 100%;
    border-collapse: collapse;
}
.translate-settings .translate-model-table th {
    text-align: left;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid var(--background-modifier-border);
}
.translate-settings .translate-model-table td {
    padding: 10px 14px;
    font-size: 13px;
    border-bottom: 1px solid var(--background-modifier-border);
    vertical-align: middle;
}
.translate-settings .translate-model-table tbody tr:hover td {
    background: var(--background-secondary);
}
.translate-settings .translate-provider-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}
.translate-settings .translate-model-name {
    font-weight: 500;
    color: var(--text-normal);
}
.translate-settings .translate-model-subname {
    font-size: 11px;
    color: var(--text-muted);
    margin-left: 6px;
}
.translate-settings .translate-actions-cell {
    display: flex;
    gap: 4px;
    align-items: center;
}
.translate-settings .translate-icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
}
.translate-settings .translate-icon-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}
.translate-settings .translate-icon-btn.danger:hover {
    color: var(--text-error);
}

/* ---- Section divider ---- */
.translate-settings .translate-section-title {
    margin: 24px 0 12px;
    padding-bottom: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    border-bottom: 1px solid var(--background-modifier-border);
}

/* ---- Modal ---- */
.translate-modal .translate-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
}
.translate-modal .setting-item {
    border-top: none;
    padding: 8px 0;
}
.translate-modal .translate-btn {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--background-modifier-border);
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.translate-modal .translate-btn-warning {
    background: var(--background-primary);
    color: var(--text-accent);
    border-color: var(--text-accent);
}
.translate-modal .translate-btn-warning:hover {
    background: var(--text-accent);
    color: var(--text-on-accent);
}
.translate-modal .translate-test-result {
    margin-top: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
}
.translate-modal .translate-test-success {
    background: rgba(0, 200, 0, 0.1);
    color: var(--text-success, #2d8f2d);
    border: 1px solid rgba(0, 200, 0, 0.2);
}
.translate-modal .translate-test-fail {
    background: rgba(255, 0, 0, 0.05);
    color: var(--text-error, #c33);
    border: 1px solid rgba(255, 0, 0, 0.15);
    word-break: break-word;
}
`;

// ============================================================
// Plugin
// ============================================================

export default class TranslatePlugin extends Plugin {
    settings: TranslateSettings = createDefaultSettings();
    translator!: Translator;
    popover!: TranslatePopover;

    async onload(): Promise<void> {
        console.log('AI Translate: Loading...');

        // Load & migrate settings
        const saved = await this.loadData();
        const migrated = migrateOldSettings(saved);
        if (migrated) {
            this.settings = migrated;
            await this.saveData(this.settings);
        } else if (saved && saved.models) {
            const defaults = createDefaultSettings();
            this.settings = {
                ...defaults,
                ...saved,
                models: saved.models || defaults.models,
                languageOptions: saved.languageOptions || defaults.languageOptions,
            };
        }

        this.translator = new Translator(this.settings);
        this.popover = new TranslatePopover(this.app, this.translator);

        // Right-click context menu: inject "Translate" item
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
                const sel = editor.getSelection();
                if (!sel || sel.trim().length === 0) return;

                menu.addItem((item) => {
                    item.setTitle('AI 翻译')
                        .setIcon('languages')
                        .onClick(async (evt: MouseEvent | KeyboardEvent) => {
                            const mouseEvt = evt instanceof MouseEvent ? evt : null;
                            const x = mouseEvt?.clientX ?? 200;
                            const y = mouseEvt?.clientY ?? 200;
                            await this.popover.show(x, y, sel.trim());
                        });
                });
            })
        );

        // Command (hotkey)
        this.addCommand({
            id: 'translate-selection',
            name: 'Translate selected text',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 't' }],
            editorCallback: async (editor: Editor) => {
                const sel = editor.getSelection();
                if (sel && sel.trim().length > 0) {
                    // Show near center of viewport
                    await this.popover.show(
                        window.innerWidth / 2 - 150,
                        window.innerHeight / 3,
                        sel.trim(),
                    );
                }
            },
        });

        // Ribbon icon
        this.addRibbonIcon('languages', 'AI Translate', async () => {
            const active = this.app.workspace.activeEditor;
            if (active?.editor) {
                const sel = active.editor.getSelection();
                if (sel && sel.trim().length > 0) {
                    await this.popover.show(
                        window.innerWidth / 2 - 150,
                        window.innerHeight / 3,
                        sel.trim(),
                    );
                }
            }
        });

        // Settings tab
        this.addSettingTab(new TranslateSettingsTab(this.app, this));

        console.log('AI Translate: Loaded');
    }

    onunload(): void {
        this.popover?.close();
    }
}

// ============================================================
// Settings Tab (tabbed interface)
// ============================================================

class TranslateSettingsTab extends PluginSettingTab {
    plugin: TranslatePlugin;
    activeTab: 'basic' | 'models' = 'basic';
    private styleEl: HTMLStyleElement | null = null;

    constructor(app: App, plugin: TranslatePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('translate-settings');

        // Inject CSS once
        if (!this.styleEl) {
            this.styleEl = document.createElement('style');
            this.styleEl.textContent = SETTINGS_CSS;
            document.head.appendChild(this.styleEl);
        }

        // Title
        containerEl.createEl('h2', { text: 'AI Translate' });

        // Tab bar
        const tabBar = containerEl.createDiv({ cls: 'translate-tab-bar' });
        const basicTab = tabBar.createEl('div', {
            cls: `translate-tab${this.activeTab === 'basic' ? ' active' : ''}`,
            text: '基础配置',
        });
        const modelsTab = tabBar.createEl('div', {
            cls: `translate-tab${this.activeTab === 'models' ? ' active' : ''}`,
            text: '模型配置',
        });

        basicTab.onclick = () => { this.activeTab = 'basic'; this.display(); };
        modelsTab.onclick = () => { this.activeTab = 'models'; this.display(); };

        // Content
        const content = containerEl.createDiv({ cls: 'translate-tab-content' });
        if (this.activeTab === 'basic') {
            this.renderBasicSettings(content);
        } else {
            this.renderModelSettings(content);
        }
    }

    hide(): void {
        if (this.styleEl) {
            this.styleEl.remove();
            this.styleEl = null;
        }
    }

    // ------------------------------------------------------------------
    // Basic Settings Tab
    // ------------------------------------------------------------------

    private renderBasicSettings(container: HTMLElement): void {
        const s = this.plugin.settings;

        // Default Model
        new Setting(container)
            .setName('默认模型')
            .setDesc('翻译时默认使用的模型')
            .addDropdown(d => {
                const enabled = s.models.filter(m => m.enabled);
                for (const m of enabled) {
                    d.addOption(m.id, `${m.displayName}  (${PROVIDER_DEFS[m.provider]?.name || m.provider})`);
                }
                d.setValue(s.defaultModel).onChange(async v => {
                    s.defaultModel = v;
                    await this.save();
                });
            });

        // Target Language
        new Setting(container)
            .setName('默认目标语言')
            .setDesc('翻译弹窗的默认目标语言')
            .addText(t => {
                t.setValue(s.targetLanguage).onChange(async v => {
                    s.targetLanguage = v;
                    await this.save();
                });
            });

        // Language options
        new Setting(container)
            .setName('语言选项')
            .setDesc('弹窗中可切换的语言列表（逗号分隔）')
            .addText(t => {
                t.setValue(s.languageOptions.join(', ')).onChange(async v => {
                    const langs = v.split(',').map(l => l.trim()).filter(l => l.length > 0);
                    if (langs.length > 0) {
                        s.languageOptions = langs;
                        await this.save();
                    }
                });
                t.inputEl.style.width = '240px';
            });
    }

    // ------------------------------------------------------------------
    // Model Settings Tab
    // ------------------------------------------------------------------

    private renderModelSettings(container: HTMLElement): void {
        // Header
        const header = container.createDiv({ cls: 'translate-model-header' });
        header.createEl('h3', { text: 'Chat Models' });

        const actions = header.createDiv({ cls: 'translate-model-actions' });

        // Refresh Built-ins
        const refreshBtn = actions.createEl('button', { cls: 'translate-btn translate-btn-secondary' });
        setIcon(refreshBtn.createSpan(), 'refresh-cw');
        refreshBtn.appendText(' Refresh Built-ins');
        refreshBtn.onclick = () => this.refreshBuiltins();

        // Add Model
        const addBtn = actions.createEl('button', { cls: 'translate-btn translate-btn-primary' });
        addBtn.appendText('+ Add Model');
        addBtn.onclick = () => {
            new ModelModal(this.app, this.plugin.translator, (model) => {
                this.plugin.settings.models.push(model);
                this.save();
                this.display();
            }).open();
        };

        // Table
        const table = container.createEl('table', { cls: 'translate-model-table' });

        // Thead
        const thead = table.createEl('thead');
        const headRow = thead.createEl('tr');
        headRow.createEl('th', { text: 'Model' });
        headRow.createEl('th', { text: 'Provider' });
        headRow.createEl('th', { text: 'Enable' });
        headRow.createEl('th', { text: 'Actions' });

        // Tbody
        const tbody = table.createEl('tbody');
        const models = this.plugin.settings.models;

        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            const row = tbody.createEl('tr');

            // Model name
            const nameCell = row.createEl('td');
            nameCell.createSpan({ cls: 'translate-model-name', text: model.name });
            if (model.displayName && model.displayName !== model.name) {
                nameCell.createSpan({ cls: 'translate-model-subname', text: `(${model.displayName})` });
            }

            // Provider badge
            const providerCell = row.createEl('td');
            const providerName = PROVIDER_DEFS[model.provider]?.name || model.provider;
            providerCell.createSpan({ cls: 'translate-provider-badge', text: providerName });

            // Enable toggle
            const enableCell = row.createEl('td');
            const toggle = enableCell.createDiv({ cls: `checkbox-container${model.enabled ? ' is-enabled' : ''}` });
            const input = toggle.createEl('input', { type: 'checkbox' });
            input.checked = model.enabled;
            input.tabIndex = 0;
            toggle.addEventListener('click', async () => {
                model.enabled = !model.enabled;
                input.checked = model.enabled;
                toggle.toggleClass('is-enabled', model.enabled);
                await this.save();
            });

            // Actions
            const actionsCell = row.createEl('td');
            const actionsDiv = actionsCell.createDiv({ cls: 'translate-actions-cell' });

            // Edit button
            const editBtn = actionsDiv.createEl('button', { cls: 'translate-icon-btn', attr: { 'aria-label': 'Edit' } });
            setIcon(editBtn, 'pencil');
            editBtn.onclick = () => {
                new ModelModal(this.app, this.plugin.translator, (updated) => {
                    Object.assign(models[i], updated);
                    this.save();
                    this.display();
                }, model).open();
            };

            // Delete button
            const delBtn = actionsDiv.createEl('button', { cls: 'translate-icon-btn danger', attr: { 'aria-label': 'Delete' } });
            setIcon(delBtn, 'trash-2');
            delBtn.onclick = async () => {
                models.splice(i, 1);
                if (this.plugin.settings.defaultModel === model.id) {
                    const first = models.find(m => m.enabled);
                    this.plugin.settings.defaultModel = first?.id || '';
                }
                await this.save();
                this.display();
            };
        }

        if (models.length === 0) {
            const emptyRow = tbody.createEl('tr');
            const emptyCell = emptyRow.createEl('td', { text: 'No models configured. Click "Refresh Built-ins" to add default models.' });
            emptyCell.colSpan = 4;
            emptyCell.style.textAlign = 'center';
            emptyCell.style.color = 'var(--text-muted)';
            emptyCell.style.padding = '24px';
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private async save(): Promise<void> {
        this.plugin.translator.updateSettings(this.plugin.settings);
        await this.plugin.saveData(this.plugin.settings);
    }

    private refreshBuiltins(): void {
        const builtins = getBuiltinModels();
        const existingIds = new Set(this.plugin.settings.models.map(m => m.id));

        let added = 0;
        for (const b of builtins) {
            if (!existingIds.has(b.id)) {
                this.plugin.settings.models.push(b);
                added++;
            }
        }

        this.save();
        this.display();
        new Notice(added > 0 ? `Added ${added} built-in model(s)` : 'All built-in models already present');
    }
}

// ============================================================
// Add / Edit Model Modal
// ============================================================

class ModelModal extends Modal {
    private data: Partial<ModelConfig>;
    private isEdit: boolean;
    private onSave: (model: ModelConfig) => void;
    private translator: Translator;
    private testResultEl: HTMLElement | null = null;

    constructor(app: App, translator: Translator, onSave: (model: ModelConfig) => void, existingModel?: ModelConfig) {
        super(app);
        this.translator = translator;
        this.onSave = onSave;
        this.isEdit = !!existingModel;
        this.data = existingModel
            ? { ...existingModel }
            : {
                name: '', displayName: '', provider: 'openai' as ProviderType,
                enabled: true, isBuiltin: false, customPrompt: '',
            };
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('translate-modal');

        // Inject styles if missing
        if (!document.querySelector('style[data-translate-modal]')) {
            const style = document.createElement('style');
            style.setAttribute('data-translate-modal', '');
            style.textContent = SETTINGS_CSS;
            document.head.appendChild(style);
        }

        contentEl.createEl('h2', { text: this.isEdit ? '编辑模型' : '添加自定义模型' });
        contentEl.createEl('p', {
            text: this.isEdit ? '修改模型配置' : '添加一个新的模型到列表中',
            cls: 'setting-item-description',
        });

        // Model Name
        new Setting(contentEl)
            .setName('Model Name *')
            .setDesc('发送到 API 的模型标识符')
            .addText(t => {
                t.setPlaceholder('e.g. gpt-4o')
                    .setValue(this.data.name || '')
                    .onChange(v => { this.data.name = v; });
                t.inputEl.style.width = '100%';
            });

        // Display Name
        new Setting(contentEl)
            .setName('Display Name')
            .setDesc('在界面中显示的名称（可选）')
            .addText(t => {
                t.setPlaceholder('Custom display name (optional)')
                    .setValue(this.data.displayName || '')
                    .onChange(v => { this.data.displayName = v; });
                t.inputEl.style.width = '100%';
            });

        // Provider
        new Setting(contentEl)
            .setName('Provider')
            .addDropdown(d => {
                for (const p of ALL_PROVIDER_TYPES) {
                    d.addOption(p, PROVIDER_DEFS[p].name);
                }
                d.setValue(this.data.provider || 'openai')
                    .onChange(v => {
                        this.data.provider = v as ProviderType;
                    });
            });

        // Base URL
        new Setting(contentEl)
            .setName('Base URL')
            .setDesc('留空则使用 Provider 默认地址')
            .addText(t => {
                t.setPlaceholder(PROVIDER_DEFS[this.data.provider || 'openai'].defaultBaseUrl)
                    .setValue(this.data.customBaseUrl || '')
                    .onChange(v => { this.data.customBaseUrl = v; });
                t.inputEl.style.width = '100%';
            });

        // API Key
        new Setting(contentEl)
            .setName('API Key *')
            .setDesc('此模型使用的 API Key')
            .addText(t => {
                t.setPlaceholder('Enter API Key')
                    .setValue(this.data.customApiKey || '')
                    .onChange(v => { this.data.customApiKey = v; });
                t.inputEl.type = 'password';
                t.inputEl.style.width = '100%';
            });

        // Custom Prompt
        new Setting(contentEl)
            .setName('自定义提示词')
            .setDesc('留空则使用默认翻译提示词。可包含 {targetLanguage} 占位符。');

        const promptTextarea = contentEl.createEl('textarea');
        promptTextarea.style.cssText = `
            width: 100%; min-height: 80px; padding: 8px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px; font-size: 13px; resize: vertical;
            background: var(--background-primary);
            color: var(--text-normal);
            font-family: inherit;
        `;
        promptTextarea.placeholder = 'e.g. You are a professional translator. Translate to {targetLanguage}. Only return the translation.';
        promptTextarea.value = this.data.customPrompt || '';
        promptTextarea.addEventListener('input', () => {
            this.data.customPrompt = promptTextarea.value;
        });

        // No System Role toggle
        new Setting(contentEl)
            .setName('禁用 System Role')
            .setDesc('部分模型（如 qwen-mt-turbo）不支持 system 角色，开启后将系统提示合并到 user 消息中')
            .addToggle(t => {
                t.setValue(!!this.data.noSystemRole)
                    .onChange(v => { this.data.noSystemRole = v; });
            });

        // Test connection result area
        this.testResultEl = contentEl.createDiv();

        // Buttons
        const btnRow = contentEl.createDiv({ cls: 'translate-modal-actions' });

        // Test button
        const testBtn = btnRow.createEl('button', {
            cls: 'translate-btn translate-btn-warning',
            text: 'Test',
        });
        setIcon(testBtn.createSpan({ prepend: true }), 'zap');
        testBtn.onclick = async () => {
            await this.runTest();
        };

        const cancelBtn = btnRow.createEl('button', {
            cls: 'translate-btn translate-btn-secondary',
            text: 'Cancel',
        });
        cancelBtn.onclick = () => this.close();

        const saveBtn = btnRow.createEl('button', {
            cls: 'translate-btn translate-btn-primary',
            text: this.isEdit ? 'Save' : 'Add Model',
        });
        saveBtn.onclick = () => {
            if (!this.data.name?.trim()) {
                new Notice('Model name is required');
                return;
            }
            const result: ModelConfig = {
                id: this.data.id || `${this.data.provider}:${this.data.name}`,
                name: this.data.name!.trim(),
                displayName: this.data.displayName?.trim() || this.data.name!.trim(),
                provider: this.data.provider as ProviderType,
                enabled: this.data.enabled !== false,
                isBuiltin: this.data.isBuiltin || false,
                customBaseUrl: this.data.customBaseUrl?.trim() || undefined,
                customApiKey: this.data.customApiKey?.trim() || undefined,
                customPrompt: this.data.customPrompt?.trim() || undefined,
                noSystemRole: this.data.noSystemRole || undefined,
            };
            this.onSave(result);
            this.close();
        };
    }

    private async runTest(): Promise<void> {
        if (!this.testResultEl) return;
        this.testResultEl.empty();

        if (!this.data.name?.trim()) {
            this.showTestResult(false, 'Please enter a model name first.');
            return;
        }
        if (!this.data.customApiKey?.trim()) {
            this.showTestResult(false, 'Please enter an API key first.');
            return;
        }

        this.testResultEl.createDiv({
            cls: 'translate-test-result',
            text: '⏳ Testing connection...',
        });

        // Build a temporary ModelConfig from form data
        const tempModel: ModelConfig = {
            id: `__test__:${this.data.name}`,
            name: this.data.name!.trim(),
            displayName: this.data.displayName?.trim() || this.data.name!.trim(),
            provider: (this.data.provider || 'openai') as ProviderType,
            enabled: true,
            isBuiltin: false,
            customBaseUrl: this.data.customBaseUrl?.trim() || undefined,
            customApiKey: this.data.customApiKey?.trim() || undefined,
            customPrompt: this.data.customPrompt?.trim() || undefined,
            noSystemRole: this.data.noSystemRole || undefined,
        };

        const errMsg = await this.translator.testConnectionWithMessage(tempModel);
        this.testResultEl.empty();

        if (!errMsg) {
            this.showTestResult(true, '✅ Connection successful!');
        } else {
            this.showTestResult(false, `❌ ${errMsg}`);
        }
    }

    private showTestResult(success: boolean, text: string): void {
        if (!this.testResultEl) return;
        this.testResultEl.empty();
        this.testResultEl.createDiv({
            cls: `translate-test-result ${success ? 'translate-test-success' : 'translate-test-fail'}`,
            text,
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
