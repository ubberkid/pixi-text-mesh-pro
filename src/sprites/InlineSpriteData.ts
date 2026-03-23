import type { Texture } from 'pixi.js';
import type { SpriteFaceInfo } from '../font/TMPAssetData';

/** Definition of a single inline sprite within an atlas. */
export interface InlineSpriteEntry {
    /** The sprite texture (sub-region of the atlas). */
    texture: Texture;
    /** Glyph metrics width in font units. */
    width: number;
    /** Glyph metrics height in font units. */
    height: number;
    /** Horizontal advance in font units (0 = use width). */
    xAdvance: number;
    /** Horizontal bearing X in font units. */
    xOffset: number;
    /** Horizontal bearing Y in font units (distance from baseline to top). */
    yOffset: number;
    /** Per-sprite scale multiplier (default 1). */
    scale?: number;
}

/** A registered sprite atlas with named sprites. */
export interface InlineSpriteAtlas {
    /** The base atlas texture. */
    texture: Texture;
    /** Named sprites within this atlas. */
    sprites: Record<string, InlineSpriteEntry>;
    /** Sprite asset face info (used for scaling). When pointSize is 0, layout engine scales by font ascent / sprite height. */
    faceInfo?: SpriteFaceInfo;
}
