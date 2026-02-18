import { EventEmitter } from 'pixi.js';
import type { TextAlignment } from './types';

export type VerticalAlignment = 'top' | 'middle' | 'bottom' | 'baseline' | 'midline' | 'capline' | 'geometry';
export type OverflowMode = 'overflow' | 'truncate' | 'ellipsis';

/** Font style flags — can be combined: 'bold italic' */
export type FontStyleString = string;

export interface TMPTextStyleOptions {
    fontSize?: number;
    fill?: string | number;
    fontFamily?: string;
    fontStyle?: FontStyleString;
    align?: TextAlignment;
    verticalAlign?: VerticalAlignment;
    containerHeight?: number;
    wordWrap?: boolean;
    wordWrapWidth?: number;
    breakWords?: boolean;
    lineHeight?: number;
    /** Additive line spacing adjustment (added to computed line height, like Unity). */
    lineSpacingAdjustment?: number;
    letterSpacing?: number;
    padding?: number;
    wordSpacing?: number;
    paragraphSpacing?: number;
    /** Character spacing in em units (scales with font size). Applied on top of letterSpacing. */
    characterSpacing?: number;
    overflowMode?: OverflowMode;
    /** Word wrapping ratio for preferred/non-preferred break points (0-1, default 0.4). */
    wordWrappingRatios?: number;
    /** SDF sharpness adjustment (-1 to 1, default 0). */
    sharpness?: number;
    /** Override rich text color tags with the base fill color (Unity: overrideColorTags). */
    overrideColorTags?: boolean;

    // Component-level margins (Unity m_margin: left, top, right, bottom)
    marginLeft?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;

    // SDF effects (Phase 2 will extend these)
    outlineWidth?: number;
    outlineColor?: string | number;
    outlineSoftness?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowColor?: string | number;
    shadowDilate?: number;
    shadowSoftness?: number;
    glowColor?: string | number;
    glowOffset?: number;
    glowInner?: number;
    glowOuter?: number;
    glowPower?: number;
    faceDilate?: number;
    bevelWidth?: number;
    bevelOffset?: number;
    bevelColor?: string | number;

    // Per-effect alpha (0-1). Controls effect visibility independently of color.
    outlineAlpha?: number;
    shadowAlpha?: number;
    glowAlpha?: number;
    bevelAlpha?: number;
}

/**
 * Extended text style with SDF effect properties.
 * Emits 'update' when any property changes.
 */
export class TMPTextStyle extends EventEmitter {
    private _fontSize: number;
    private _fill: number;
    private _fontFamily: string;
    private _fontStyle: FontStyleString;
    private _align: TextAlignment;
    private _verticalAlign: VerticalAlignment;
    private _containerHeight: number;
    private _wordWrap: boolean;
    private _wordWrapWidth: number;
    private _breakWords: boolean;
    private _lineHeight: number;
    private _lineSpacingAdjustment: number;
    private _letterSpacing: number;
    private _padding: number;
    private _wordSpacing: number;
    private _paragraphSpacing: number;
    private _characterSpacing: number;
    private _overflowMode: OverflowMode;
    private _wordWrappingRatios: number;
    private _sharpness: number;
    private _overrideColorTags: boolean;

    private _marginLeft: number;
    private _marginTop: number;
    private _marginRight: number;
    private _marginBottom: number;

    // SDF effects
    private _outlineWidth: number;
    private _outlineColor: number;
    private _outlineSoftness: number;
    private _shadowOffsetX: number;
    private _shadowOffsetY: number;
    private _shadowColor: number;
    private _shadowDilate: number;
    private _shadowSoftness: number;
    private _glowColor: number;
    private _glowOffset: number;
    private _glowInner: number;
    private _glowOuter: number;
    private _glowPower: number;
    private _faceDilate: number;
    private _bevelWidth: number;
    private _bevelOffset: number;
    private _bevelColor: number;
    private _outlineAlpha: number;
    private _shadowAlpha: number;
    private _glowAlpha: number;
    private _bevelAlpha: number;

