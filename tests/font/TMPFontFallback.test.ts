import { describe, it, expect, afterEach } from 'vitest';
import { TMPFont } from '../../src/font/TMPFont';
import { Texture } from 'pixi.js';

describe('TMPFont fallback protection', () => {
    afterEach(() => {
        TMPFont.clearRegistry();
    });

    it('should not infinite-loop with circular fallbacks', () => {
        const fontA = new TMPFont();
        const fontB = new TMPFont();
        fontA.fallbackFonts = ['fontB'];
        fontB.fallbackFonts = ['fontA'];
        TMPFont.registerFont('fontA', fontA);
        TMPFont.registerFont('fontB', fontB);

        // Should return undefined without hanging
        const result = fontA.getCharWithFallback('X');
        expect(result).toBeUndefined();
    });

    it('should traverse multi-level fallback chain', () => {
        const fontA = new TMPFont();
        const fontB = new TMPFont();
        const fontC = new TMPFont();
        const mockTex = Texture.WHITE;

        (fontC.chars as Record<string, unknown>)['Z'] = {
            id: 90, xOffset: 0, yOffset: 0, xAdvance: 12,
            kerning: {}, texture: mockTex,
        };

        fontA.fallbackFonts = ['fontB'];
        fontB.fallbackFonts = ['fontC'];
        TMPFont.registerFont('fontA', fontA);
        TMPFont.registerFont('fontB', fontB);
        TMPFont.registerFont('fontC', fontC);

        const result = fontA.getCharWithFallback('Z');
        expect(result).toBeDefined();
        expect(result!.font).toBe(fontC);
        expect(result!.charData.xAdvance).toBe(12);
    });

    it('should handle self-referencing fallback', () => {
        const font = new TMPFont();
        font.fallbackFonts = ['self'];
        TMPFont.registerFont('self', font);

        const result = font.getCharWithFallback('X');
        expect(result).toBeUndefined();
    });
});
