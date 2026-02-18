import { describe, it, expect } from 'vitest';
import { TMPLayoutEngine } from '../../src/layout/TMPLayoutEngine';
import { RichTextParser } from '../../src/parser/RichTextParser';
import { TMPTextStyle } from '../../src/core/TMPTextStyle';
import type { ParsedChar } from '../../src/core/types';

/**
 * Minimal mock font that satisfies the layout engine's needs.
 * Each character is 10px wide, 20px tall, with simple fixed metrics.
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

    // Create entries for ASCII a-z, A-Z, 0-9, space
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

describe('TMPLayoutEngine', () => {
    const parser = new RichTextParser();
    const mockFont = createMockFont();

    function layout(text: string, styleOpts: Partial<import('../../src/core/TMPTextStyle').TMPTextStyleOptions> = {}) {
        const style = new TMPTextStyle({ fontSize: 32, ...styleOpts });
        const parsed = parser.parse(text, style.fontSize, 0xffffff, 'MockFont');
        return TMPLayoutEngine.layout(parsed, mockFont, style);
    }

    describe('basic layout', () => {
        it('should layout single word', () => {
            const info = layout('Hello');
            expect(info.characterCount).toBe(5);
            expect(info.lineCount).toBe(1);
            expect(info.wordCount).toBe(1);
        });

        it('should layout multiple words', () => {
            const info = layout('Hello World');
            expect(info.characterCount).toBe(11);
            expect(info.wordCount).toBe(2);
        });

        it('should handle empty string', () => {
            const info = layout('');
            expect(info.characterCount).toBe(0);
            expect(info.lineCount).toBe(0);
            expect(info.width).toBe(0);
            expect(info.height).toBe(0);
        });
    });

    describe('word wrap', () => {
        it('should wrap words that exceed width', () => {
            // "Hello World" = 11 chars * 10px each = 110px. Wrap at 60.
            const info = layout('Hello World', { wordWrap: true, wordWrapWidth: 60 });
            expect(info.lineCount).toBe(2);
        });

        it('should not wrap if disabled', () => {
            const info = layout('Hello World', { wordWrap: false });
            expect(info.lineCount).toBe(1);
        });
    });

    describe('line breaks', () => {
        it('should create new line on \\n', () => {
            const info = layout('A\nB');
            expect(info.lineCount).toBe(2);
        });

        it('should create new line on <br> tag', () => {
            const info = layout('A<br>B');
            expect(info.lineCount).toBe(2);
        });
    });

    describe('alignment', () => {
        it('should center align text', () => {
            // "Hi" = 2 visible chars * 10px = 20px, "AB" = 20px. Max width = 20.
            // "Hi" is already 20px so center offset = 0.
            // Use different length lines to test
            const info = layout('Hi\nA', { align: 'center' });
            // Both lines should be laid out. "Hi" is 20px, "A" is 10px.
            // maxWidth should be 20 (first line).
            // Second line offset should be (20-10)/2 = 5.
            expect(info.lineInfo[1].alignmentOffset).toBe(5);
        });

        it('should right align text', () => {
            const info = layout('Hi\nA', { align: 'right' });
            expect(info.lineInfo[1].alignmentOffset).toBe(10);
        });
    });

    describe('justified alignment', () => {
        it('should distribute extra space among word spaces', () => {
            // "A B" on first line with wrap, then more text on second line
            // With wrap width = 40, "A B C D" should wrap.
            // Justified mode should distribute extra space on non-last lines.
            const info = layout('A B\nC', { align: 'justified' });
            // "A B" has 1 space, maxWidth = 30 (A=10 + space=10 + B=10).
            // Line 1 is not last (line 2 = "C"), so justified should apply.
            // But "A B" already fills its own width = 30, and "C" = 10.
            // maxWidth = 30, line "A B" width = 30, so extraSpace = 0.
            // Nothing to distribute — this just tests it doesn't crash.
            expect(info.lineCount).toBe(2);
        });
    });

    describe('decorations', () => {
        it('should build underline spans', () => {
            const style = new TMPTextStyle({ fontSize: 32 });
            const parsed = parser.parse('A<u>BC</u>D', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            const decorations = TMPLayoutEngine.buildDecorations(info, mockFont, 32);

            const underlines = decorations.filter(d => d.type === 'underline');
            expect(underlines).toHaveLength(1);
            expect(underlines[0].width).toBeGreaterThan(0);
        });

        it('should build strikethrough spans', () => {
            const style = new TMPTextStyle({ fontSize: 32 });
            const parsed = parser.parse('A<s>BC</s>D', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            const decorations = TMPLayoutEngine.buildDecorations(info, mockFont, 32);

            const strikes = decorations.filter(d => d.type === 'strikethrough');
            expect(strikes).toHaveLength(1);
        });

        it('should build mark spans', () => {
            const style = new TMPTextStyle({ fontSize: 32 });
            const parsed = parser.parse('A<mark=#ffcc00>BC</mark>D', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            const decorations = TMPLayoutEngine.buildDecorations(info, mockFont, 32);

            const marks = decorations.filter(d => d.type === 'mark');
            expect(marks).toHaveLength(1);
            expect(marks[0].color).toBe(0xffcc00);
        });

        it('should return empty for no decorations', () => {
            const style = new TMPTextStyle({ fontSize: 32 });
            const parsed = parser.parse('Hello', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            const decorations = TMPLayoutEngine.buildDecorations(info, mockFont, 32);

            expect(decorations).toHaveLength(0);
        });
    });

    describe('per-char features', () => {
        it('should apply extra space from <space> tag', () => {
            const style = new TMPTextStyle({ fontSize: 32 });
            const parsed = parser.parse('A<space=20>B', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            // B should be offset by the extra space
            const aInfo = info.characterInfo[0];
            const bInfo = info.characterInfo[1];
            // B's x should be > A's x + A's advance + extraSpace
            expect(bInfo.x).toBeGreaterThan(aInfo.x + 20);
        });

        it('should apply fixed position from <pos> tag', () => {
            const style = new TMPTextStyle({ fontSize: 32 });
            const parsed = parser.parse('A<pos=100>B', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            const bInfo = info.characterInfo[1];
            // B should be positioned at 100px
            expect(bInfo.x).toBe(100);
        });
    });

    describe('nobr regions', () => {
        it('should not break inside <nobr> region', () => {
            // Without nobr, "Hello World" at wrapWidth=80 would break at the space
            // Each char is 10px wide, so "Hello" = 50px, space = 10px, "World" = 50px = 110px total
            const style = new TMPTextStyle({ fontSize: 32, wordWrap: true, wordWrapWidth: 80 });
            const parsed = parser.parse('<nobr>Hello World</nobr>', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            // All chars should be on line 0 (no break allowed)
            for (let i = 0; i < info.characterCount; i++) {
                expect(info.characterInfo[i].lineIndex).toBe(0);
            }
            expect(info.lineCount).toBe(1);
        });

        it('should allow break outside <nobr> region', () => {
            // "AA <nobr>BB CC</nobr> DD" — break can happen before nobr or after, but not inside
            const style = new TMPTextStyle({ fontSize: 32, wordWrap: true, wordWrapWidth: 80 });
            const parsed = parser.parse('AA <nobr>BB CC</nobr> DD', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            // Should have more than 1 line since total width exceeds 80
            expect(info.lineCount).toBeGreaterThan(1);
        });
    });

    describe('width constraint', () => {
        it('should wrap at width constraint instead of style wordWrapWidth', () => {
            // Style allows 200px but <width=60> constrains to 60px
            const style = new TMPTextStyle({ fontSize: 32, wordWrap: true, wordWrapWidth: 200 });
            const parsed = parser.parse('<width=60>Hello World</width>', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            // "Hello" = 50px fits in 60px, "World" = 50px would push to 110px, must wrap
            expect(info.lineCount).toBe(2);
        });
    });

    describe('vertical alignment', () => {
        it('should not offset when verticalAlign is top', () => {
            const info = layout('Hello', { verticalAlign: 'top', containerHeight: 200 });
            // First char should be at baseLineOffset (0 in mock)
            expect(info.characterInfo[0].y).toBe(0);
        });

        it('should center vertically within containerHeight', () => {
            const info = layout('Hi', { verticalAlign: 'middle', containerHeight: 200 });
            // Total text height is one line: baseLineHeight = fontLineHeight * (32/32) = 40
            // yOffset = (200 - 40) / 2 = 80
            expect(info.characterInfo[0].y).toBe(80);
        });

        it('should bottom align within containerHeight', () => {
            const info = layout('Hi', { verticalAlign: 'bottom', containerHeight: 200 });
            // yOffset = 200 - 40 = 160
            expect(info.characterInfo[0].y).toBe(160);
        });

        it('should not offset when containerHeight is 0', () => {
            const info = layout('Hi', { verticalAlign: 'middle', containerHeight: 0 });
            expect(info.characterInfo[0].y).toBe(0);
        });
    });

    describe('overflow modes', () => {
        it('should truncate lines that exceed containerHeight', () => {
            // With mock font: ascender=30, descender=-20, dynamic line height = 50px, line.height = 40px
            // Line 0: y=0, y+h=40. Line 1: y=50, y+h=90. Line 2: y=100, y+h=140.
            // Container = 95px -> 2 lines fit (90 <= 95), 3rd doesn't (140 > 95)
            const info = layout('A\nB\nC', { containerHeight: 95, overflowMode: 'truncate' });
            expect(info.lineCount).toBe(2);
            // 'C' should be gone — only A, \n, B, \n remain or A, \n, B
            const visibleChars = info.characterInfo.map(c => c.char).filter(c => c !== '\n');
            expect(visibleChars).toContain('A');
            expect(visibleChars).toContain('B');
            expect(visibleChars).not.toContain('C');
        });

        it('should not truncate when content fits', () => {
            const info = layout('AB', { containerHeight: 200, overflowMode: 'truncate' });
            expect(info.lineCount).toBe(1);
            expect(info.characterCount).toBe(2);
        });

        it('should add ellipsis when overflowMode is ellipsis', () => {
            // Container = 95px -> 2 lines fit, 3rd truncated with ellipsis
            const info = layout('A\nB\nC', { containerHeight: 95, overflowMode: 'ellipsis' });
            // Should have ellipsis character somewhere
            const hasEllipsis = info.characterInfo.some(c => c.char === '\u2026' || c.char === '.');
            expect(hasEllipsis).toBe(true);
        });

        it('should not modify when overflowMode is overflow', () => {
            const info = layout('A\nB\nC', { containerHeight: 80, overflowMode: 'overflow' });
            expect(info.lineCount).toBe(3);
        });
    });

    describe('fontStyle wrapping', () => {
        it('should parse text with fontStyle bold applied via TMPText wrapper', () => {
            // fontStyle is applied by TMPText wrapping the text, not by the layout engine.
            // We can test the parser directly with the same wrapping logic.
            const style = new TMPTextStyle({ fontSize: 32 });
            const parsed = parser.parse('<b>Hello</b>', 32, 0xffffff, 'MockFont');
            const info = TMPLayoutEngine.layout(parsed, mockFont, style);
            expect(info.characterInfo[0].bold).toBe(true);
        });
    });
});