    constructor(options: TMPTextStyleOptions = {}) {
        super();
        this._fontSize = options.fontSize ?? 32;
        this._fill = normalizeColor(options.fill ?? 0xffffff);
        this._fontFamily = options.fontFamily ?? '';
        this._fontStyle = options.fontStyle ?? '';
        this._align = options.align ?? 'left';
        this._verticalAlign = options.verticalAlign ?? 'top';
        this._containerHeight = options.containerHeight ?? 0;
        this._wordWrap = options.wordWrap ?? false;
        this._wordWrapWidth = options.wordWrapWidth ?? 400;
        this._breakWords = options.breakWords ?? false;
        this._lineHeight = options.lineHeight ?? 0;
        this._lineSpacingAdjustment = options.lineSpacingAdjustment ?? 0;
        this._letterSpacing = options.letterSpacing ?? 0;
        this._padding = options.padding ?? 0;
        this._wordSpacing = options.wordSpacing ?? 0;
        this._paragraphSpacing = options.paragraphSpacing ?? 0;
        this._characterSpacing = options.characterSpacing ?? 0;
        this._overflowMode = options.overflowMode ?? 'overflow';
        this._wordWrappingRatios = options.wordWrappingRatios ?? 0.4;
        this._sharpness = options.sharpness ?? 0;
        this._overrideColorTags = options.overrideColorTags ?? false;

        this._marginLeft = options.marginLeft ?? 0;
        this._marginTop = options.marginTop ?? 0;
        this._marginRight = options.marginRight ?? 0;
        this._marginBottom = options.marginBottom ?? 0;

        this._outlineWidth = options.outlineWidth ?? 0;
        this._outlineColor = normalizeColor(options.outlineColor ?? 0x000000);
        this._outlineSoftness = options.outlineSoftness ?? 0;
        this._shadowOffsetX = options.shadowOffsetX ?? 0;
        this._shadowOffsetY = options.shadowOffsetY ?? 0;
        this._shadowColor = normalizeColor(options.shadowColor ?? 0x000000);
        this._shadowDilate = options.shadowDilate ?? 0;
        this._shadowSoftness = options.shadowSoftness ?? 0.5;
        this._glowColor = normalizeColor(options.glowColor ?? 0x000000);
        this._glowOffset = options.glowOffset ?? 0;
        this._glowInner = options.glowInner ?? 0;
        this._glowOuter = options.glowOuter ?? 0;
        this._glowPower = options.glowPower ?? 1;
        this._faceDilate = options.faceDilate ?? 0;
        this._bevelWidth = options.bevelWidth ?? 0;
        this._bevelOffset = options.bevelOffset ?? 0.5;
        this._bevelColor = normalizeColor(options.bevelColor ?? 0xffffff);
        this._outlineAlpha = options.outlineAlpha ?? 1;
        this._shadowAlpha = options.shadowAlpha ?? 0.5;
        this._glowAlpha = options.glowAlpha ?? 1;
        this._bevelAlpha = options.bevelAlpha ?? 1;
    }

    private _emitUpdate(): void {
        this.emit('update', this);
    }

    // --- Getters/setters with change detection ---

    get fontSize(): number { return this._fontSize; }
    set fontSize(v: number) { if (this._fontSize !== v) { this._fontSize = v; this._emitUpdate(); } }

    get fill(): number { return this._fill; }
    set fill(v: string | number) {
        const n = normalizeColor(v);
        if (this._fill !== n) { this._fill = n; this._emitUpdate(); }
    }

    get fontFamily(): string { return this._fontFamily; }
    set fontFamily(v: string) { if (this._fontFamily !== v) { this._fontFamily = v; this._emitUpdate(); } }

    /** Base font style flags. Space-separated: 'bold', 'italic', 'underline', 'strikethrough'. */
    get fontStyle(): FontStyleString { return this._fontStyle; }
    set fontStyle(v: FontStyleString) { if (this._fontStyle !== v) { this._fontStyle = v; this._emitUpdate(); } }

    get align(): TextAlignment { return this._align; }
    set align(v: TextAlignment) { if (this._align !== v) { this._align = v; this._emitUpdate(); } }

    get verticalAlign(): VerticalAlignment { return this._verticalAlign; }
    set verticalAlign(v: VerticalAlignment) { if (this._verticalAlign !== v) { this._verticalAlign = v; this._emitUpdate(); } }

    get containerHeight(): number { return this._containerHeight; }
    set containerHeight(v: number) { if (this._containerHeight !== v) { this._containerHeight = v; this._emitUpdate(); } }

    get overflowMode(): OverflowMode { return this._overflowMode; }
    set overflowMode(v: OverflowMode) { if (this._overflowMode !== v) { this._overflowMode = v; this._emitUpdate(); } }

    get wordWrap(): boolean { return this._wordWrap; }
    set wordWrap(v: boolean) { if (this._wordWrap !== v) { this._wordWrap = v; this._emitUpdate(); } }

    get wordWrapWidth(): number { return this._wordWrapWidth; }
    set wordWrapWidth(v: number) { if (this._wordWrapWidth !== v) { this._wordWrapWidth = v; this._emitUpdate(); } }

    get breakWords(): boolean { return this._breakWords; }
    set breakWords(v: boolean) { if (this._breakWords !== v) { this._breakWords = v; this._emitUpdate(); } }

