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
export const TMPSettings = {

    // -- Font --

    /** Default font used when none is specified on TMPText. */
    defaultFont: null as TMPFont | null,

    /** Default font size for new TMPText instances. */
    defaultFontSize: 36,

    /** Default line spacing adjustment (em-scaled). Negative = tighter. */
    defaultLineSpacing: 0,

    /** Default character spacing (em-scaled). Positive = wider. */
    defaultCharacterSpacing: 0,

    /** Fallback font assets tried when a glyph is missing. */
    fallbackFontAssets: [] as TMPFont[],

    // -- Style --

    /** Default style sheet applied to all TMPText instances. */
    defaultStyleSheet: null as TMPStyleSheet | null,

    /** Default material name on the default font (applied as base style). */
    defaultMaterial: null as string | null,

    // -- Sprites --

    /** Default sprite asset name for `<sprite>` tags without an explicit asset. */
    defaultSpriteAsset: null as string | null,

    // -- Text Behavior --

    /** Enable kerning by default. */
    enableKerning: true,

    /** Enable rich text parsing by default. */
    enableRichText: true,

    /** Enable escape character parsing (\\n, \\t, etc.). */
    enableParseEscapeCharacters: true,

    /** Enable tinting on all inline sprites. */
    enableTintAllSprites: false,

    /** Default text wrapping mode (0 = no wrap, 1 = normal). */
    textWrappingMode: 1,

    /** Unicode for missing glyph replacement (0 = none). */
    missingGlyphCharacter: 0,

    // -- Auto Size --

    /** Default auto-size minimum ratio. */
    defaultAutoSizeMinRatio: 0.5,

    /** Default auto-size maximum ratio. */
    defaultAutoSizeMaxRatio: 2,
};
