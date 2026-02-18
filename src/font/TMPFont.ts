import { AbstractBitmapFont, Texture, Rectangle } from 'pixi.js';
import type { CharData } from 'pixi.js';
import type { TMPFontData, TMPFontDataSpriteSheet } from './TMPFontData';

/**
 * TMPFont extends PixiJS's AbstractBitmapFont with sprite sheet data for <sprite> tags
 * and a static converter for existing bitmap fonts.
 */
export class TMPFont extends AbstractBitmapFont<TMPFont> {
    /** Global font registry for fallback lookups. */
    private static _registry = new Map<string, TMPFont>();

    /** Register a font by name for fallback resolution. */
    static registerFont(name: string, font: TMPFont): void {
        this._registry.set(name.toLowerCase(), font);
    }

    /** Unregister a font by name. */
    static unregisterFont(name: string): boolean {
        return this._registry.delete(name.toLowerCase());
    }

    /** Get a registered font by name. */
    static getFont(name: string): TMPFont | undefined {
        return this._registry.get(name.toLowerCase());
    }

    /** Clear all registered fonts. */
    static clearRegistry(): void {
        this._registry.clear();
    }

    /** Sprite sheet data for inline <sprite> rendering. */
    spriteSheets: TMPFontDataSpriteSheet[] = [];

    /** Fallback font names to try when a glyph is missing. */
    fallbackFonts: string[] = [];

    // --- Font metric fields from Unity TMP_FontAsset ---
    /** Cap height line (used for SmallCaps). */
    capLine = 0;
    /** X-height (mean line). */
    meanLine = 0;
    /** Superscript vertical offset. */
    superscriptOffset = 0;
    /** Superscript size as fraction of base size (e.g., 0.5 = 50%). */
    superscriptSize = 0.5;
    /** Subscript vertical offset. */
    subscriptOffset = 0;
    /** Subscript size as fraction of base size. */
    subscriptSize = 0.5;
    /** Underline y position relative to baseline. */
    underlineOffset = 0;
    /** Underline thickness in pixels. */
    underlineThickness = 0;
    /** Strikethrough y position relative to baseline. */
    strikethroughOffset = 0;
    /** Strikethrough thickness in pixels. */
    strikethroughThickness = 0;
    /** Tab character width. */
    tabWidth = 0;
    /** Global font scale factor (default 1). */
    fontScale = 1;
    /** Bold weight: extra SDF dilate applied to bold characters (Unity default ~0.75). */
    boldStyle = 0.75;
    /** Bold spacing: extra advance in font units added per bold character (Unity default ~7). */
    boldSpacing = 7;

    /** Public accessor for the rendered font size (base class has it protected). */
    get renderedFontSize(): number {
        return this.baseRenderedFontSize;
    }

    /**
     * Look up char data, trying this font first, then fallback fonts.
     * Returns the char data and the font it was found in, or undefined.
     */
    getCharWithFallback(char: string, _visited?: Set<TMPFont>): { charData: CharData; font: TMPFont } | undefined {
        const charData = this.chars[char];
        if (charData) return { charData, font: this };

        const visited = _visited ?? new Set<TMPFont>();
        visited.add(this);

        for (const fbName of this.fallbackFonts) {
            const fb = TMPFont.getFont(fbName);
            if (fb && !visited.has(fb)) {
                const result = fb.getCharWithFallback(char, visited);
                if (result) return result;
            }
        }

        return undefined;
    }