    get lineHeight(): number { return this._lineHeight; }
    set lineHeight(v: number) { if (this._lineHeight !== v) { this._lineHeight = v; this._emitUpdate(); } }

    /** Additive line spacing adjustment (added to computed line height). */
    get lineSpacingAdjustment(): number { return this._lineSpacingAdjustment; }
    set lineSpacingAdjustment(v: number) { if (this._lineSpacingAdjustment !== v) { this._lineSpacingAdjustment = v; this._emitUpdate(); } }

    get letterSpacing(): number { return this._letterSpacing; }
    set letterSpacing(v: number) { if (this._letterSpacing !== v) { this._letterSpacing = v; this._emitUpdate(); } }

    get padding(): number { return this._padding; }
    set padding(v: number) { if (this._padding !== v) { this._padding = v; this._emitUpdate(); } }

    get wordSpacing(): number { return this._wordSpacing; }
    set wordSpacing(v: number) { if (this._wordSpacing !== v) { this._wordSpacing = v; this._emitUpdate(); } }

    get paragraphSpacing(): number { return this._paragraphSpacing; }
    set paragraphSpacing(v: number) { if (this._paragraphSpacing !== v) { this._paragraphSpacing = v; this._emitUpdate(); } }

    /** Character spacing in em units (scales with font size, added on top of letterSpacing). */
    get characterSpacing(): number { return this._characterSpacing; }
    set characterSpacing(v: number) { if (this._characterSpacing !== v) { this._characterSpacing = v; this._emitUpdate(); } }

    get wordWrappingRatios(): number { return this._wordWrappingRatios; }
    set wordWrappingRatios(v: number) { if (this._wordWrappingRatios !== v) { this._wordWrappingRatios = v; this._emitUpdate(); } }

    get sharpness(): number { return this._sharpness; }
    set sharpness(v: number) { if (this._sharpness !== v) { this._sharpness = v; this._emitUpdate(); } }

    /** Override rich text color tags with the base fill color. */
    get overrideColorTags(): boolean { return this._overrideColorTags; }
    set overrideColorTags(v: boolean) { if (this._overrideColorTags !== v) { this._overrideColorTags = v; this._emitUpdate(); } }

    get marginLeft(): number { return this._marginLeft; }
    set marginLeft(v: number) { if (this._marginLeft !== v) { this._marginLeft = v; this._emitUpdate(); } }

    get marginTop(): number { return this._marginTop; }
    set marginTop(v: number) { if (this._marginTop !== v) { this._marginTop = v; this._emitUpdate(); } }

    get marginRight(): number { return this._marginRight; }
    set marginRight(v: number) { if (this._marginRight !== v) { this._marginRight = v; this._emitUpdate(); } }

    get marginBottom(): number { return this._marginBottom; }
    set marginBottom(v: number) { if (this._marginBottom !== v) { this._marginBottom = v; this._emitUpdate(); } }

    get outlineWidth(): number { return this._outlineWidth; }
    set outlineWidth(v: number) { if (this._outlineWidth !== v) { this._outlineWidth = v; this._emitUpdate(); } }

    get outlineColor(): number { return this._outlineColor; }
    set outlineColor(v: string | number) {
        const n = normalizeColor(v);
        if (this._outlineColor !== n) { this._outlineColor = n; this._emitUpdate(); }
    }

    get outlineSoftness(): number { return this._outlineSoftness; }
    set outlineSoftness(v: number) { if (this._outlineSoftness !== v) { this._outlineSoftness = v; this._emitUpdate(); } }

    get shadowOffsetX(): number { return this._shadowOffsetX; }
    set shadowOffsetX(v: number) { if (this._shadowOffsetX !== v) { this._shadowOffsetX = v; this._emitUpdate(); } }

    get shadowOffsetY(): number { return this._shadowOffsetY; }
    set shadowOffsetY(v: number) { if (this._shadowOffsetY !== v) { this._shadowOffsetY = v; this._emitUpdate(); } }

    get shadowColor(): number { return this._shadowColor; }
    set shadowColor(v: string | number) {
        const n = normalizeColor(v);
        if (this._shadowColor !== n) { this._shadowColor = n; this._emitUpdate(); }
    }

    get shadowDilate(): number { return this._shadowDilate; }
    set shadowDilate(v: number) { if (this._shadowDilate !== v) { this._shadowDilate = v; this._emitUpdate(); } }

    get shadowSoftness(): number { return this._shadowSoftness; }
    set shadowSoftness(v: number) { if (this._shadowSoftness !== v) { this._shadowSoftness = v; this._emitUpdate(); } }

    get glowColor(): number { return this._glowColor; }
    set glowColor(v: string | number) {
        const n = normalizeColor(v);
        if (this._glowColor !== n) { this._glowColor = n; this._emitUpdate(); }
    }

