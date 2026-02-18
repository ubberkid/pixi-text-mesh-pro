import { describe, it, expect } from 'vitest';
import { loadTMPFont } from '../../src/font/TMPFontLoader';

describe('TMPFontLoader', () => {
    describe('extension metadata', () => {
        it('should have correct extension type', () => {
            expect(loadTMPFont.extension.type).toBe('load-parser');
        });

        it('should have a unique id', () => {
            expect(loadTMPFont.id).toBe('tmp-font');
        });
    });

    describe('test()', () => {
        it('should match .tmpfont.json files', () => {
            expect(loadTMPFont.test('fonts/roboto.tmpfont.json')).toBe(true);
        });

        it('should match .tmpfont files', () => {
            expect(loadTMPFont.test('fonts/roboto.tmpfont')).toBe(true);
        });

        it('should not match regular .json files', () => {
            expect(loadTMPFont.test('data/config.json')).toBe(false);
        });

        it('should not match .fnt files', () => {
            expect(loadTMPFont.test('fonts/arial.fnt')).toBe(false);
        });

        it('should match with query parameters', () => {
            expect(loadTMPFont.test('fonts/roboto.tmpfont.json?v=1')).toBe(true);
        });
    });

    describe('testParse()', () => {
        it('should accept valid TMPFontData', async () => {
            const data = {
                info: { face: 'Test', size: 32, lineHeight: 40, base: 30, ascent: 30, descent: 10, bold: false, italic: false, scaleW: 512, scaleH: 512 },
                distanceField: { type: 'msdf', range: 4 },
                pages: [{ id: 0, file: 'test.png' }],
                glyphs: [],
            };
            expect(await loadTMPFont.testParse(data)).toBe(true);
        });

        it('should reject non-objects', async () => {
            expect(await loadTMPFont.testParse('not an object')).toBe(false);
            expect(await loadTMPFont.testParse(null)).toBe(false);
            expect(await loadTMPFont.testParse(42)).toBe(false);
        });

        it('should reject objects missing required fields', async () => {
            expect(await loadTMPFont.testParse({ info: {} })).toBe(false);
            expect(await loadTMPFont.testParse({ info: {}, distanceField: {} })).toBe(false);
        });
    });
});