    /**
     * Create a TMPFont from raw .tmpfont.json data + loaded page textures.
     */
    static fromData(data: TMPFontData, pageTextures: Texture[]): TMPFont {
        const font = new TMPFont();

        font._setFontInfo(data.info.face, data.info.lineHeight, data.info.size, data.info.base);
        (font.fontMetrics as { fontSize: number; ascent: number; descent: number }).fontSize = data.info.size;
        (font.fontMetrics as { ascent: number }).ascent = data.info.ascent;
        (font.fontMetrics as { descent: number }).descent = data.info.descent;
        font.baseRenderedFontSize = data.info.size;

        // Distance field
        (font as { distanceField: { type: string; range: number } }).distanceField = {
            type: data.distanceField.type,
            range: data.distanceField.range,
        };

        // Apply fill as tint for SDF fonts
        font.applyFillAsTint = true;

        // Pages
        for (let i = 0; i < pageTextures.length; i++) {
            (font.pages as { texture: Texture }[]).push({ texture: pageTextures[i] });
        }

        // Glyphs
        for (const glyph of data.glyphs) {
            const pageTexture = pageTextures[glyph.page];
            if (!pageTexture) continue;

            const charStr = String.fromCodePoint(glyph.id);
            const texture = new Texture({
                source: pageTexture.source,
                frame: new Rectangle(glyph.x, glyph.y, glyph.width, glyph.height),
            });

            (font.chars as Record<string, unknown>)[charStr] = {
                id: glyph.id,
                xOffset: glyph.xOffset,
                yOffset: glyph.yOffset,
                xAdvance: glyph.xAdvance,
                kerning: {} as Record<string, number>,
                texture,
            };
        }

        // Kerning pairs
        if (data.kernings) {
            for (const k of data.kernings) {
                const firstChar = String.fromCodePoint(k.first);
                const secondChar = String.fromCodePoint(k.second);
                const charData = font.chars[secondChar];
                if (charData) {
                    charData.kerning[firstChar] = k.amount;
                }
            }
        }

        // Font metric fields
        font.capLine = data.info.capLine ?? 0;
        font.meanLine = data.info.meanLine ?? 0;
        font.superscriptOffset = data.info.superscriptOffset ?? 0;
        font.superscriptSize = data.info.superscriptSize ?? 0.5;
        font.subscriptOffset = data.info.subscriptOffset ?? 0;
        font.subscriptSize = data.info.subscriptSize ?? 0.5;
        font.underlineOffset = data.info.underlineOffset ?? 0;
        font.underlineThickness = data.info.underlineThickness ?? 0;
        font.strikethroughOffset = data.info.strikethroughOffset ?? 0;
        font.strikethroughThickness = data.info.strikethroughThickness ?? 0;
        font.tabWidth = data.info.tabWidth ?? 0;
        font.fontScale = data.info.scale ?? 1;
        font.boldStyle = data.info.boldStyle ?? 0.75;
        font.boldSpacing = data.info.boldSpacing ?? 7;

        // Sprite sheets
        font.spriteSheets = data.spriteSheets ?? [];
        font.fallbackFonts = data.fallbackFonts ?? [];

        return font;
    }

    /**
     * Convert an existing PixiJS bitmap font (e.g. loaded from .fnt) into a TMPFont.
     * This is the primary way to use existing MSDF/SDF fonts with TMP features.
     */
    static fromBitmapFont(bitmapFont: AbstractBitmapFont<unknown>): TMPFont {
        const font = new TMPFont();

        font._setFontInfo(
            bitmapFont.fontFamily,
            bitmapFont.lineHeight,
            bitmapFont.baseMeasurementFontSize,
            bitmapFont.baseLineOffset,
        );
        (font.fontMetrics as { fontSize: number }).fontSize = bitmapFont.fontMetrics.fontSize;
        (font.fontMetrics as { ascent: number }).ascent = bitmapFont.fontMetrics.ascent;
        (font.fontMetrics as { descent: number }).descent = bitmapFont.fontMetrics.descent;

        // Access protected baseRenderedFontSize via unknown cast
        font.baseRenderedFontSize =
            (bitmapFont as unknown as { baseRenderedFontSize: number }).baseRenderedFontSize
            ?? bitmapFont.baseMeasurementFontSize;

        // Distance field
        (font as { distanceField: { type: string; range: number } }).distanceField = {
            type: bitmapFont.distanceField?.type ?? 'none',
            range: bitmapFont.distanceField?.range ?? 0,
        };

        font.applyFillAsTint = bitmapFont.applyFillAsTint;

        // Copy pages
        for (const page of bitmapFont.pages) {
            (font.pages as { texture: Texture }[]).push({ texture: page.texture });
        }

        // Copy char data (reference textures directly — no deep copy needed)
        for (const key in bitmapFont.chars) {
            (font.chars as Record<string, unknown>)[key] = bitmapFont.chars[key];
        }

        return font;
    }

    /** @internal Helper to set readonly font properties. */
    private _setFontInfo(family: string, lineHeight: number, baseSize: number, baseLineOffset: number): void {
        (this as { fontFamily: string }).fontFamily = family;
        (this as { lineHeight: number }).lineHeight = lineHeight;
        (this as { baseMeasurementFontSize: number }).baseMeasurementFontSize = baseSize;
        (this as { baseLineOffset: number }).baseLineOffset = baseLineOffset;
    }
}
