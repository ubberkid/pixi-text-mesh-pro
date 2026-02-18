import type { Texture } from 'pixi.js';

export type TextAlignment = 'left' | 'center' | 'right' | 'justified' | 'flush';

/** Per-character data after rich text parsing — carries resolved style state. */
export interface ParsedChar {
    /** The character string. */
    char: string;
    /** Unicode code point. */
    charCode: number;
    /** Index in the original raw text (before tag removal). */
    originalIndex: number;

    // --- Resolved style state ---
    color: number;
    alpha: number;
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    markColor: number;
    /** Mark padding [left, right, top, bottom] in pixels. Empty = no padding. */
    markPadding: number[];
    /** Character spacing override. */
    cspace: number;
    /** Monospace width override (0 = disabled). */
    mspace: number;
    /** Vertical offset from baseline. */
    voffset: number;
    /** Underline color override (for `<u color=#hex>`). -1 = use text color. */
    underlineColor: number;
    /** Strikethrough color override (for `<s color=#hex>`). -1 = use text color. */
    strikethroughColor: number;
    /** Italic angle in degrees (for `<i angle=N>`). */
    italicAngle: number;

    // --- Layout overrides ---
    /** Inline alignment override (empty string = inherit from style). */
    align: TextAlignment | '';
    /** Left indent in pixels. */
    indent: number;
    /** Left margin in pixels. */
    marginLeft: number;
    /** Right margin in pixels. */
    marginRight: number;
    /** Line-height override (0 = use default). */
    lineHeightOverride: number;

    // --- Case transforms ---
    isAllCaps: boolean;
    isLowercase: boolean;
    isSmallCaps: boolean;

    // --- Script ---
    isSuperscript: boolean;
    isSubscript: boolean;

    // --- Per-char transforms ---
    /** Scale multiplier (1 = normal). */
    charScale: number;
    /** Rotation in degrees. */
    rotation: number;

    // --- Flags ---
    isSprite: boolean;
    spriteAsset: string;
    spriteName: string;
    /** Sprite index for index-based lookup (-1 = use name). */
    spriteIndex: number;
    /** Sprite tint override (-1 = no tint). */
    spriteTint: number;
    isLink: boolean;
    linkId: string;
    isNoBreak: boolean;
    isLineBreak: boolean;
    /** Space insertion from <space=N> tag. */
    extraSpace: number;
    /** Fixed position from <pos=N> tag (NaN = not set). */
    fixedPosition: number;
    /** Fixed width constraint from <width=N> tag (0 = not set). */
    widthConstraint: number;
    /** Gradient colors [startColor, endColor] — empty array = no gradient. */
    gradientColors: number[];
    /** Font weight string (e.g. '400', '700', 'bold'). */
    fontWeight: string;
    /** Line indent in pixels (applied at text start and after explicit \n). */
    lineIndent: number;
    /** Material preset name (empty string = use base style). */
    material: string;
}

/** Per-character positioning and vertex data after layout. */
export interface CharacterInfo {
    /** Index into the ParsedChar array. */
    index: number;
    /** The character string (after case transforms). */
    char: string;
    /** Is this character visible (has a glyph)? */
    isVisible: boolean;
    /** Glyph texture for rendering. */
    texture: Texture | null;

    // --- Position ---
    /** X position (top-left of glyph quad). */
    x: number;
    /** Y position (top-left of glyph quad). */
    y: number;
    /** Width of the glyph quad. */
    width: number;
    /** Height of the glyph quad. */
    height: number;
    /** Scale applied to this character. */
    scale: number;

    // --- Style ---
    color: number;
    alpha: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    markColor: number;

    // --- Per-char transforms ---
    /** Per-character scale multiplier (from <scale> tag). */
    charScale: number;
    /** Per-character rotation in degrees (from <rotate> tag). */
    rotation: number;

    // --- Layout references ---
    lineIndex: number;
    wordIndex: number;

    // --- Unity TMP CharacterInfo fields ---
    /** Leftmost x position before kerning/spacing (for caret positioning). */
    origin: number;
    /** Cumulative horizontal advance after this character. */
    xAdvance: number;
    /** Glyph ascender for this character. */
    ascender: number;
    /** Glyph descender for this character. */
    descender: number;
    /** Whether this is a character or sprite element. */
    elementType: 'character' | 'sprite';
    /** Material preset name for this character (empty string = base style). */
    material: string;
}

/** Per-line metrics after layout. */
export interface LineInfo {
    /** Index of first CharacterInfo in this line. */
    firstCharIndex: number;
    /** Index of last CharacterInfo in this line (inclusive). */
    lastCharIndex: number;
    /** Number of characters in this line. */
    characterCount: number;
    /** Width of this line in pixels. */
    width: number;
    /** Height of this line in pixels. */
    height: number;
    /** Y position of this line's baseline. */
    baseline: number;
    /** Y position of this line's top. */
    y: number;
    /** Horizontal alignment offset applied. */
    alignmentOffset: number;
    /** Alignment used for this line. */
    alignment: TextAlignment;
    /** Number of spaces in this line (for justified alignment). */
    spaceCount: number;
    /** Max ascender on this line. */
    ascender: number;
    /** Max descender on this line. */
    descender: number;
    /** Index of first visible character in this line. */
    firstVisibleCharIndex: number;
    /** Index of last visible character in this line. */
    lastVisibleCharIndex: number;
    /** Number of visible characters in this line. */
    visibleCharacterCount: number;
    /** Maximum horizontal advance on this line. */
    maxAdvance: number;
}

/** Per-word info after layout. */
export interface WordInfo {
    firstCharIndex: number;
    lastCharIndex: number;
    characterCount: number;
    width: number;
    lineIndex: number;
}

/** Link region info after layout. */
export interface LinkInfo {
    /** The link ID or URL. */
    linkId: string;
    /** Index of first character in this link. */
    firstCharIndex: number;
    /** Index of last character in this link (inclusive). */
    lastCharIndex: number;
    /** Bounding rectangles for hit testing (one per line the link spans). */
    rects: { x: number; y: number; width: number; height: number }[];
}

/** Aggregate text layout information — the output of TMPLayoutEngine. */
export interface TextInfo {
    characterInfo: CharacterInfo[];
    lineInfo: LineInfo[];
    wordInfo: WordInfo[];
    linkInfo: LinkInfo[];
    characterCount: number;
    lineCount: number;
    wordCount: number;
    linkCount: number;
    /** Total width of the laid-out text. */
    width: number;
    /** Total height of the laid-out text. */
    height: number;
}

/** Decoration span for underline/strikethrough/mark rendering. */
export interface DecorationSpan {
    type: 'underline' | 'strikethrough' | 'mark';
    color: number;
    x: number;
    y: number;
    width: number;
    height: number;
    lineIndex: number;
}