    get glowOffset(): number { return this._glowOffset; }
    set glowOffset(v: number) { if (this._glowOffset !== v) { this._glowOffset = v; this._emitUpdate(); } }

    get glowInner(): number { return this._glowInner; }
    set glowInner(v: number) { if (this._glowInner !== v) { this._glowInner = v; this._emitUpdate(); } }

    get glowOuter(): number { return this._glowOuter; }
    set glowOuter(v: number) { if (this._glowOuter !== v) { this._glowOuter = v; this._emitUpdate(); } }

    get glowPower(): number { return this._glowPower; }
    set glowPower(v: number) { if (this._glowPower !== v) { this._glowPower = v; this._emitUpdate(); } }

    get faceDilate(): number { return this._faceDilate; }
    set faceDilate(v: number) { if (this._faceDilate !== v) { this._faceDilate = v; this._emitUpdate(); } }

    get bevelWidth(): number { return this._bevelWidth; }
    set bevelWidth(v: number) { if (this._bevelWidth !== v) { this._bevelWidth = v; this._emitUpdate(); } }

    get bevelOffset(): number { return this._bevelOffset; }
    set bevelOffset(v: number) { if (this._bevelOffset !== v) { this._bevelOffset = v; this._emitUpdate(); } }

    get bevelColor(): number { return this._bevelColor; }
    set bevelColor(v: string | number) {
        const n = normalizeColor(v);
        if (this._bevelColor !== n) { this._bevelColor = n; this._emitUpdate(); }
    }

    get outlineAlpha(): number { return this._outlineAlpha; }
    set outlineAlpha(v: number) { if (this._outlineAlpha !== v) { this._outlineAlpha = v; this._emitUpdate(); } }

    get shadowAlpha(): number { return this._shadowAlpha; }
    set shadowAlpha(v: number) { if (this._shadowAlpha !== v) { this._shadowAlpha = v; this._emitUpdate(); } }

    get glowAlpha(): number { return this._glowAlpha; }
    set glowAlpha(v: number) { if (this._glowAlpha !== v) { this._glowAlpha = v; this._emitUpdate(); } }

    get bevelAlpha(): number { return this._bevelAlpha; }
    set bevelAlpha(v: number) { if (this._bevelAlpha !== v) { this._bevelAlpha = v; this._emitUpdate(); } }

    clone(): TMPTextStyle {
        return new TMPTextStyle({
            fontSize: this._fontSize,
            fill: this._fill,
            fontFamily: this._fontFamily,
            fontStyle: this._fontStyle,
            align: this._align,
            verticalAlign: this._verticalAlign,
            containerHeight: this._containerHeight,
            wordWrap: this._wordWrap,
            wordWrapWidth: this._wordWrapWidth,
            breakWords: this._breakWords,
            lineHeight: this._lineHeight,
            lineSpacingAdjustment: this._lineSpacingAdjustment,
            letterSpacing: this._letterSpacing,
            padding: this._padding,
            wordSpacing: this._wordSpacing,
            paragraphSpacing: this._paragraphSpacing,
            characterSpacing: this._characterSpacing,
            overflowMode: this._overflowMode,
            wordWrappingRatios: this._wordWrappingRatios,
            sharpness: this._sharpness,
            overrideColorTags: this._overrideColorTags,
            marginLeft: this._marginLeft,
            marginTop: this._marginTop,
            marginRight: this._marginRight,
            marginBottom: this._marginBottom,
            outlineWidth: this._outlineWidth,
            outlineColor: this._outlineColor,
            outlineSoftness: this._outlineSoftness,
            shadowOffsetX: this._shadowOffsetX,
            shadowOffsetY: this._shadowOffsetY,
            shadowColor: this._shadowColor,
            shadowDilate: this._shadowDilate,
            shadowSoftness: this._shadowSoftness,
            glowColor: this._glowColor,
            glowOffset: this._glowOffset,
            glowInner: this._glowInner,
            glowOuter: this._glowOuter,
            glowPower: this._glowPower,
            faceDilate: this._faceDilate,
            bevelWidth: this._bevelWidth,
            bevelOffset: this._bevelOffset,
            bevelColor: this._bevelColor,
            outlineAlpha: this._outlineAlpha,
            shadowAlpha: this._shadowAlpha,
            glowAlpha: this._glowAlpha,
            bevelAlpha: this._bevelAlpha,
        });
    }

    destroy(): void {
        this.removeAllListeners();
    }
}

/** Convert hex string or number to a numeric color. */
function normalizeColor(value: string | number): number {
    if (typeof value === 'number') return value;
    if (value.startsWith('#')) {
        return parseInt(value.slice(1), 16);
    }
    return parseInt(value, 16) || 0;
}
