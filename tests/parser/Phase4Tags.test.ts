import { describe, it, expect } from 'vitest';
import { RichTextParser } from '../../src/parser/RichTextParser';

describe('Phase 4 Parser Tags', () => {
    const parser = new RichTextParser();
    const BASE_SIZE = 32;
    const BASE_COLOR = 0xffffff;
    const BASE_FONT = 'TestFont';

    function parse(text: string) {
        return parser.parse(text, BASE_SIZE, BASE_COLOR, BASE_FONT);
    }

    describe('<gradient> tag', () => {
        it('should interpolate colors across characters', () => {
            const result = parse('<gradient=#ff0000,#0000ff>ABC</gradient>');
            expect(result).toHaveLength(3);

            // A = start color (red)
            expect(result[0].color).toBe(0xff0000);
            // C = end color (blue)
            expect(result[2].color).toBe(0x0000ff);
            // B = midpoint (purple)
            const midR = (result[1].color >> 16) & 0xff;
            const midB = result[1].color & 0xff;
            expect(midR).toBeCloseTo(128, 0); // roughly half red
            expect(midB).toBeCloseTo(128, 0); // roughly half blue
        });

        it('should handle single character gradient', () => {
            const result = parse('<gradient=#ff0000,#0000ff>A</gradient>');
            expect(result).toHaveLength(1);
            // Single char gets the start color
            expect(result[0].color).toBe(0xff0000);
        });

        it('should restore colors after gradient close', () => {
            const result = parse('<color=#00ff00>A<gradient=#ff0000,#0000ff>BC</gradient>D</color>');
            // A = green
            expect(result[0].color).toBe(0x00ff00);
            // B = red (gradient start)
            expect(result[1].color).toBe(0xff0000);
            // C = blue (gradient end)
            expect(result[2].color).toBe(0x0000ff);
            // D = green (restored from color tag)
            expect(result[3].color).toBe(0x00ff00);
        });

        it('should mark chars with gradientColors array', () => {
            const result = parse('<gradient=#ff0000,#0000ff>AB</gradient>C');
            expect(result[0].gradientColors).toEqual([0xff0000, 0x0000ff]);
            expect(result[1].gradientColors).toEqual([0xff0000, 0x0000ff]);
            expect(result[2].gradientColors).toEqual([]);
        });

        it('should ignore invalid gradient values', () => {
            // Only one color = not a valid gradient, ignored
            const result = parse('<gradient=#ff0000>A</gradient>');
            expect(result[0].color).toBe(BASE_COLOR);
            expect(result[0].gradientColors).toEqual([]);
        });

        it('should handle nested gradient inside other tags', () => {
            const result = parse('<b><gradient=#ff0000,#00ff00>AB</gradient></b>');
            expect(result[0].bold).toBe(true);
            expect(result[0].color).toBe(0xff0000);
            expect(result[1].bold).toBe(true);
            expect(result[1].color).toBe(0x00ff00);
        });
    });
});
