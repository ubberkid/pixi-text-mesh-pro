import type { Texture } from 'pixi.js';

/** Definition of a single inline sprite within an atlas. */
export interface InlineSpriteEntry {
    /** The sprite texture (sub-region of the atlas). */
    texture: Texture;
    /** Display width in pixels (0 = use texture width). */
    width: number;
    /** Display height in pixels (0 = use texture height). */
    height: number;
    /** Horizontal advance after this sprite (0 = use width). */
    xAdvance: number;
    /** Horizontal offset from the current position (default 0). */
    xOffset: number;
    /** Vertical offset from baseline. */
    yOffset: number;
}

/** A registered sprite atlas with named sprites. */
export interface InlineSpriteAtlas {
    /** The base atlas texture. */
    texture: Texture;
    /** Named sprites within this atlas. */
    sprites: Record<string, InlineSpriteEntry>;
}
