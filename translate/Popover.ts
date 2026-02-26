import { App } from 'obsidian';
import { Translator } from './translator';

const AUTO_DETECT = '自动检测';

export class TranslatePopover {
    private popoverEl: HTMLElement | null = null;
    private overlayEl: HTMLElement | null = null;
    private app: App;
    private translator: Translator;
    private saveSettings: () => Promise<void>;
    private isShown: boolean = false;

    // State
    private sourceText: string = '';
    private translatedText: string = '';
    private sourceLang: string = AUTO_DETECT;
    private targetLang: string = '';
    private selectedModelId: string = '';
    private currentView: 'translate' | 'history' = 'translate';
    private selectedHistoryId: string | null = null;

    // DOM refs
    private sourceTextarea: HTMLTextAreaElement | null = null;
    private translatedDiv: HTMLElement | null = null;
    private translateBtn: HTMLButtonElement | null = null;
    private bodyEl: HTMLElement | null = null;
    private toolbarEl: HTMLElement | null = null;
    private bottomBarEl: HTMLElement | null = null;
    private sourceLangSelect: HTMLSelectElement | null = null;
    private targetLangSelect: HTMLSelectElement | null = null;
    private modelSelect: HTMLSelectElement | null = null;
    private historyToggleBtn: HTMLButtonElement | null = null;

    // Drag
    private isDragging = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;

    // Keyboard handlers
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor(app: App, translator: Translator, saveSettings: () => Promise<void>) {
        this.app = app;
        this.translator = translator;
        this.saveSettings = saveSettings;
    }

    // ========== Public API ==========

