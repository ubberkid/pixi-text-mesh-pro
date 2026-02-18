import { describe, it, expect } from 'vitest';
import { TMPLayoutEngine } from '../../src/layout/TMPLayoutEngine';
import { RichTextParser } from '../../src/parser/RichTextParser';
import { TMPTextStyle } from '../../src/core/TMPTextStyle';
import { InlineSpriteManager } from '../../src/sprites/InlineSpriteManager';
import { autoSizeFontSize } from '../../src/utils/autoSize';

/**
 * Minimal mock font — each character is 10px wide, 20px tall.
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

describe('Phase 5c Layout', () => {
    const parser = new RichTextParser();
    const mockFont = createMockFont();

    function layout(text: string, styleOpts: Partial<import('../../src/core/TMPTextStyle').TMPTextStyleOptions> = {}) {
        const style = new TMPTextStyle({ fontSize: 32, ...styleOpts });
        const parsed = parser.parse(text, style.fontSize, 0xffffff, 'MockFont');
        return TMPLayoutEngine.layout(parsed, mockFont, style);
    }

    // --- Group 4: wordSpacing ---

    describe('wordSpacing', () => {
        it('should add extra space between words', () => {
            const noSpacing = layout('A B');
            const withSpacing = layout('A B', { wordSpacing: 20 });
            // With wordSpacing=20, the 'B' should be 20px further right
            const noSpacingB = noSpacing.characterInfo[2]; // 'B' is at index 2 (A, space, B)
            const withSpacingB = withSpacing.characterInfo[2];
            expect(withSpacingB.x - noSpacingB.x).toBe(20);
        });

        it('should not affect single-word text', () => {
            const noSpacing = layout('Hello');
            const withSpacing = layout('Hello', { wordSpacing: 50 });
            expect(withSpacing.width).toBe(noSpacing.width);
        });
    });

    // --- Group 4: paragraphSpacing ---

    describe('paragraphSpacing', () => {
        it('should add extra vertical space after explicit line breaks', () => {
            const noSpacing = layout('A\nB');
            const withSpacing = layout('A\nB', { paragraphSpacing: 15 });
            // paragraphSpacing is in em units: value * fontSize * 0.01
            // With fontSize=32: 15 * 32 * 0.01 = 4.8
            const noLine2Y = noSpacing.lineInfo[1].y;
            const withLine2Y = withSpacing.lineInfo[1].y;
            expect(withLine2Y - noLine2Y).toBeCloseTo(4.8, 5);
        });
    });

    // --- Group 5c: line-indent ---

    describe('lineIndent', () => {
        it('should indent the first line', () => {
            const info = layout('<line-indent=25>Hello</line-indent>');
            expect(info.characterInfo[0].x).toBe(25);
        });

        it('should indent after explicit \\n break', () => {
            const info = layout('<line-indent=25>Hello\nWorld</line-indent>');
            // Find 'W' (start of second line)
            const wChar = info.characterInfo.find(c => c.char === 'W')!;
            expect(wChar.x).toBe(25);
        });

        it('should NOT indent word-wrapped continuation lines', () => {
            // "Hello World" at wrapWidth=60 wraps after "Hello".
            // Only first line should get indent, not the wrapped line.
            const info = layout('<line-indent=5>Hello World</line-indent>', {
                wordWrap: true,
                wordWrapWidth: 65, // "Hello" = 50px + indent 5 = 55, fits. "Hello " = 60 + 5 = 65, but "World" would push to 115.
            });
            // Find 'W' — start of second line (wrapped)
            const wChar = info.characterInfo.find(c => c.char === 'W')!;
            // Word-wrapped line should NOT have indent applied
            expect(wChar.x).toBe(0);
        });
    });

    // --- Group 3: Sprite index lookup ---

    describe('sprite index-based lookup', () => {
        it('should support getSpriteByIndex', () => {
            const mockTexture = { width: 16, height: 16, orig: { width: 16, height: 16 } } as any;
            InlineSpriteManager.register('test-atlas', {
                texture: mockTexture,
                sprites: {
                    first: { texture: mockTexture, width: 16, height: 16, xAdvance: 0, yOffset: 0 },
                    second: { texture: mockTexture, width: 16, height: 16, xAdvance: 0, yOffset: 0 },
                },
            });

            const entry = InlineSpriteManager.getSpriteByIndex('test-atlas', 0);
            expect(entry).toBeDefined();

            const entry1 = InlineSpriteManager.getSpriteByIndex('test-atlas', 1);
            expect(entry1).toBeDefined();

            const entry2 = InlineSpriteManager.getSpriteByIndex('test-atlas', 2);
            expect(entry2).toBeUndefined();

            InlineSpriteManager.clear();
        });

        it('should support findSpriteByIndex across atlases', () => {
            const mockTexture = { width: 16, height: 16, orig: { width: 16, height: 16 } } as any;
            InlineSpriteManager.register('atlas-a', {
                texture: mockTexture,
                sprites: {
                    a1: { texture: mockTexture, width: 16, height: 16, xAdvance: 0, yOffset: 0 },
                },
            });
            InlineSpriteManager.register('atlas-b', {
                texture: mockTexture,
                sprites: {
                    b1: { texture: mockTexture, width: 16, height: 16, xAdvance: 0, yOffset: 0 },
                },
            });

            // Index 0 = first sprite in atlas-a
            expect(InlineSpriteManager.findSpriteByIndex(0)).toBeDefined();
            // Index 1 = first sprite in atlas-b
            expect(InlineSpriteManager.findSpriteByIndex(1)).toBeDefined();
            // Index 2 = out of range
            expect(InlineSpriteManager.findSpriteByIndex(2)).toBeUndefined();

            InlineSpriteManager.clear();
        });
    });

    // --- Group 4: TMPTextStyle wordSpacing/paragraphSpacing ---

    describe('TMPTextStyle wordSpacing/paragraphSpacing', () => {
        it('should have default values of 0', () => {
            const style = new TMPTextStyle();
            expect(style.wordSpacing).toBe(0);
            expect(style.paragraphSpacing).toBe(0);
        });

        it('should accept values in constructor', () => {
            const style = new TMPTextStyle({ wordSpacing: 10, paragraphSpacing: 20 });
            expect(style.wordSpacing).toBe(10);
            expect(style.paragraphSpacing).toBe(20);
        });

        it('should emit update on change', () => {
            const style = new TMPTextStyle();
            let updated = false;
            style.on('update', () => { updated = true; });
            style.wordSpacing = 5;
            expect(updated).toBe(true);
        });

        it('should not emit update when same value', () => {
            const style = new TMPTextStyle({ wordSpacing: 5 });
            let updated = false;
            style.on('update', () => { updated = true; });
            style.wordSpacing = 5;
            expect(updated).toBe(false);
        });

        it('should clone correctly', () => {
            const style = new TMPTextStyle({ wordSpacing: 15, paragraphSpacing: 25 });
            const cloned = style.clone();
            expect(cloned.wordSpacing).toBe(15);
            expect(cloned.paragraphSpacing).toBe(25);
        });
    });

    // --- Group 6: Auto-sizing ---

    describe('autoSizeFontSize', () => {
        it('should find a font size that fits within container', () => {
            const style = new TMPTextStyle({ fontSize: 32, wordWrap: true, wordWrapWidth: 200 });
            const size = autoSizeFontSize('Hello World', mockFont, style, 200, 100);
            expect(size).toBeGreaterThanOrEqual(1);
            expect(size).toBeLessThanOrEqual(500);
        });

        it('should converge: text fits at result but not at result+1', () => {
            const style = new TMPTextStyle({ fontSize: 32, wordWrap: true, wordWrapWidth: 100 });
            const size = autoSizeFontSize('Hello World Test', mockFont, style, 100, 100, 1, 64);
            // Size should be in range [1, 64]
            expect(size).toBeGreaterThanOrEqual(1);
            expect(size).toBeLessThanOrEqual(64);
        });

        it('should respect min/max bounds', () => {
            const style = new TMPTextStyle({ fontSize: 32, wordWrap: true, wordWrapWidth: 200 });
            const size = autoSizeFontSize('Hi', mockFont, style, 200, 200, 10, 50);
            expect(size).toBeGreaterThanOrEqual(10);
            expect(size).toBeLessThanOrEqual(50);
        });
    });
});
