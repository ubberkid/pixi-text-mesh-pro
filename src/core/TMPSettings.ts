import type { TMPFont } from '../font/TMPFont';
import type { TMPStyleSheet } from '../styles/TMPStyleSheet';

/**
 * Global TMP settings — mirrors Unity's TMP Settings asset.
 *
 * Set once during initialization, before creating any TMPText:
 * ```ts
 * TMPSettings.defaultFont = myFont;
 * TMPSettings.defaultStyleSheet = myStyles;
 * TMPSettings.defaultFontSize = 36;
 * ```
 */
export class TMPSettings {

    // -- Font --

    /** Default font used when none is specified on TMPText. */
    static defaultFont: TMPFont | null = null;

    /** Default font size for new TMPText instances. */
    static defaultFontSize: number = 36;

    /** Default line spacing adjustment (additive, in pixels). Negative = tighter. */
    static defaultLineSpacing: number = 0;

    /** Fallback font assets tried when a glyph is missing. */
    static fallbackFontAssets: TMPFont[] = [];

    // -- Style --

    /** Default style sheet applied to all TMPText instances. */
    static defaultStyleSheet: TMPStyleSheet | null = null;

    /** Default material name on the default font (applied as base style). */
    static defaultMaterial: string | null = null;

    // -- Sprites --

    /** Default sprite asset name for `<sprite>` tags without an explicit asset. */
    static defaultSpriteAsset: string | null = null;

    // -- Text Behavior --

    /** Enable kerning by default. */
    static enableKerning: boolean = true;

    /** Enable rich text parsing by default. */
    static enableRichText: boolean = true;

    /** Enable escape character parsing (\\n, \\t, etc.). */
    static enableParseEscapeCharacters: boolean = true;

    /** Enable tinting on all inline sprites. */
    static enableTintAllSprites: boolean = false;

    /** Default text wrapping mode (0 = no wrap, 1 = normal). */
    static textWrappingMode: number = 1;

    /** Unicode for missing glyph replacement (0 = none). */
    static missingGlyphCharacter: number = 0;

    // -- Auto Size --

    /** Default auto-size minimum ratio. */
    static defaultAutoSizeMinRatio: number = 0.5;

    /** Default auto-size maximum ratio. */
    static defaultAutoSizeMaxRatio: number = 2;
}
