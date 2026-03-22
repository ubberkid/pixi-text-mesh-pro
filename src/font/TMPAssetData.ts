/**
 * Type definitions for TMP font asset data (.unitytmp.json format).
 *
 * These match the TextMeshPro font asset structure. A Python extraction
 * script converts .asset files into clean JSON matching these types.
 *
 * TMPFont.fromAssetData() handles all coordinate transforms:
 * - Y-flip (bottom-left origin → top-left origin)
 * - Glyph rect expansion by atlas padding (tight bounds → SDF spread)
 * - Offset calculation from bearings to BMFont-style offsets
 */

/** Face metrics (line height, ascent, descent, cap/mean lines, etc.). */
export interface FaceInfo {
    familyName: string;
    styleName: string;
    pointSize: number;
    scale: number;
    lineHeight: number;
    ascentLine: number;
    capLine: number;
    meanLine: number;
    baseline: number;
    descentLine: number;
    superscriptOffset: number;
    superscriptSize: number;
    subscriptOffset: number;
    subscriptSize: number;
    underlineOffset: number;
    underlineThickness: number;
    strikethroughOffset: number;
    strikethroughThickness: number;
    tabWidth: number;
}

/** Glyph metrics shared by both font glyphs and sprite glyphs. */
export interface GlyphMetrics {
    width: number;
    height: number;
    horizontalBearingX: number;
    horizontalBearingY: number;
    horizontalAdvance: number;
}

/** Glyph rect (position and size in atlas texture). */
export interface GlyphRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Per-glyph data from TMP m_GlyphTable entries. */
export interface Glyph {
    index: number;
    metrics: GlyphMetrics;
    glyphRect: GlyphRect;
    scale: number;
    atlasIndex: number;
}

/** Character-to-glyph mapping from TMP m_CharacterTable entries. */
export interface TMPCharacter {
    unicode: number;
    glyphIndex: number;
    scale: number;
}

/** Atlas configuration. */
export interface AtlasInfo {
    width: number;
    height: number;
    padding: number;
    renderMode: number;
}

/** Top-level structure for extracted TMP font asset data. */
export interface TMPFontAssetData {
    faceInfo: FaceInfo;
    atlas: AtlasInfo;
    glyphTable: Glyph[];
    characterTable: TMPCharacter[];
    kerningTable?: Array<{ first: number; second: number; amount: number }>;
    boldStyle?: number;
    boldSpacing?: number;
    /** Atlas page filenames relative to the JSON file (e.g. ["dimbo-sdf-atlas.png"]). */
    pages: string[];
}

// ---- Sprite Asset Types ----

/** Sprite character entry from TMP m_SpriteCharacterTable. */
export interface TMPSpriteCharacter {
    name: string;
    glyphIndex: number;
    scale: number;
}

/** Sprite glyph entry from TMP sprite m_GlyphTable. */
export interface TMPSpriteGlyph {
    index: number;
    metrics: GlyphMetrics;
    glyphRect: GlyphRect;
}

/** Sprite asset face info (often all zeros — falls back to font's face info). */
export interface SpriteFaceInfo {
    pointSize: number;
    scale: number;
    lineHeight: number;
    ascentLine: number;
    capLine: number;
    meanLine: number;
    baseline: number;
    descentLine: number;
}

/** Sprite atlas reference. */
export interface SpriteAtlasInfo {
    file: string;
    width: number;
    height: number;
}

/**
 * Top-level structure for extracted TMP sprite asset data.
 * Mirrors TMP_SpriteAsset structure.
 */
export interface TMPSpriteAssetData {
    faceInfo: SpriteFaceInfo;
    atlas: SpriteAtlasInfo;
    spriteCharacterTable: TMPSpriteCharacter[];
    spriteGlyphTable: TMPSpriteGlyph[];
}
