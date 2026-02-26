import { App } from 'obsidian';
import { Translator } from './translator';

export class TranslatePopover {
    private popoverEl: HTMLElement | null = null;
    private app: App;
    private translator: Translator;
    private containerEl: HTMLElement;
    private isShown: boolean = false;

    // State for language swap
    private sourceLang: string = '';
    private targetLang: string = '';
    private sourceText: string = '';      // current text being shown as source
    private translatedText: string = '';  // current translation result

    constructor(app: App, translator: Translator) {
        this.app = app;
        this.translator = translator;
        this.containerEl = this.createContainer();
    }

    private createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'translate-popover';
        container.style.cssText = `
            min-width: 400px;
            max-width: 560px;
            padding: 14px 16px;
            padding-top: 28px;
            background: var(--background-primary, #fff);
            border: 1px solid var(--background-modifier-border, #e0e0e0);
            border-radius: 10px;
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
            font-size: 14px;
            color: var(--text-normal, #333);
        `;
        return container;
    }

    private createLoadingContent(): HTMLElement {
        const loading = document.createElement('div');
        loading.className = 'translate-loading';
        loading.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 28px;
            color: var(--text-muted, #888);
            font-size: 14px;
        `;
        loading.innerHTML = '<span>翻译中...</span>';
        return loading;
    }

    /**
     * Build the full content with language bar, source text, translated text, and copy btn.
     */
    private createContent(): HTMLElement {
        const content = document.createElement('div');
        content.style.cssText = `display: flex; flex-direction: column; gap: 10px;`;

        // ——— Language swap bar ———
        const langBar = document.createElement('div');
        langBar.style.cssText = `
            display: flex; align-items: center; justify-content: center; gap: 0;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
        `;

        const langBtnCss = `
            flex: 1; text-align: center;
            padding: 5px 0; font-size: 13px; font-weight: 600;
            background: transparent; border: none;
            color: var(--text-normal);
            cursor: default; user-select: none;
        `;

        // Source label
        const srcLabel = document.createElement('span');
        srcLabel.style.cssText = langBtnCss;
        srcLabel.textContent = this.sourceLang;

        // Swap button
        const swapBtn = document.createElement('button');
        swapBtn.style.cssText = `
            flex: 0 0 auto;
            display: inline-flex; align-items: center; justify-content: center;
            width: 34px; height: 34px;
            margin: 0 10px;
            border-radius: 50%;
            border: 1px solid var(--background-modifier-border);
            background: var(--background-secondary, #f0f0f0);
            cursor: pointer;
            font-size: 16px;
            transition: background 0.15s, transform 0.2s;
            color: var(--text-normal);
        `;
        swapBtn.textContent = '⇆';
        swapBtn.title = '切换来源/目标语言';
        swapBtn.onmouseenter = () => { swapBtn.style.background = 'var(--interactive-accent)'; swapBtn.style.color = 'var(--text-on-accent, #fff)'; };
        swapBtn.onmouseleave = () => { swapBtn.style.background = 'var(--background-secondary, #f0f0f0)'; swapBtn.style.color = 'var(--text-normal)'; };
        swapBtn.onclick = () => this.handleSwap();

        // Target label
        const tgtLabel = document.createElement('span');
        tgtLabel.style.cssText = langBtnCss;
        tgtLabel.textContent = this.targetLang;

        langBar.appendChild(srcLabel);
        langBar.appendChild(swapBtn);
        langBar.appendChild(tgtLabel);
        content.appendChild(langBar);

        // ——— Source text ———
        const sourceDiv = document.createElement('div');
        sourceDiv.style.cssText = `
            padding: 10px;
            background: var(--background-secondary, #f5f5f5);
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.6;
            color: var(--text-muted, #666);
            word-break: break-word;
            max-height: 120px;
            overflow-y: auto;
        `;
        sourceDiv.textContent = this.sourceText;

        // ——— Translated text ———
        const translatedDiv = document.createElement('div');
        translatedDiv.style.cssText = `
            padding: 10px;
            background: var(--background-primary, #fff);
            border-left: 3px solid var(--interactive-accent, #4a90d9);
            border-radius: 6px;
            font-size: 15px;
            line-height: 1.6;
            font-weight: 500;
            word-break: break-word;
            max-height: 220px;
            overflow-y: auto;
        `;
        translatedDiv.textContent = this.translatedText;

        // ——— Copy button ———
        const copyBtn = document.createElement('button');
        copyBtn.style.cssText = `
            align-self: flex-end;
            padding: 5px 14px;
            font-size: 12px;
            background: var(--background-secondary, #f0f0f0);
            border: 1px solid var(--background-modifier-border, #ddd);
            border-radius: 5px;
            cursor: pointer;
            color: var(--text-normal, #333);
            transition: background 0.15s;
        `;
        copyBtn.textContent = '复制';
        copyBtn.onmouseenter = () => { copyBtn.style.background = 'var(--background-modifier-hover)'; };
        copyBtn.onmouseleave = () => { copyBtn.style.background = 'var(--background-secondary, #f0f0f0)'; };
        copyBtn.onclick = async () => {
            await navigator.clipboard.writeText(this.translatedText);
            copyBtn.textContent = '已复制!';
            setTimeout(() => { copyBtn.textContent = '复制'; }, 1500);
        };

        content.appendChild(sourceDiv);
        content.appendChild(translatedDiv);
        content.appendChild(copyBtn);

        return content;
    }

    /**
     * Swap source ↔ target: use last translated text as new source, re-translate.
     */
    private async handleSwap(): Promise<void> {
        // Swap languages
        const tmp = this.sourceLang;
        this.sourceLang = this.targetLang;
        this.targetLang = tmp;

        // The translated text becomes the new source
        this.sourceText = this.translatedText;
        this.translatedText = '';

        // Show loading
        this.containerEl.innerHTML = '';
        this.containerEl.appendChild(this.createLoadingContent());

        try {
            const result = await this.translator.translate(this.sourceText, undefined, this.targetLang);
            if (!this.isShown) return;
            this.translatedText = result;
            this.containerEl.innerHTML = '';
            this.containerEl.appendChild(this.createContent());
        } catch (error) {
            if (!this.isShown) return;
            const msg = error instanceof Error ? error.message : 'Unknown error';
            this.containerEl.innerHTML = '';
            this.containerEl.appendChild(this.createErrorContent(msg));
        }
    }

    private createErrorContent(error: string): HTMLElement {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            padding: 12px;
            background: rgba(255, 0, 0, 0.05);
            border: 1px solid rgba(255, 0, 0, 0.15);
            border-radius: 6px;
            color: var(--text-error, #c33);
            font-size: 13px;
            word-break: break-word;
        `;
        errorDiv.textContent = `Error: ${error}`;
        return errorDiv;
    }

    async show(x: number, y: number, text: string, targetLang?: string): Promise<void> {
        this.close();

        // Determine source & target from languageOptions
        const langs = this.translator.settings.languageOptions;
        this.targetLang = targetLang || this.translator.settings.targetLanguage;
        // Source = the first language option that isn't the target (fallback to first)
        this.sourceLang = langs.find(l => l !== this.targetLang) || langs[0] || 'Auto';
        this.sourceText = text;
        this.translatedText = '';

        this.popoverEl = document.createElement('div');
        this.popoverEl.className = 'translate-popover-wrapper';
        this.popoverEl.style.cssText = `position: fixed; z-index: 10000;`;

        // Close button — lives on wrapper so it won't be cleared
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            position: absolute; top: 6px; right: 8px; z-index: 1;
            width: 24px; height: 24px;
            display: flex; align-items: center; justify-content: center;
            border: none; background: transparent;
            color: var(--text-muted, #888);
            font-size: 18px; line-height: 1;
            cursor: pointer; border-radius: 4px;
            transition: background 0.15s, color 0.15s;
        `;
        closeBtn.textContent = '×';
        closeBtn.title = '关闭';
        closeBtn.onmouseenter = () => { closeBtn.style.background = 'var(--background-modifier-hover)'; closeBtn.style.color = 'var(--text-normal)'; };
        closeBtn.onmouseleave = () => { closeBtn.style.background = 'transparent'; closeBtn.style.color = 'var(--text-muted, #888)'; };
        closeBtn.onclick = (e) => { e.stopPropagation(); this.close(); };

        this.containerEl = this.createContainer();
        this.containerEl.appendChild(this.createLoadingContent());
        this.popoverEl.appendChild(closeBtn);
        this.popoverEl.appendChild(this.containerEl);
        document.body.appendChild(this.popoverEl);

        // Position near cursor, clamped to viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = x + 8;
        let top = y + 8;
        requestAnimationFrame(() => {
            if (!this.popoverEl) return;
            const rect = this.popoverEl.getBoundingClientRect();
            if (left + rect.width > vw - 10) left = vw - rect.width - 10;
            if (top + rect.height > vh - 10) top = vh - rect.height - 10;
            if (left < 10) left = 10;
            if (top < 10) top = 10;
            this.popoverEl.style.left = `${left}px`;
            this.popoverEl.style.top = `${top}px`;
        });
        this.popoverEl.style.left = `${left}px`;
        this.popoverEl.style.top = `${top}px`;

        this.isShown = true;

        // Translate
        try {
            const result = await this.translator.translate(text, undefined, this.targetLang);
            if (!this.isShown) return;
            this.translatedText = result;
            this.containerEl.innerHTML = '';
            this.containerEl.appendChild(this.createContent());
        } catch (error) {
            if (!this.isShown) return;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.containerEl.innerHTML = '';
            this.containerEl.appendChild(this.createErrorContent(errorMessage));
        }
    }

    close(): void {
        if (this.popoverEl) {
            this.popoverEl.remove();
            this.popoverEl = null;
            this.isShown = false;
        }
    }

    isShowing(): boolean {
        return this.isShown;
    }
}