    async show(text?: string): Promise<void> {
        this.close();

        this.sourceText = text?.trim() || '';
        this.translatedText = '';
        this.currentView = 'translate';
        this.selectedHistoryId = null;

        // Language & model defaults
        this.targetLang = this.translator.settings.targetLanguage;
        this.selectedModelId = this.translator.settings.defaultModel;
        this.sourceLang = AUTO_DETECT;

        this.buildUI();
        this.isShown = true;

        // Global key handler (window-level capture to beat Obsidian/Electron keymap)
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault(); e.stopImmediatePropagation(); this.close();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && this.currentView === 'translate') {
                e.preventDefault(); e.stopImmediatePropagation(); this.doTranslate();
            }
        };
        window.addEventListener('keydown', this.keyHandler, true);

        if (this.sourceTextarea) this.sourceTextarea.focus();

        // Auto-translate if there's text
        if (this.sourceText) {
            await this.doTranslate();
        }
    }

    close(): void {
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler, true);
            this.keyHandler = null;
        }
        if (this.overlayEl) { this.overlayEl.remove(); this.overlayEl = null; }
        if (this.popoverEl) { this.popoverEl.remove(); this.popoverEl = null; }
        this.sourceTextarea = null;
        this.translatedDiv = null;
        this.translateBtn = null;
        this.bodyEl = null;
        this.toolbarEl = null;
        this.bottomBarEl = null;
        this.sourceLangSelect = null;
        this.targetLangSelect = null;
        this.modelSelect = null;
        this.historyToggleBtn = null;
        this.isShown = false;
    }

    isShowing(): boolean { return this.isShown; }

    // ========== Build UI ==========

    private buildUI(): void {
        // Overlay
        this.overlayEl = document.createElement('div');
        this.overlayEl.style.cssText = `position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.3);`;
        this.overlayEl.onclick = () => this.close();
        document.body.appendChild(this.overlayEl);

        // Main panel
        this.popoverEl = document.createElement('div');
        this.popoverEl.className = 'translate-popover-wrapper';
        this.popoverEl.style.cssText = `
            position: fixed; z-index: 10000;
            left: 50%; top: 50%; transform: translate(-50%, -50%);
            width: 720px; min-width: 440px; max-width: 95vw;
            height: 420px; min-height: 280px; max-height: 90vh;
            background: var(--background-primary, #fff);
            border: 1px solid var(--background-modifier-border, #e0e0e0);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.22);
            display: flex; flex-direction: column;
            overflow: hidden; resize: both;
            font-size: 14px; color: var(--text-normal, #333);
        `;
        this.popoverEl.onclick = (e) => e.stopPropagation();
        document.body.appendChild(this.popoverEl);

        this.buildTitleBar();
        this.buildToolbar();
        this.buildBody();
        this.buildBottomBar();
    }

    // —— Title Bar (draggable) ——

    private buildTitleBar(): void {
        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 14px; flex-shrink: 0;
            background: var(--background-secondary, #f5f5f5);
            cursor: move; user-select: none;
            border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
        `;
        this.setupDrag(titleBar);

        const leftGroup = document.createElement('div');
        leftGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const titleText = document.createElement('span');
        titleText.style.cssText = 'font-size: 14px; font-weight: 600;';
        titleText.textContent = 'AI 翻译';
        leftGroup.appendChild(titleText);

        const rightGroup = document.createElement('div');
        rightGroup.style.cssText = 'display: flex; align-items: center; gap: 6px;';

        // History toggle
        this.historyToggleBtn = document.createElement('button');
        this.historyToggleBtn.style.cssText = this.titleBtnCss(false);
        this.historyToggleBtn.textContent = '📋 历史';
        this.historyToggleBtn.onclick = (e) => { e.stopPropagation(); this.toggleView(); };
        rightGroup.appendChild(this.historyToggleBtn);

        // Close
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
            border: none; background: transparent; color: var(--text-muted, #888);
            font-size: 18px; line-height: 1; cursor: pointer; border-radius: 4px;
            transition: background 0.15s, color 0.15s;
        `;
        closeBtn.textContent = '×';
        closeBtn.title = '关闭 (Esc)';
        closeBtn.onmouseenter = () => { closeBtn.style.background = 'var(--background-modifier-hover)'; closeBtn.style.color = 'var(--text-normal)'; };
        closeBtn.onmouseleave = () => { closeBtn.style.background = 'transparent'; closeBtn.style.color = 'var(--text-muted, #888)'; };
        closeBtn.onclick = (e) => { e.stopPropagation(); this.close(); };
        rightGroup.appendChild(closeBtn);

        titleBar.appendChild(leftGroup);
        titleBar.appendChild(rightGroup);
        this.popoverEl!.appendChild(titleBar);
    }

    // —— Toolbar ——

    private buildToolbar(): void {
        this.toolbarEl = document.createElement('div');
        this.toolbarEl.style.cssText = `
            display: flex; align-items: center; gap: 8px;
            padding: 8px 14px; flex-shrink: 0;
            border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
            background: var(--background-primary);
        `;
        this.renderToolbarContent();
        this.popoverEl!.appendChild(this.toolbarEl);
    }

    private renderToolbarContent(): void {
        if (!this.toolbarEl) return;
        this.toolbarEl.innerHTML = '';

        if (this.currentView === 'translate') {
            this.renderTranslateToolbar();
        } else {
            this.renderHistoryToolbar();
        }
    }

    private renderTranslateToolbar(): void {
        const tb = this.toolbarEl!;
        const langs = this.translator.settings.languageOptions;

        // Source language
        this.sourceLangSelect = document.createElement('select');
        this.sourceLangSelect.style.cssText = this.selectCss();
        this.addOption(this.sourceLangSelect, AUTO_DETECT, AUTO_DETECT);
        for (const l of langs) this.addOption(this.sourceLangSelect, l, l);
        this.sourceLangSelect.value = this.sourceLang;
        this.sourceLangSelect.onchange = () => { this.sourceLang = this.sourceLangSelect!.value; };

        // Swap
        const swapBtn = document.createElement('button');
        swapBtn.style.cssText = `
            padding: 4px 8px; font-size: 16px; background: transparent;
            border: 1px solid var(--background-modifier-border, #ddd);
            border-radius: 4px; cursor: pointer; color: var(--text-muted);
            transition: all 0.15s; line-height: 1;
        `;
        swapBtn.textContent = '⇆';
        swapBtn.title = '交换语言';
        swapBtn.onmouseenter = () => { swapBtn.style.color = 'var(--text-normal)'; swapBtn.style.borderColor = 'var(--text-muted)'; };
        swapBtn.onmouseleave = () => { swapBtn.style.color = 'var(--text-muted)'; swapBtn.style.borderColor = 'var(--background-modifier-border, #ddd)'; };
        swapBtn.onclick = () => this.swapLanguages();

        // Target language
        this.targetLangSelect = document.createElement('select');
        this.targetLangSelect.style.cssText = this.selectCss();
        for (const l of langs) this.addOption(this.targetLangSelect, l, l);
        this.targetLangSelect.value = this.targetLang;
        this.targetLangSelect.onchange = () => { this.targetLang = this.targetLangSelect!.value; };

        // Spacer
        const spacer = document.createElement('div');
        spacer.style.flex = '1';

        // Model label + dropdown
        const modelLabel = document.createElement('span');
        modelLabel.style.cssText = 'font-size: 12px; color: var(--text-muted); white-space: nowrap;';
        modelLabel.textContent = '模型:';

        this.modelSelect = document.createElement('select');
        this.modelSelect.style.cssText = this.selectCss();
        const enabled = this.translator.getEnabledModels();
        for (const m of enabled) this.addOption(this.modelSelect, m.id, m.displayName);
        this.modelSelect.value = this.selectedModelId;
        this.modelSelect.onchange = () => { this.selectedModelId = this.modelSelect!.value; };

        tb.appendChild(this.sourceLangSelect);
        tb.appendChild(swapBtn);
        tb.appendChild(this.targetLangSelect);
        tb.appendChild(spacer);
        tb.appendChild(modelLabel);
        tb.appendChild(this.modelSelect);
    }

    private renderHistoryToolbar(): void {
        const tb = this.toolbarEl!;

        const title = document.createElement('span');
        title.style.cssText = 'font-size: 14px; font-weight: 500;';
        title.textContent = '历史记录';

        const spacer = document.createElement('div');
        spacer.style.flex = '1';

        const clearBtn = document.createElement('button');
        clearBtn.style.cssText = `
            padding: 4px 10px; font-size: 12px;
            background: transparent; border: 1px solid var(--background-modifier-border, #ddd);
            border-radius: 4px; cursor: pointer; color: var(--text-error, #c33);
            transition: all 0.15s;
        `;
        clearBtn.textContent = '🗑 清空';
        clearBtn.onclick = async () => {
            this.translator.clearHistory();
            this.selectedHistoryId = null;
            await this.saveSettings();
            this.renderBodyContent();
        };

        tb.appendChild(title);
        tb.appendChild(spacer);
        tb.appendChild(clearBtn);
    }

    // —— Body ——

    private buildBody(): void {
        this.bodyEl = document.createElement('div');
        this.bodyEl.style.cssText = 'display: flex; flex: 1; min-height: 0; overflow: hidden;';
        this.renderBodyContent();
        this.popoverEl!.appendChild(this.bodyEl);
    }

    private renderBodyContent(): void {
        if (!this.bodyEl) return;
        this.bodyEl.innerHTML = '';

        if (this.currentView === 'translate') {
            this.renderTranslateBody();
        } else {
            this.renderHistoryBody();
        }
    }

    private renderTranslateBody(): void {
        const body = this.bodyEl!;

        // Left: source
        const leftPane = document.createElement('div');
        leftPane.style.cssText = `
            flex: 1; display: flex; flex-direction: column;
            border-right: 1px solid var(--background-modifier-border, #e0e0e0);
            min-width: 0;
        `;

        const leftHeader = document.createElement('div');
        leftHeader.style.cssText = 'padding: 6px 12px; font-size: 12px; color: var(--text-muted); font-weight: 500; flex-shrink: 0;';
        leftHeader.textContent = '原文';

        this.sourceTextarea = document.createElement('textarea');
        this.sourceTextarea.style.cssText = `
            flex: 1; border: none; outline: none; resize: none;
            padding: 10px 12px; font-size: 14px; line-height: 1.7;
            background: var(--background-primary); color: var(--text-normal);
            font-family: inherit; min-height: 0; box-shadow: none;
        `;
        this.sourceTextarea.value = this.sourceText;
        this.sourceTextarea.placeholder = '请输入或粘贴要翻译的文本…';
        this.sourceTextarea.oninput = () => { this.sourceText = this.sourceTextarea!.value; };
        // Remove focus border explicitly
        this.sourceTextarea.onfocus = () => {
            this.sourceTextarea!.style.outline = 'none';
            this.sourceTextarea!.style.boxShadow = 'none';
        };

        leftPane.appendChild(leftHeader);
        leftPane.appendChild(this.sourceTextarea);

        // Right: translation
        const rightPane = document.createElement('div');
        rightPane.style.cssText = 'flex: 1; display: flex; flex-direction: column; min-width: 0;';

        const rightHeader = document.createElement('div');
        rightHeader.style.cssText = 'padding: 6px 12px; font-size: 12px; color: var(--text-muted); font-weight: 500; flex-shrink: 0;';
        rightHeader.textContent = '译文';

        this.translatedDiv = document.createElement('div');
        this.translatedDiv.style.cssText = `
            flex: 1; padding: 10px 12px; font-size: 14px; line-height: 1.7;
            overflow-y: auto; word-break: break-word;
            color: var(--text-normal); user-select: text; min-height: 0;
        `;
        this.translatedDiv.textContent = this.translatedText || '';

        rightPane.appendChild(rightHeader);
        rightPane.appendChild(this.translatedDiv);

        body.appendChild(leftPane);
        body.appendChild(rightPane);
    }

    private renderHistoryBody(): void {
        const body = this.bodyEl!;
        const history = this.translator.getHistory();

        // Left: history list
        const leftPane = document.createElement('div');
        leftPane.style.cssText = `
            width: 220px; min-width: 160px; flex-shrink: 0;
            border-right: 1px solid var(--background-modifier-border, #e0e0e0);
            overflow-y: auto; display: flex; flex-direction: column;
        `;

        if (history.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 13px;';
            empty.textContent = '暂无翻译历史';
            leftPane.appendChild(empty);
        } else {
            for (const record of history) {
                const isSelected = this.selectedHistoryId === record.id;
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 10px 12px; cursor: pointer;
                    border-bottom: 1px solid var(--background-modifier-border, #eee);
                    background: ${isSelected ? 'var(--background-modifier-hover)' : 'transparent'};
                    transition: background 0.1s;
                `;
                item.onmouseenter = () => { if (!isSelected) item.style.background = 'var(--background-secondary)'; };
                item.onmouseleave = () => { if (!isSelected) item.style.background = 'transparent'; };

                const preview = document.createElement('div');
                preview.style.cssText = `
                    font-size: 13px; color: var(--text-normal);
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                `;
                preview.textContent = record.originalText.substring(0, 50);

                const meta = document.createElement('div');
                meta.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; justify-content: space-between;';
                const modelSpan = document.createElement('span');
                modelSpan.textContent = record.model;
                const timeSpan = document.createElement('span');
                timeSpan.textContent = this.formatTime(record.timestamp);
                meta.appendChild(modelSpan);
                meta.appendChild(timeSpan);

                item.appendChild(preview);
                item.appendChild(meta);

                item.onclick = () => {
                    this.selectedHistoryId = record.id;
                    this.renderBodyContent();
                };

                leftPane.appendChild(item);
            }
        }

        // Right: detail
        const rightPane = document.createElement('div');
        rightPane.style.cssText = 'flex: 1; display: flex; flex-direction: column; min-width: 0; overflow-y: auto;';

        const selected = history.find(r => r.id === this.selectedHistoryId);
        if (selected) {
            const origLabel = document.createElement('div');
            origLabel.style.cssText = 'padding: 10px 14px 4px; font-size: 12px; color: var(--text-muted); font-weight: 500;';
            origLabel.textContent = '原文';

            const origText = document.createElement('div');
            origText.style.cssText = `
                padding: 4px 14px 12px; font-size: 14px; line-height: 1.6;
                color: var(--text-normal); user-select: text;
                border-bottom: 1px solid var(--background-modifier-border);
            `;
            origText.textContent = selected.originalText;

            const transLabel = document.createElement('div');
            transLabel.style.cssText = 'padding: 10px 14px 4px; font-size: 12px; color: var(--text-muted); font-weight: 500;';
            transLabel.textContent = '译文';

            const transText = document.createElement('div');
            transText.style.cssText = `
                padding: 4px 14px 12px; font-size: 14px; line-height: 1.6;
                color: var(--text-normal); user-select: text;
                border-bottom: 1px solid var(--background-modifier-border);
            `;
            transText.textContent = selected.translatedText;

            const metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'padding: 10px 14px; font-size: 12px; color: var(--text-muted); display: flex; gap: 16px;';

            const modelInfo = document.createElement('span');
            modelInfo.textContent = `模型: ${selected.model}`;
            const providerInfo = document.createElement('span');
            providerInfo.textContent = `服务商: ${selected.provider}`;
            const timeInfo = document.createElement('span');
            timeInfo.textContent = this.formatTime(selected.timestamp);
            metaDiv.appendChild(modelInfo);
            metaDiv.appendChild(providerInfo);
            metaDiv.appendChild(timeInfo);

            rightPane.appendChild(origLabel);
            rightPane.appendChild(origText);
            rightPane.appendChild(transLabel);
            rightPane.appendChild(transText);
            rightPane.appendChild(metaDiv);
        } else {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px;';
            placeholder.textContent = history.length > 0 ? '← 选择一条记录查看详情' : '';
            rightPane.appendChild(placeholder);
        }

        body.appendChild(leftPane);
        body.appendChild(rightPane);
    }

    // —— Bottom Bar ——

    private buildBottomBar(): void {
        this.bottomBarEl = document.createElement('div');
        this.bottomBarEl.style.cssText = `
            display: flex; align-items: center; justify-content: flex-end; gap: 8px;
            padding: 8px 14px; flex-shrink: 0;
            border-top: 1px solid var(--background-modifier-border, #e0e0e0);
            background: var(--background-secondary, #f8f8f8);
        `;
        this.renderBottomBarContent();
        this.popoverEl!.appendChild(this.bottomBarEl);
    }

    private renderBottomBarContent(): void {
        if (!this.bottomBarEl) return;
        this.bottomBarEl.innerHTML = '';

        if (this.currentView === 'translate') {
            this.renderTranslateBottomBar();
        } else {
            this.renderHistoryBottomBar();
        }
    }

    private renderTranslateBottomBar(): void {
        const bar = this.bottomBarEl!;

        const hint = document.createElement('span');
        hint.style.cssText = 'flex: 1; font-size: 11px; color: var(--text-faint, #aaa);';
        hint.textContent = 'Ctrl+Enter 翻译 · Esc 关闭';

        const copyBtn = document.createElement('button');
        copyBtn.style.cssText = this.smallBtnCss();
        copyBtn.textContent = '复制译文';
        copyBtn.onclick = async () => {
            if (!this.translatedText) return;
            await navigator.clipboard.writeText(this.translatedText);
            copyBtn.textContent = '已复制!';
            setTimeout(() => { copyBtn.textContent = '复制译文'; }, 1500);
        };

        this.translateBtn = document.createElement('button');
        this.translateBtn.style.cssText = `
            padding: 6px 20px; font-size: 13px; font-weight: 600;
            background: var(--interactive-accent, #4a90d9);
            color: var(--text-on-accent, #fff);
            border: none; border-radius: 6px;
            cursor: pointer; transition: opacity 0.15s;
        `;
        this.translateBtn.textContent = '翻译';
        this.translateBtn.onmouseenter = () => { this.translateBtn!.style.opacity = '0.85'; };
        this.translateBtn.onmouseleave = () => { this.translateBtn!.style.opacity = '1'; };
        this.translateBtn.onclick = () => this.doTranslate();

        bar.appendChild(hint);
        bar.appendChild(copyBtn);
        bar.appendChild(this.translateBtn);
    }

    private renderHistoryBottomBar(): void {
        const bar = this.bottomBarEl!;

        const spacer = document.createElement('div');
        spacer.style.flex = '1';

        // Use selected text
        const useBtn = document.createElement('button');
        useBtn.style.cssText = this.smallBtnCss();
        useBtn.textContent = '使用此文本';
        useBtn.onclick = () => {
            const selected = this.translator.getHistory().find(r => r.id === this.selectedHistoryId);
            if (selected) {
                this.sourceText = selected.originalText;
                this.translatedText = selected.translatedText;
            }
            this.switchToTranslate();
        };

        // Copy translation
        const copyBtn = document.createElement('button');
        copyBtn.style.cssText = this.smallBtnCss();
        copyBtn.textContent = '复制译文';
        copyBtn.onclick = async () => {
            const selected = this.translator.getHistory().find(r => r.id === this.selectedHistoryId);
            if (!selected) return;
            await navigator.clipboard.writeText(selected.translatedText);
            copyBtn.textContent = '已复制!';
            setTimeout(() => { copyBtn.textContent = '复制译文'; }, 1500);
        };

        const backBtn = document.createElement('button');
        backBtn.style.cssText = `
            padding: 6px 20px; font-size: 13px; font-weight: 600;
            background: var(--interactive-accent, #4a90d9);
            color: var(--text-on-accent, #fff);
            border: none; border-radius: 6px;
            cursor: pointer; transition: opacity 0.15s;
        `;
        backBtn.textContent = '返回翻译';
        backBtn.onclick = () => this.switchToTranslate();

        bar.appendChild(spacer);
        bar.appendChild(useBtn);
        bar.appendChild(copyBtn);
        bar.appendChild(backBtn);
    }

    // ========== View Switching ==========

    private toggleView(): void {
        if (this.currentView === 'translate') {
            this.currentView = 'history';
            const history = this.translator.getHistory();
            this.selectedHistoryId = history.length > 0 ? history[0].id : null;
        } else {
            this.currentView = 'translate';
        }
        this.updateHistoryBtnStyle();
        this.renderToolbarContent();
        this.renderBodyContent();
        this.renderBottomBarContent();
    }

    private switchToTranslate(): void {
        this.currentView = 'translate';
        this.updateHistoryBtnStyle();
        this.renderToolbarContent();
        this.renderBodyContent();
        this.renderBottomBarContent();
        if (this.sourceTextarea) {
            this.sourceTextarea.value = this.sourceText;
            this.sourceTextarea.focus();
        }
        if (this.translatedDiv) {
            this.translatedDiv.textContent = this.translatedText;
        }
    }

    private updateHistoryBtnStyle(): void {
        if (!this.historyToggleBtn) return;
        const active = this.currentView === 'history';
        this.historyToggleBtn.style.cssText = this.titleBtnCss(active);
        this.historyToggleBtn.textContent = active ? '📋 翻译' : '📋 历史';
    }

    // ========== Actions ==========

    private async doTranslate(): Promise<void> {
        const text = this.sourceText.trim();
        if (!text) return;
        if (!this.translatedDiv || !this.translateBtn) return;

        this.translateBtn.disabled = true;
        this.translateBtn.textContent = '翻译中…';
        this.translatedDiv.style.color = 'var(--text-muted)';
        this.translatedDiv.textContent = '翻译中...';

        try {
            const src = this.sourceLang === AUTO_DETECT ? undefined : this.sourceLang;
            const result = await this.translator.translate(
                text, this.selectedModelId, this.targetLang, src
            );
            if (!this.isShown) return;
            this.translatedText = result;
            this.translatedDiv.style.color = 'var(--text-normal)';
            this.translatedDiv.textContent = this.translatedText;
            // Persist history to disk
            await this.saveSettings();
        } catch (error) {
            if (!this.isShown) return;
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.translatedDiv.style.color = 'var(--text-error, #c33)';
            this.translatedDiv.textContent = `Error: ${msg}`;
        } finally {
            if (this.translateBtn) {
                this.translateBtn.disabled = false;
                this.translateBtn.textContent = '翻译';
            }
        }
    }

    private swapLanguages(): void {
        const langs = this.translator.settings.languageOptions;

        if (this.sourceLang === AUTO_DETECT) {
            // Set source to current target, target to first other language
            const newSource = this.targetLang;
            const newTarget = langs.find(l => l !== this.targetLang) || langs[0] || '';
            this.sourceLang = newSource;
            this.targetLang = newTarget;
        } else {
            const tmp = this.sourceLang;
            this.sourceLang = this.targetLang;
            this.targetLang = tmp;
        }
        if (this.sourceLangSelect) this.sourceLangSelect.value = this.sourceLang;
        if (this.targetLangSelect) this.targetLangSelect.value = this.targetLang;
    }

    // ========== Drag ==========

    private setupDrag(handle: HTMLElement): void {
        handle.onmousedown = (e: MouseEvent) => {
            if (!this.popoverEl) return;
            e.preventDefault();
            this.isDragging = true;

            const rect = this.popoverEl.getBoundingClientRect();
            this.popoverEl.style.transform = 'none';
            this.popoverEl.style.left = `${rect.left}px`;
            this.popoverEl.style.top = `${rect.top}px`;

            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;

            const onMouseMove = (ev: MouseEvent) => {
                if (!this.isDragging || !this.popoverEl) return;
                this.popoverEl.style.left = `${ev.clientX - this.dragOffsetX}px`;
                this.popoverEl.style.top = `${ev.clientY - this.dragOffsetY}px`;
            };
            const onMouseUp = () => {
                this.isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }

    // ========== Helpers ==========

    private addOption(select: HTMLSelectElement, value: string, text: string): void {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        select.appendChild(opt);
    }

    private formatTime(ts: number): string {
        const d = new Date(ts);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    private selectCss(): string {
        return `
            padding: 4px 8px; font-size: 13px;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border, #ddd);
            border-radius: 4px; color: var(--text-normal);
            cursor: pointer; outline: none;
        `;
    }

    private smallBtnCss(): string {
        return `
            padding: 6px 14px; font-size: 12px;
            background: var(--background-primary, #fff);
            border: 1px solid var(--background-modifier-border, #ddd);
            border-radius: 6px; cursor: pointer;
            color: var(--text-normal, #333);
            transition: background 0.15s;
        `;
    }

    private titleBtnCss(active: boolean): string {
        return `
            padding: 4px 10px; font-size: 12px;
            background: ${active ? 'var(--interactive-accent)' : 'transparent'};
            border: 1px solid ${active ? 'var(--interactive-accent)' : 'var(--background-modifier-border, #ddd)'};
            border-radius: 4px; cursor: pointer;
            color: ${active ? 'var(--text-on-accent, #fff)' : 'var(--text-muted)'};
            transition: all 0.15s; display: flex; align-items: center; gap: 4px;
        `;
    }
}
