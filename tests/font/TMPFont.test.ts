import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TMPFont } from '../../src/font/TMPFont';
import { Texture } from 'pixi.js';

describe('TMPFont', () => {
    describe('font registry', () => {
        afterEach(() => {
            TMPFont.clearRegistry();
        });

        it('should register and retrieve a font', () => {
            const font = new TMPFont();
            TMPFont.registerFont('TestFont', font);
            expect(TMPFont.getFont('TestFont')).toBe(font);
            expect(TMPFont.getFont('testfont')).toBe(font);
        });

        it('should return undefined for unregistered fonts', () => {
            expect(TMPFont.getFont('nonexistent')).toBeUndefined();
        });

        it('should unregister a font', () => {
            const font = new TMPFont();
            TMPFont.registerFont('TestFont', font);
            expect(TMPFont.unregisterFont('TestFont')).toBe(true);
            expect(TMPFont.getFont('TestFont')).toBeUndefined();
        });

        it('should clear all registered fonts', () => {
            TMPFont.registerFont('Font1', new TMPFont());
            TMPFont.registerFont('Font2', new TMPFont());
            TMPFont.clearRegistry();
            expect(TMPFont.getFont('Font1')).toBeUndefined();
            expect(TMPFont.getFont('Font2')).toBeUndefined();
        });
    });

    describe('getCharWithFallback', () => {
        afterEach(() => {
            TMPFont.clearRegistry();
        });

        it('should return char from primary font', () => {
            const font = new TMPFont();
            const mockTex = Texture.WHITE;
            (font.chars as Record<string, unknown>)['A'] = {
                id: 65, xOffset: 0, yOffset: 0, xAdvance: 10,
                kerning: {}, texture: mockTex,
            };

            const result = font.getCharWithFallback('A');
            expect(result).toBeDefined();
            expect(result!.font).toBe(font);
            expect(result!.charData.xAdvance).toBe(10);
        });

        it('should return undefined for missing char without fallbacks', () => {
            const font = new TMPFont();
            expect(font.getCharWithFallback('A')).toBeUndefined();
        });

        it('should find char in fallback font', () => {
            const primary = new TMPFont();
            const fallback = new TMPFont();
            const mockTex = Texture.WHITE;
            (fallback.chars as Record<string, unknown>)['Z'] = {
                id: 90, xOffset: 0, yOffset: 0, xAdvance: 12,
                kerning: {}, texture: mockTex,
            };

            TMPFont.registerFont('fallbackFont', fallback);
            primary.fallbackFonts = ['fallbackFont'];

            const result = primary.getCharWithFallback('Z');
            expect(result).toBeDefined();
            expect(result!.font).toBe(fallback);
            expect(result!.charData.xAdvance).toBe(12);
        });

        it('should prefer primary font over fallback', () => {
            const primary = new TMPFont();
            const fallback = new TMPFont();
            const mockTex = Texture.WHITE;

            (primary.chars as Record<string, unknown>)['A'] = {
                id: 65, xOffset: 0, yOffset: 0, xAdvance: 10,
                kerning: {}, texture: mockTex,
            };
            (fallback.chars as Record<string, unknown>)['A'] = {
                id: 65, xOffset: 0, yOffset: 0, xAdvance: 20,
                kerning: {}, texture: mockTex,
            };

            TMPFont.registerFont('fallbackFont', fallback);
            primary.fallbackFonts = ['fallbackFont'];

            const result = primary.getCharWithFallback('A');
            expect(result!.font).toBe(primary);
            expect(result!.charData.xAdvance).toBe(10);
        });
    });
});
