import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TMPLayoutEngine } from '../../src/layout/TMPLayoutEngine';
import { RichTextParser } from '../../src/parser/RichTextParser';
import { TMPTextStyle } from '../../src/core/TMPTextStyle';
import { InlineSpriteManager } from '../../src/sprites/InlineSpriteManager';
import { Texture } from 'pixi.js';

/**
 * Minimal mock font (same as existing layout tests).
 * Each character is 10px wide advance, 10x20 texture.
 */
function createMockFont() {
    const chars: Record<string, {
        id: number;
        xOffset: number;
        yOffset: number;
        xAdvance: number;
        kerning: Record<string, number>;
        texture: { orig: { width: number; height: number } } | null;
    }> = {};

    for (let i = 32; i <= 126; i++) {
        const ch = String.fromCodePoint(i);
        chars[ch] = {
            id: i,
            xOffset: 0,
            yOffset: 0,
            xAdvance: 10,
            kerning: {},
            texture: ch === ' ' ? null : { orig: { width: 10, height: 20 } },
        };
    }

    const font = {
        chars,
        baseMeasurementFontSize: 32,
        lineHeight: 40,
        baseLineOffset: 0,
        fontFamily: 'MockFont',
        fontMetrics: { fontSize: 32, ascent: 30, descent: 10 },
        distanceField: { type: 'msdf', range: 4 },
        applyFillAsTint: true,
        renderedFontSize: 32,
        pages: [],
        fallbackFonts: [] as string[],
        getCharWithFallback(char: string) {
            const charData = chars[char];
            return charData ? { charData, font } : undefined;
        },
    };
    return font as unknown as import('../../src/font/TMPFont').TMPFont;
}

describe('Phase 3 Layout', () => {
    const parser = new RichTextParser();
    const mockFont = createMockFont();

    function layout(text: string, styleOpts: Partial<import('../../src/core/TMPTextStyle').TMPTextStyleOptions> = {}) {
        const style = new TMPTextStyle({ fontSize: 32, ...styleOpts });
        const parsed = parser.parse(text, style.fontSize, 0xffffff, 'MockFont');
        return TMPLayoutEngine.layout(parsed, mockFont, style);
    }

    describe('LinkInfo', () => {
        it('should build link info for a simple link', () => {
            const info = layout('A<link="page1">BC</link>D');
            expect(info.linkCount).toBe(1);
            expect(info.linkInfo).toHaveLength(1);

            const link = info.linkInfo[0];
            expect(link.linkId).toBe('page1');
            expect(link.firstCharIndex).toBeGreaterThanOrEqual(0);
            expect(link.lastCharIndex).toBeGreaterThan(link.firstCharIndex);
            expect(link.rects).toHaveLength(1); // single line = single rect
        });

        it('should have correct bounding rect', () => {
            const info = layout('A<link="p">BC</link>D');
            const link = info.linkInfo[0];
            const rect = link.rects[0];

            // B and C are the linked characters
            const firstLinkedChar = info.characterInfo[link.firstCharIndex];
            const lastLinkedChar = info.characterInfo[link.lastCharIndex];

            expect(rect.x).toBe(firstLinkedChar.x);
            expect(rect.width).toBe(
                (lastLinkedChar.x + lastLinkedChar.width) - firstLinkedChar.x,
            );
        });

        it('should build multiple link regions', () => {
            const info = layout('<link="a">AB</link> <link="b">CD</link>');
            expect(info.linkCount).toBe(2);
            expect(info.linkInfo[0].linkId).toBe('a');
            expect(info.linkInfo[1].linkId).toBe('b');
        });

        it('should return empty link info when no links', () => {
            const info = layout('Hello World');
            expect(info.linkCount).toBe(0);
            expect(info.linkInfo).toHaveLength(0);
        });
    });

    describe('per-character transforms in layout', () => {
        it('should propagate charScale to CharacterInfo', () => {
            const info = layout('A<scale=2>B</scale>C');
            const charA = info.characterInfo.find(c => c.char === 'A');
            const charB = info.characterInfo.find(c => c.char === 'B');
            const charC = info.characterInfo.find(c => c.char === 'C');

            expect(charA?.charScale).toBe(1);
            expect(charB?.charScale).toBe(2);
            expect(charC?.charScale).toBe(1);
        });

        it('should propagate rotation to CharacterInfo', () => {
            const info = layout('A<rotate=45>B</rotate>C');
            const charA = info.characterInfo.find(c => c.char === 'A');
            const charB = info.characterInfo.find(c => c.char === 'B');
            const charC = info.characterInfo.find(c => c.char === 'C');

            expect(charA?.rotation).toBe(0);
            expect(charB?.rotation).toBe(45);
            expect(charC?.rotation).toBe(0);
        });
    });

    describe('inline sprites in layout', () => {
        const mockTexture = Texture.WHITE;

        beforeEach(() => {
            InlineSpriteManager.clear();
            InlineSpriteManager.register('icons', {
                texture: mockTexture,
                sprites: {
                    coin: {
                        texture: mockTexture,
                        width: 24,
                        height: 24,
                        xAdvance: 0,
                        yOffset: 0,
                    },
                },
            });
        });

        afterEach(() => {
            InlineSpriteManager.clear();
        });

        it('should include sprite in character info', () => {
            const info = layout('A<sprite="icons" name="coin">B');
            // A + sprite + B = 3 characters
            expect(info.characterCount).toBe(3);

            const spriteChar = info.characterInfo[1];
            expect(spriteChar.char).toBe('\uFFFC');
            expect(spriteChar.isVisible).toBe(true);
        });

        it('should size sprite based on font scale', () => {
            const info = layout('<sprite="icons" name="coin">');
            const spriteChar = info.characterInfo[0];

            // At fontSize=32 and baseMeasurementFontSize=32, scale is 1
            // sprite width=24, height=24
            expect(spriteChar.width).toBe(24);
            expect(spriteChar.height).toBe(24);
        });

        it('should advance cursor after sprite', () => {
            const info = layout('A<sprite="icons" name="coin">B');
            const charA = info.characterInfo.find(c => c.char === 'A');
            const charB = info.characterInfo.find(c => c.char === 'B');

            // A at x=0, advance=10, sprite at x=10, advance=24, B at x=34
            expect(charA!.x).toBe(0);
            expect(charB!.x).toBeGreaterThan(charA!.x + 10);
        });
    });
});
