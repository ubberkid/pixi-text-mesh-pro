import { describe, it, expect } from 'vitest';
import { hashCode } from '../../src/utils/hashCode';

describe('hashCode (FNV-1a)', () => {
    it('should produce consistent hashes', () => {
        expect(hashCode('color')).toBe(hashCode('color'));
        expect(hashCode('b')).toBe(hashCode('b'));
    });

    it('should produce different hashes for different strings', () => {
        expect(hashCode('color')).not.toBe(hashCode('size'));
        expect(hashCode('b')).not.toBe(hashCode('i'));
    });

    it('should handle empty string', () => {
        expect(typeof hashCode('')).toBe('number');
    });

    it('should be case-sensitive', () => {
        expect(hashCode('Color')).not.toBe(hashCode('color'));
    });
});
