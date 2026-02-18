import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RichTextParser } from '../../src/parser/RichTextParser';
import { parseSpriteTag } from '../../src/parser/tags/SpriteTags';
import { InlineSpriteManager } from '../../src/sprites/InlineSpriteManager';
import { Texture } from 'pixi.js';

describe('Phase 3 Parser Tags', () => {
    const parser = new RichTextParser();
    const BASE_SIZE = 32;
    const BASE_COLOR = 0xffffff;
    const BASE_FONT = 'TestFont';

    function parse(text: string) {
        return parser.parse(text, BASE_SIZE, BASE_COLOR, BASE_FONT);
    }

    describe('<scale> tag', () => {
        it('should set charScale', () => {
            const result = parse('A<scale=2>B</scale>C');
            expect(result[0].charScale).toBe(1);
            expect(result[1].charScale).toBe(2);
            expect(result[2].charScale).toBe(1);
        });

        it('should handle nested scale', () => {
            const result = parse('<scale=2>A<scale=0.5>B</scale>C</scale>');
            expect(result[0].charScale).toBe(2);
            expect(result[1].charScale).toBe(0.5);
            expect(result[2].charScale).toBe(2);
        });

        it('should ignore invalid scale value', () => {
            const result = parse('<scale=abc>A</scale>');
            expect(result[0].charScale).toBe(1);
        });
    });

    describe('<rotate> tag', () => {
        it('should set rotation', () => {
            const result = parse('A<rotate=45>B</rotate>C');
            expect(result[0].rotation).toBe(0);
            expect(result[1].rotation).toBe(45);
            expect(result[2].rotation).toBe(0);
        });

        it('should handle negative rotation', () => {
            const result = parse('<rotate=-90>A</rotate>');
            expect(result[0].rotation).toBe(-90);
        });

        it('should handle nested rotate', () => {
            const result = parse('<rotate=45>A<rotate=90>B</rotate>C</rotate>');
            expect(result[0].rotation).toBe(45);
            expect(result[1].rotation).toBe(90);
            expect(result[2].rotation).toBe(45);
        });
    });

    describe('<sprite> tag', () => {
        it('should insert placeholder character with isSprite flag', () => {
            const result = parse('A<sprite name="coin">B');
            expect(result).toHaveLength(3);
            expect(result[0].char).toBe('A');
            expect(result[1].char).toBe('\uFFFC');
            expect(result[1].isSprite).toBe(true);
            expect(result[1].spriteName).toBe('coin');
            expect(result[2].char).toBe('B');
        });

        it('should parse atlas and sprite name', () => {
            const result = parse('<sprite="icons" name="heart">');
            expect(result).toHaveLength(1);
            expect(result[0].isSprite).toBe(true);
            expect(result[0].spriteAsset).toBe('icons');
            expect(result[0].spriteName).toBe('heart');
        });

        it('should parse shorthand sprite name', () => {
            const result = parse('<sprite="star">');
            expect(result).toHaveLength(1);
            expect(result[0].isSprite).toBe(true);
            expect(result[0].spriteAsset).toBe('');
            expect(result[0].spriteName).toBe('star');
        });

        it('should apply pending space to sprite', () => {
            const result = parse('<space=10><sprite name="coin">');
            expect(result[0].extraSpace).toBe(10);
        });

        it('should apply pending pos to sprite', () => {
            const result = parse('<pos=50><sprite name="coin">');
            expect(result[0].fixedPosition).toBe(50);
        });
    });

    describe('<link> and <a> tags', () => {
        it('should set link flag and linkId', () => {
            const result = parse('A<link="page1">B</link>C');
            expect(result[0].isLink).toBe(false);
            expect(result[1].isLink).toBe(true);
            expect(result[1].linkId).toBe('page1');
            expect(result[2].isLink).toBe(false);
        });

        it('should handle <a href="url"> tag', () => {
            const result = parse('<a href="https://example.com">Click</a>');
            expect(result).toHaveLength(5);
            for (const pc of result) {
                expect(pc.isLink).toBe(true);
                expect(pc.linkId).toBe('https://example.com');
            }
        });
    });
});

