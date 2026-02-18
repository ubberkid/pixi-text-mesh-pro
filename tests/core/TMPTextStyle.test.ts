import { describe, it, expect } from 'vitest';
import { TMPTextStyle } from '../../src/core/TMPTextStyle';

describe('TMPTextStyle', () => {
    describe('bevel properties', () => {
        it('should have default bevel values', () => {
            const style = new TMPTextStyle();
            expect(style.bevelWidth).toBe(0);
            expect(style.bevelOffset).toBe(0.5);
            expect(style.bevelColor).toBe(0xffffff);
        });

        it('should accept bevel options in constructor', () => {
            const style = new TMPTextStyle({
                bevelWidth: 0.3,
                bevelOffset: 0.75,
                bevelColor: '#ff0000',
            });
            expect(style.bevelWidth).toBe(0.3);
            expect(style.bevelOffset).toBe(0.75);
            expect(style.bevelColor).toBe(0xff0000);
        });

        it('should emit update on bevel change', () => {
            const style = new TMPTextStyle();
            let updated = false;
            style.on('update', () => { updated = true; });

            style.bevelWidth = 0.5;
            expect(updated).toBe(true);
        });

        it('should not emit update when setting same value', () => {
            const style = new TMPTextStyle({ bevelWidth: 0.3 });
            let updated = false;
            style.on('update', () => { updated = true; });

            style.bevelWidth = 0.3;
            expect(updated).toBe(false);
        });
    });

    describe('Phase 5b properties', () => {
        it('should have default fontStyle, verticalAlign, overflowMode', () => {
            const style = new TMPTextStyle();
            expect(style.fontStyle).toBe('');
            expect(style.verticalAlign).toBe('top');
            expect(style.containerHeight).toBe(0);
            expect(style.overflowMode).toBe('overflow');
        });

        it('should accept Phase 5b options in constructor', () => {
            const style = new TMPTextStyle({
                fontStyle: 'bold italic',
                verticalAlign: 'middle',
                containerHeight: 300,
                overflowMode: 'ellipsis',
            });
            expect(style.fontStyle).toBe('bold italic');
            expect(style.verticalAlign).toBe('middle');
            expect(style.containerHeight).toBe(300);
            expect(style.overflowMode).toBe('ellipsis');
        });

        it('should emit update on fontStyle change', () => {
            const style = new TMPTextStyle();
            let updated = false;
            style.on('update', () => { updated = true; });
            style.fontStyle = 'bold';
            expect(updated).toBe(true);
        });

        it('should emit update on verticalAlign change', () => {
            const style = new TMPTextStyle();
            let updated = false;
            style.on('update', () => { updated = true; });
            style.verticalAlign = 'bottom';
            expect(updated).toBe(true);
        });

        it('should emit update on overflowMode change', () => {
            const style = new TMPTextStyle();
            let updated = false;
            style.on('update', () => { updated = true; });
            style.overflowMode = 'truncate';
            expect(updated).toBe(true);
        });

        it('should not emit update when setting same fontStyle', () => {
            const style = new TMPTextStyle({ fontStyle: 'bold' });
            let updated = false;
            style.on('update', () => { updated = true; });
            style.fontStyle = 'bold';
            expect(updated).toBe(false);
        });

        it('should clone Phase 5b properties', () => {
            const style = new TMPTextStyle({
                fontStyle: 'italic',
                verticalAlign: 'bottom',
                containerHeight: 500,
                overflowMode: 'truncate',
            });
            const cloned = style.clone();
            expect(cloned.fontStyle).toBe('italic');
            expect(cloned.verticalAlign).toBe('bottom');
            expect(cloned.containerHeight).toBe(500);
            expect(cloned.overflowMode).toBe('truncate');
        });
    });

    describe('clone', () => {
        it('should clone all properties including bevel', () => {
            const style = new TMPTextStyle({
                fontSize: 48,
                fill: '#ff0000',
                outlineWidth: 0.1,
                bevelWidth: 0.5,
                bevelOffset: 0.75,
                bevelColor: '#00ff00',
            });
            const cloned = style.clone();

            expect(cloned.fontSize).toBe(48);
            expect(cloned.fill).toBe(0xff0000);
            expect(cloned.outlineWidth).toBe(0.1);
            expect(cloned.bevelWidth).toBe(0.5);
            expect(cloned.bevelOffset).toBe(0.75);
            expect(cloned.bevelColor).toBe(0x00ff00);
        });

        it('should be independent from original', () => {
            const style = new TMPTextStyle({ bevelWidth: 0.5 });
            const cloned = style.clone();
            cloned.bevelWidth = 0.8;

            expect(style.bevelWidth).toBe(0.5);
            expect(cloned.bevelWidth).toBe(0.8);
        });
    });
});
