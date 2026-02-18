import { describe, it, expect } from 'vitest';
import { TMPStyleSheet } from '../../src/styles/TMPStyleSheet';

describe('TMPStyleSheet', () => {
    it('should register and retrieve a style preset', () => {
        const sheet = new TMPStyleSheet();
        sheet.set('warning', { open: '<color=#ff0000>', close: '</color>' });

        const preset = sheet.get('warning');
        expect(preset).toBeDefined();
        expect(preset!.open).toBe('<color=#ff0000>');
        expect(preset!.close).toBe('</color>');
    });

    it('should be case-insensitive', () => {
        const sheet = new TMPStyleSheet();
        sheet.set('Warning', { open: '<b>', close: '</b>' });

        expect(sheet.get('warning')).toBeDefined();
        expect(sheet.get('WARNING')).toBeDefined();
        expect(sheet.has('Warning')).toBe(true);
    });

    it('should delete a preset', () => {
        const sheet = new TMPStyleSheet();
        sheet.set('test', { open: '<b>', close: '</b>' });
        expect(sheet.has('test')).toBe(true);
        sheet.delete('test');
        expect(sheet.has('test')).toBe(false);
    });

    it('should clear all presets', () => {
        const sheet = new TMPStyleSheet();
        sheet.set('a', { open: '<b>', close: '</b>' });
        sheet.set('b', { open: '<i>', close: '</i>' });
        expect(sheet.size).toBe(2);
        sheet.clear();
        expect(sheet.size).toBe(0);
    });

    it('should create from JSON', () => {
        const sheet = TMPStyleSheet.fromJSON({
            warning: { open: '<color=#ff0000><b>', close: '</b></color>' },
            highlight: { open: '<mark=#ffcc00>', close: '</mark>' },
        });

        expect(sheet.size).toBe(2);
        expect(sheet.get('warning')!.open).toBe('<color=#ff0000><b>');
        expect(sheet.get('highlight')!.close).toBe('</mark>');
    });
});
