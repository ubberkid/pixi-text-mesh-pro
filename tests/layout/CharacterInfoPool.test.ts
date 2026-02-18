import { describe, it, expect } from 'vitest';
import { acquireCharacterInfo, releaseCharacterInfos, poolSize } from '../../src/layout/CharacterInfoPool';

describe('CharacterInfoPool', () => {
    it('should create a new CharacterInfo when pool is empty', () => {
        // Drain pool first
        const initial = poolSize();
        const ci = acquireCharacterInfo();
        expect(ci).toBeDefined();
        expect(ci.index).toBe(0);
        expect(ci.isVisible).toBe(false);
        expect(ci.texture).toBeNull();
    });

    it('should reuse objects after release', () => {
        const ci1 = acquireCharacterInfo();
        ci1.index = 42;
        ci1.char = 'X';

        releaseCharacterInfos([ci1]);
        const sizeBefore = poolSize();
        expect(sizeBefore).toBeGreaterThan(0);

        const ci2 = acquireCharacterInfo();
        // Should be the same object (reused from pool)
        expect(ci2).toBe(ci1);
        // Texture should be cleared
        expect(ci2.texture).toBeNull();
    });

    it('should clear texture references on release', () => {
        const ci = acquireCharacterInfo();
        ci.texture = { width: 10, height: 10 } as any;

        releaseCharacterInfos([ci]);
        expect(ci.texture).toBeNull();
    });

    it('should handle releasing empty arrays', () => {
        const sizeBefore = poolSize();
        releaseCharacterInfos([]);
        expect(poolSize()).toBe(sizeBefore);
    });
});
