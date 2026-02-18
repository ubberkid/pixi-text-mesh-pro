import { ViewContainer, ObservablePoint, Bounds } from 'pixi.js';
import type { PointData, FederatedPointerEvent } from 'pixi.js';
import { TMPTextStyle, type TMPTextStyleOptions } from './TMPTextStyle';
import type { TMPFont } from '../font/TMPFont';
import type { TextInfo, LinkInfo } from './types';
import { RichTextParser } from '../parser/RichTextParser';
import { TMPLayoutEngine } from '../layout/TMPLayoutEngine';
import { releaseCharacterInfos } from '../layout/CharacterInfoPool';
import { autoSizeFontSize } from '../utils/autoSize';
import { createDefaultStyleState, createParsedChar } from '../parser/RichTextData';
import type { TMPStyleSheet } from '../styles/TMPStyleSheet';

export interface TMPTextOptions {
    text?: string;
    font: TMPFont;
    style?: TMPTextStyleOptions | TMPTextStyle;
    anchor?: number | PointData;
    roundPixels?: boolean;
    /** Enable rich text parsing (default true). Set false to treat text as literal. */
    richText?: boolean;
}

/**
 * TMPText — the main display object for TextMeshPro-style rich text in PixiJS v8.
 *
 * Usage:
 * ```ts
 * const text = new TMPText({
 *     text: 'Hello <color=#ff0000>World</color>!',
 *     font: myFont,
 *     style: { fontSize: 32, fill: '#ffffff' },
 * });
 * stage.addChild(text);
 * ```
 */
export class TMPText extends ViewContainer {
    /** @internal — tells PixiJS which render pipe to use. */
    readonly renderPipeId = 'tmpText';

    /** @internal */
    batched = true;
    /** @internal */
    _didTextUpdate = true;
    /** @internal */
    override _roundPixels: 0 | 1 = 0;

    private _text = '';
    private _style: TMPTextStyle;
    private _font: TMPFont;
    private _anchor: ObservablePoint;
    private _textInfo: TextInfo | null = null;
    private _parser: RichTextParser;
    private _maxVisibleCharacters = -1;
    private _maxVisibleWords = -1;
    private _maxVisibleLines = -1;
    private _enableAutoSize = false;
    private _autoSizeMin = 1;
    private _autoSizeMax = 500;
    private _richText = true;

    /** @internal Cached bounds. */
    override _bounds = new Bounds();
    _boundsDirty = true;

    /** @internal Flag for vertex-only updates (no re-layout). */
    _didVerticesUpdate = false;

    constructor(options: TMPTextOptions) {
        super({});
        this.allowChildren = false;

        this._font = options.font;
        this._parser = new RichTextParser();

        // Style
        if (options.style instanceof TMPTextStyle) {
            this._style = options.style;
        } else {
            this._style = new TMPTextStyle(options.style);
        }
        this._style.on('update', this._onStyleUpdate, this);

        // Anchor
        this._anchor = new ObservablePoint({
            _onUpdate: () => { this.onViewUpdate(); },
        });
        if (options.anchor !== undefined) {
            if (typeof options.anchor === 'number') {
                this._anchor.set(options.anchor);
            } else {
                this._anchor.copyFrom(options.anchor);
            }
        }

        this._richText = options.richText ?? true;
        this.roundPixels = options.roundPixels ?? false;
        this.text = options.text ?? '';
    }

    // --- Public API ---

    get text(): string { return this._text; }
    set text(value: string) {
        const str = String(value);
        if (this._text === str) return;
        this._text = str;
        this._invalidateLayout();
    }

    get style(): TMPTextStyle { return this._style; }
    set style(value: TMPTextStyleOptions | TMPTextStyle) {
        this._style?.off('update', this._onStyleUpdate, this);
        if (value instanceof TMPTextStyle) {
            this._style = value;
        } else {
            this._style = new TMPTextStyle(value);
        }
        this._style.on('update', this._onStyleUpdate, this);
        this._invalidateLayout();
    }

    get font(): TMPFont { return this._font; }
    set font(value: TMPFont) {
        if (this._font === value) return;
        this._font = value;
        this._invalidateLayout();
    }

    get anchor(): ObservablePoint { return this._anchor; }
    set anchor(value: number | PointData) {
        if (typeof value === 'number') {
            this._anchor.set(value);
        } else {
            this._anchor.copyFrom(value);
        }
    }

    /** Access the computed text layout info. */
    get textInfo(): TextInfo {
        if (!this._textInfo) {
            this._rebuildTextInfo();
        }
        return this._textInfo!;
    }

    get roundPixels(): boolean { return !!this._roundPixels; }
    set roundPixels(value: boolean) { this._roundPixels = value ? 1 : 0; }

    /** The parser instance — access for registering custom tags. */
    get parser(): RichTextParser { return this._parser; }

