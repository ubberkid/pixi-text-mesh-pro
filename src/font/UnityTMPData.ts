/**
 * Type definitions for Unity TextMeshPro font data as extracted from .asset files.
 *
 * These mirror Unity's native data structures (without the m_ prefix).
 * A Python extraction script converts the .asset YAML + embedded atlas into
 * a clean JSON matching these types, plus a PNG atlas.
 *
 * The library's TMPFont.fromUnityData() handles all coordinate transforms:
 * - Y-flip (Unity bottom-left → PixiJS top-left)
 * - Glyph rect expansion by atlas padding (Unity stores tight bounds)
 * - Offset calculation from Unity bearings to BMFont-style offsets
 */

/** Face metrics from Unity's m_FaceInfo. */
export interface UnityTMPFaceInfo {
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

/** Per-glyph data from Unity's m_GlyphTable entries. */
export interface UnityTMPGlyph {
    index: number;
    metrics: {
        width: number;
        height: number;
        horizontalBearingX: number;
        horizontalBearingY: number;
        horizontalAdvance: number;
    };
    glyphRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    scale: number;
    atlasIndex: number;
}

/** Character-to-glyph mapping from Unity's m_CharacterTable entries. */
export interface UnityTMPCharacter {
    unicode: number;
    glyphIndex: number;
    scale: number;
}

/** Atlas configuration. */
export interface UnityTMPAtlasInfo {
    width: number;
    height: number;
    padding: number;
    renderMode: number;
}

/** Top-level structure for extracted Unity TMP font data. */
export interface UnityTMPData {
    faceInfo: UnityTMPFaceInfo;
    atlas: UnityTMPAtlasInfo;
    glyphTable: UnityTMPGlyph[];
    characterTable: UnityTMPCharacter[];
    kerningTable?: Array<{ first: number; second: number; amount: number }>;
    boldStyle?: number;
    boldSpacing?: number;
    /** Atlas page filenames relative to the JSON file (e.g. ["dimbo-sdf-atlas.png"]). */
    pages: string[];
}
