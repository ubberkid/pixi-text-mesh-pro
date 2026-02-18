/** Type definitions for the .tmpfont.json format. */

export interface TMPFontDataGlyph {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    xOffset: number;
    yOffset: number;
    xAdvance: number;
    page: number;
    /** Per-glyph scale factor (default 1.0). */
    scale?: number;
}

export interface TMPFontDataKerning {
    first: number;
    second: number;
    amount: number;
}

export interface TMPFontDataPage {
    id: number;
    file: string;
}

export interface TMPFontDataDistanceField {
    type: 'sdf' | 'msdf' | 'mtsdf' | 'none';
    range: number;
}

export interface TMPFontDataInfo {
    face: string;
    size: number;
    bold: boolean;
    italic: boolean;
    lineHeight: number;
    base: number;
    ascent: number;
    descent: number;
    scaleW: number;
    scaleH: number;
    /** Cap height line (used for SmallCaps). */
    capLine?: number;
    /** X-height (mean line). */
    meanLine?: number;
    /** Superscript vertical offset. */
    superscriptOffset?: number;
    /** Superscript size as fraction of base size (e.g., 0.5 = 50%). */
    superscriptSize?: number;
    /** Subscript vertical offset. */
    subscriptOffset?: number;
    /** Subscript size as fraction of base size. */
    subscriptSize?: number;
    /** Underline y position relative to baseline. */
    underlineOffset?: number;
    /** Underline thickness in pixels. */
    underlineThickness?: number;
    /** Strikethrough y position relative to baseline. */
    strikethroughOffset?: number;
    /** Strikethrough thickness in pixels. */
    strikethroughThickness?: number;
    /** Tab character width. */
    tabWidth?: number;
    /** Global font scale factor (default 1). */
    scale?: number;
    /** Bold style: extra dilate applied to bold glyphs (default 0.75). */
    boldStyle?: number;
    /** Bold spacing: extra advance per bold character in font units (default 7). */
    boldSpacing?: number;
}

export interface TMPFontDataSpriteGlyph {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    xOffset: number;
    yOffset: number;
    xAdvance: number;
}

export interface TMPFontDataSpriteSheet {
    file: string;
    glyphs: TMPFontDataSpriteGlyph[];
}

export interface TMPFontData {
    info: TMPFontDataInfo;
    distanceField: TMPFontDataDistanceField;
    pages: TMPFontDataPage[];
    glyphs: TMPFontDataGlyph[];
    kernings?: TMPFontDataKerning[];
    spriteSheets?: TMPFontDataSpriteSheet[];
    fallbackFonts?: string[];
}