describe('parseSpriteTag', () => {
    it('should parse atlas and name attributes', () => {
        const result = parseSpriteTag('"icons" name="coin"');
        expect(result.atlasName).toBe('icons');
        expect(result.spriteName).toBe('coin');
    });

    it('should parse name attribute without atlas', () => {
        const result = parseSpriteTag('name="coin"');
        expect(result.atlasName).toBe('');
        expect(result.spriteName).toBe('coin');
    });

    it('should parse simple value as sprite name', () => {
        const result = parseSpriteTag('"star"');
        expect(result.atlasName).toBe('');
        expect(result.spriteName).toBe('star');
    });

    it('should handle unquoted values', () => {
        const result = parseSpriteTag('name=coin');
        expect(result.spriteName).toBe('coin');
    });
});

describe('InlineSpriteManager', () => {
    const mockTexture = Texture.WHITE;

    beforeEach(() => {
        InlineSpriteManager.clear();
    });

    afterEach(() => {
        InlineSpriteManager.clear();
    });

    it('should register and retrieve an atlas', () => {
        const atlas = {
            texture: mockTexture,
            sprites: {
                coin: { texture: mockTexture, width: 24, height: 24, xAdvance: 0, yOffset: 0 },
            },
        };
        InlineSpriteManager.register('icons', atlas);

        expect(InlineSpriteManager.has('icons')).toBe(true);
        expect(InlineSpriteManager.size).toBe(1);
        expect(InlineSpriteManager.getAtlas('icons')).toBe(atlas);
    });

    it('should be case-insensitive', () => {
        InlineSpriteManager.register('Icons', {
            texture: mockTexture,
            sprites: { coin: { texture: mockTexture, width: 24, height: 24, xAdvance: 0, yOffset: 0 } },
        });
        expect(InlineSpriteManager.has('icons')).toBe(true);
        expect(InlineSpriteManager.has('ICONS')).toBe(true);
    });

    it('should get a specific sprite from an atlas', () => {
        const entry = { texture: mockTexture, width: 24, height: 24, xAdvance: 0, yOffset: 0 };
        InlineSpriteManager.register('icons', {
            texture: mockTexture,
            sprites: { coin: entry },
        });
        expect(InlineSpriteManager.getSprite('icons', 'coin')).toBe(entry);
        expect(InlineSpriteManager.getSprite('icons', 'nonexistent')).toBeUndefined();
    });

    it('should find a sprite across all atlases', () => {
        const coinEntry = { texture: mockTexture, width: 24, height: 24, xAdvance: 0, yOffset: 0 };
        InlineSpriteManager.register('atlas1', {
            texture: mockTexture,
            sprites: { coin: coinEntry },
        });
        InlineSpriteManager.register('atlas2', {
            texture: mockTexture,
            sprites: { heart: { texture: mockTexture, width: 24, height: 24, xAdvance: 0, yOffset: 0 } },
        });

        expect(InlineSpriteManager.findSprite('coin')).toBe(coinEntry);
        expect(InlineSpriteManager.findSprite('heart')).toBeDefined();
        expect(InlineSpriteManager.findSprite('nonexistent')).toBeUndefined();
    });

    it('should unregister an atlas', () => {
        InlineSpriteManager.register('icons', { texture: mockTexture, sprites: {} });
        expect(InlineSpriteManager.unregister('icons')).toBe(true);
        expect(InlineSpriteManager.has('icons')).toBe(false);
        expect(InlineSpriteManager.unregister('icons')).toBe(false);
    });

    it('should create entries with automatic dimensions', () => {
        const entry = InlineSpriteManager.createEntry(mockTexture);
        expect(entry.texture).toBe(mockTexture);
        expect(entry.width).toBe(mockTexture.width);
        expect(entry.height).toBe(mockTexture.height);
        expect(entry.xAdvance).toBe(0);
        expect(entry.yOffset).toBe(0);
    });

    it('should create entries with overrides', () => {
        const entry = InlineSpriteManager.createEntry(mockTexture, { width: 48, height: 48, yOffset: -4 });
        expect(entry.width).toBe(48);
        expect(entry.height).toBe(48);
        expect(entry.yOffset).toBe(-4);
    });
});