    /** Style sheet for <style="name"> tag resolution. */
    get styleSheet(): TMPStyleSheet | null { return this._parser.styleSheet; }
    set styleSheet(value: TMPStyleSheet | null) {
        this._parser.styleSheet = value;
        this._invalidateLayout();
    }

    /**
     * Maximum number of visible characters. Set to -1 (default) to show all.
     * Useful for typewriter/reveal effects.
     */
    get maxVisibleCharacters(): number { return this._maxVisibleCharacters; }
    set maxVisibleCharacters(value: number) {
        if (this._maxVisibleCharacters === value) return;
        this._maxVisibleCharacters = value;
        this.onViewUpdate();
    }

    /** Maximum number of visible words. Set to -1 (default) to show all. */
    get maxVisibleWords(): number { return this._maxVisibleWords; }
    set maxVisibleWords(value: number) {
        if (this._maxVisibleWords === value) return;
        this._maxVisibleWords = value;
        this.onViewUpdate();
    }

    /** Maximum number of visible lines. Set to -1 (default) to show all. */
    get maxVisibleLines(): number { return this._maxVisibleLines; }
    set maxVisibleLines(value: number) {
        if (this._maxVisibleLines === value) return;
        this._maxVisibleLines = value;
        this.onViewUpdate();
    }

    /** Enable rich text parsing. When false, tags are rendered as literal text. */
    get richText(): boolean { return this._richText; }
    set richText(value: boolean) {
        if (this._richText === value) return;
        this._richText = value;
        this._invalidateLayout();
    }

    /** Enable auto-sizing: automatically adjust fontSize to fit within wordWrapWidth x containerHeight. */
    get enableAutoSize(): boolean { return this._enableAutoSize; }
    set enableAutoSize(value: boolean) {
        if (this._enableAutoSize === value) return;
        this._enableAutoSize = value;
        this._invalidateLayout();
    }

    /** Minimum font size for auto-sizing. */
    get autoSizeMin(): number { return this._autoSizeMin; }
    set autoSizeMin(value: number) {
        if (this._autoSizeMin === value) return;
        this._autoSizeMin = value;
        if (this._enableAutoSize) this._invalidateLayout();
    }

    /** Maximum font size for auto-sizing. */
    get autoSizeMax(): number { return this._autoSizeMax; }
    set autoSizeMax(value: number) {
        if (this._autoSizeMax === value) return;
        this._autoSizeMax = value;
        if (this._enableAutoSize) this._invalidateLayout();
    }

    /**
     * Force an immediate synchronous layout rebuild.
     * Unity equivalent: `ForceMeshUpdate()`.
     * After calling, `textInfo` is guaranteed to reflect the current text/style.
     */
    forceMeshUpdate(): void {
        if (this._textInfo) {
            releaseCharacterInfos(this._textInfo.characterInfo);
            this._textInfo = null;
        }
        this._rebuildTextInfo();
    }

    /**
     * Push modified character positions to the GPU without re-running layout.
     *
     * Usage:
     * ```ts
     * const info = text.textInfo;
     * for (let i = 0; i < info.characterCount; i++) {
     *     info.characterInfo[i].y += Math.sin(time + i * 0.3) * 2;
     * }
     * text.updateVertices();
     * ```
     */
    updateVertices(): void {
        this._didVerticesUpdate = true;
        this._didTextUpdate = true;

        this._didViewChangeTick++;
        if (this.didViewUpdate) return;
        this.didViewUpdate = true;

        const renderGroup = this.renderGroup || this.parentRenderGroup;
        if (renderGroup) {
            renderGroup.onChildViewUpdate(this);
        }
    }

    /**
     * Enable interactive link click/hover events.
     * Call this once to set up pointer event listeners.
     */
    enableLinkEvents(): void {
        this.eventMode = 'static';
        this.on('pointerdown', this._onPointerForLink, this);
        this.on('pointermove', this._onPointerMoveForLink, this);
    }

    /**
     * Find which link (if any) contains the given local point.
     */
    getLinkAtPoint(localX: number, localY: number): LinkInfo | null {
        const info = this.textInfo;
        const ax = this._anchor.x * info.width;
        const ay = this._anchor.y * info.height;
        const px = localX + ax;
        const py = localY + ay;

        for (const link of info.linkInfo) {
            for (const rect of link.rects) {
                if (px >= rect.x && px <= rect.x + rect.width &&
                    py >= rect.y && py <= rect.y + rect.height) {
                    return link;
                }
            }
        }
        return null;
    }

    private _onPointerForLink(e: FederatedPointerEvent): void {
        const local = e.getLocalPosition(this);
        const link = this.getLinkAtPoint(local.x, local.y);
        if (link) {
            this.emit('linkClick', link.linkId, link, e);
        }
    }

