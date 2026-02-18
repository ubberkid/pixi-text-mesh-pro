// Core
export { TMPText } from './core/TMPText';
export type { TMPTextOptions } from './core/TMPText';
export { TMPTextStyle } from './core/TMPTextStyle';
export type { TMPTextStyleOptions, FontStyleString, VerticalAlignment, OverflowMode } from './core/TMPTextStyle';
export { TMPTextPipe } from './core/TMPTextPipe';
export { TMPMaterial } from './core/TMPMaterial';
export type { TMPMaterialOptions } from './core/TMPMaterial';
export type {
    ParsedChar,
    CharacterInfo,
    LineInfo,
    WordInfo,
    LinkInfo,
    TextInfo,
    TextAlignment,
    DecorationSpan,
} from './core/types';

// Font
export { TMPFont } from './font/TMPFont';
export { loadTMPFont } from './font/TMPFontLoader';
export type {
    TMPFontData,
    TMPFontDataGlyph,
    TMPFontDataKerning,
    TMPFontDataPage,
    TMPFontDataDistanceField,
    TMPFontDataInfo,
    TMPFontDataSpriteSheet,
    TMPFontDataSpriteGlyph,
} from './font/TMPFontData';

// Parser
export { RichTextParser } from './parser/RichTextParser';
export { TagRegistry } from './parser/TagRegistry';
export { TagStack } from './parser/TagStack';

// Styles
export { TMPStyleSheet } from './styles/TMPStyleSheet';
export type { TMPStylePreset } from './styles/TMPStyleSheet';

// Shader
export { TMPShader } from './shader/TMPShader';

// Layout
export { TMPLayoutEngine } from './layout/TMPLayoutEngine';

// Sprites
export { InlineSpriteManager } from './sprites/InlineSpriteManager';
export type { InlineSpriteEntry, InlineSpriteAtlas } from './sprites/InlineSpriteData';

// Utils
export { hashCode } from './utils/hashCode';
export { parseColor, parseAlpha } from './utils/colorUtils';
export { parseUnit } from './utils/unitParser';
export { autoSizeFontSize } from './utils/autoSize';
