import type { Texture } from 'pixi.js';
import type { InlineSpriteAtlas, InlineSpriteEntry } from './InlineSpriteData';

/**
 * Manages inline sprite atlases for the `<sprite>` tag.
 *
 * Usage:
 * ```ts
 * InlineSpriteManager.register('icons', {
 *     texture: atlasTexture,
 *     sprites: {
 *         coin: { texture: coinTex, width: 24, height: 24, xAdvance: 0, xOffset: 0, yOffset: 0 },
 *         heart: { texture: heartTex, width: 24, height: 24, xAdvance: 0, xOffset: 0, yOffset: 0 },
 *     },
 * });
 *
 * // Then in rich text:
 * text.text = 'Earn <sprite="icons" name="coin"> gold!';
 * ```
 */
export class InlineSpriteManager {
    private static _atlases = new Map<string, InlineSpriteAtlas>();

    /** Register a sprite atlas by name. */
    static register(name: string, atlas: InlineSpriteAtlas): void {
        this._atlases.set(name.toLowerCase(), atlas);
    }

    /** Unregister a sprite atlas. */
    static unregister(name: string): boolean {
        return this._atlases.delete(name.toLowerCase());
    }

    /** Check if an atlas is registered. */
    static has(name: string): boolean {
        return this._atlases.has(name.toLowerCase());
    }

    /** Get a sprite atlas by name. */
    static getAtlas(name: string): InlineSpriteAtlas | undefined {
        return this._atlases.get(name.toLowerCase());
    }

    /**
     * Look up a sprite entry by atlas name and sprite name.
     * Returns undefined if the atlas or sprite doesn't exist.
     */
    static getSprite(atlasName: string, spriteName: string): InlineSpriteEntry | undefined {
        const atlas = this._atlases.get(atlasName.toLowerCase());
        if (!atlas) return undefined;
        return atlas.sprites[spriteName];
    }

    /**
     * Look up a sprite entry by sprite name across all atlases.
     * Searches atlases in registration order. Use this for `<sprite name="X">` without an atlas name.
     */
    static findSprite(spriteName: string): InlineSpriteEntry | undefined {
        for (const atlas of this._atlases.values()) {
            const entry = atlas.sprites[spriteName];
            if (entry) return entry;
        }
        return undefined;
    }

    /**
     * Look up a sprite by numeric index within a specific atlas.
     * Returns the Nth sprite in insertion order.
     */
    static getSpriteByIndex(atlasName: string, index: number): InlineSpriteEntry | undefined {
        const atlas = this._atlases.get(atlasName.toLowerCase());
        if (!atlas) return undefined;
        const entries = Object.values(atlas.sprites);
        return index >= 0 && index < entries.length ? entries[index] : undefined;
    }

    /**
     * Look up a sprite by numeric index across all atlases.
     * Counts sprites across atlases in registration order.
     */
    static findSpriteByIndex(index: number): InlineSpriteEntry | undefined {
        let offset = 0;
        for (const atlas of this._atlases.values()) {
            const entries = Object.values(atlas.sprites);
            if (index - offset < entries.length) {
                return entries[index - offset];
            }
            offset += entries.length;
        }
        return undefined;
    }

    /**
     * Create a sprite entry from a texture with automatic dimensions.
     * Convenience for registering simple sprites.
     */
    static createEntry(texture: Texture, overrides?: Partial<InlineSpriteEntry>): InlineSpriteEntry {
        return {
            texture,
            width: overrides?.width ?? texture.width,
            height: overrides?.height ?? texture.height,
            xAdvance: overrides?.xAdvance ?? 0,
            xOffset: overrides?.xOffset ?? 0,
            yOffset: overrides?.yOffset ?? 0,
        };
    }

    /** Clear all registered atlases. */
    static clear(): void {
        this._atlases.clear();
    }

    /** Number of registered atlases. */
    static get size(): number {
        return this._atlases.size;
    }
}