    private _onPointerMoveForLink(e: FederatedPointerEvent): void {
        const local = e.getLocalPosition(this);
        const link = this.getLinkAtPoint(local.x, local.y);
        if (link) {
            this.cursor = 'pointer';
            this.emit('linkHover', link.linkId, link, e);
        } else {
            this.cursor = 'default';
        }
    }

    // --- Bounds ---

    get bounds(): Bounds {
        if (this._boundsDirty) {
            this._updateBounds();
            this._boundsDirty = false;
        }
        return this._bounds;
    }

    override updateBounds(): void {
        this._updateBounds();
    }

    containsPoint(point: PointData): boolean {
        const b = this.bounds;
        return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY;
    }

    // --- Width/height ---

    get width(): number { return Math.abs(this.scale.x) * (this.bounds.maxX - this.bounds.minX); }
    set width(value: number) {
        const bw = this.bounds.maxX - this.bounds.minX;
        if (bw !== 0) this.scale.x = value / bw;
    }

    get height(): number { return Math.abs(this.scale.y) * (this.bounds.maxY - this.bounds.minY); }
    set height(value: number) {
        const bh = this.bounds.maxY - this.bounds.minY;
        if (bh !== 0) this.scale.y = value / bh;
    }

    // --- Internal ---

    /** @internal */
    override onViewUpdate(): void {
        this._didTextUpdate = true;
        this._boundsDirty = true;

        this._didViewChangeTick++;
        if (this.didViewUpdate) return;
        this.didViewUpdate = true;

        const renderGroup = this.renderGroup || this.parentRenderGroup;
        if (renderGroup) {
            renderGroup.onChildViewUpdate(this);
        }
    }

    /** @internal Invalidate layout cache and trigger view update. */
    private _invalidateLayout(): void {
        if (this._textInfo) {
            releaseCharacterInfos(this._textInfo.characterInfo);
            this._textInfo = null;
        }
        this.onViewUpdate();
    }

    private _onStyleUpdate(): void {
        this._invalidateLayout();
    }

    private _rebuildTextInfo(): void {
        // Apply fontStyle as wrapping tags around the text
        let effectiveText = this._text;
        const fontStyle = this._style.fontStyle;
        if (fontStyle) {
            const flags = fontStyle.toLowerCase().split(/\s+/);
            let prefix = '';
            let suffix = '';
            if (flags.includes('bold')) { prefix += '<b>'; suffix = '</b>' + suffix; }
            if (flags.includes('italic')) { prefix += '<i>'; suffix = '</i>' + suffix; }
            if (flags.includes('underline')) { prefix += '<u>'; suffix = '</u>' + suffix; }
            if (flags.includes('strikethrough')) { prefix += '<s>'; suffix = '</s>' + suffix; }
            if (prefix) effectiveText = prefix + effectiveText + suffix;
        }

        // Auto-size: find best font size via binary search
        if (this._enableAutoSize && this._style.wordWrapWidth > 0 && this._style.containerHeight > 0) {
            const bestSize = autoSizeFontSize(
                effectiveText,
                this._font,
                this._style,
                this._style.wordWrapWidth,
                this._style.containerHeight,
                this._autoSizeMin,
                this._autoSizeMax,
            );
            this._style.fontSize = bestSize;
        }

        let parsed;
        if (this._richText) {
            parsed = this._parser.parse(
                effectiveText,
                this._style.fontSize,
                this._style.fill,
                this._style.fontFamily || this._font.fontFamily,
            );
        } else {
            // Plain text mode: emit each character with default style, no tag parsing
            const state = createDefaultStyleState(
                this._style.fontSize,
                this._style.fill,
                this._style.fontFamily || this._font.fontFamily,
            );
            parsed = [];
            for (let ci = 0; ci < effectiveText.length; ci++) {
                const ch = effectiveText[ci];
                const pc = createParsedChar(ch, ci, state);
                if (ch === '\n') pc.isLineBreak = true;
                parsed.push(pc);
            }
        }

        this._textInfo = TMPLayoutEngine.layout(parsed, this._font, this._style);
    }

    private _updateBounds(): void {
        const info = this.textInfo;
        const ax = this._anchor.x;
        const ay = this._anchor.y;
        const w = info.width;
        const h = info.height;

        this._bounds.minX = -ax * w;
        this._bounds.maxX = this._bounds.minX + w;
        this._bounds.minY = -ay * h;
        this._bounds.maxY = this._bounds.minY + h;
    }

    override destroy(options?: boolean | { style?: boolean }): void {
        super.destroy(options);
        this._style?.off('update', this._onStyleUpdate, this);
        if (typeof options === 'boolean' ? options : options?.style) {
            this._style?.destroy();
        }
        if (this._textInfo) {
            releaseCharacterInfos(this._textInfo.characterInfo);
        }
        this._style = null!;
        this._font = null!;
        this._textInfo = null;
        this._parser = null!;
        this._anchor = null!;
    }
}
