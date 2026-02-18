import type { CharacterInfo } from '../core/types';

/**
 * Simple object pool for CharacterInfo to reduce GC pressure
 * during frequent layout rebuilds.
 */
const pool: CharacterInfo[] = [];

/** Acquire a CharacterInfo from the pool (or create a new one). */
export function acquireCharacterInfo(): CharacterInfo {
    if (pool.length > 0) {
        return pool.pop()!;
    }
    return {
        index: 0,
        char: '',
        isVisible: false,
        texture: null,
        x: 0, y: 0, width: 0, height: 0, scale: 0,
        color: 0xffffff,
        alpha: 1,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        markColor: 0,
        charScale: 1,
        rotation: 0,
        lineIndex: 0,
        wordIndex: 0,
        origin: 0,
        xAdvance: 0,
        ascender: 0,
        descender: 0,
        elementType: 'character',
        material: '',
    };
}

/** Return an array of CharacterInfos to the pool for reuse. */
export function releaseCharacterInfos(chars: CharacterInfo[]): void {
    for (let i = 0; i < chars.length; i++) {
        // Clear texture reference to avoid memory leaks
        chars[i].texture = null;
        pool.push(chars[i]);
    }
}

/** Current pool size (for diagnostics). */
export function poolSize(): number {
    return pool.length;
}
