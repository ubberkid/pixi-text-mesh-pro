import type { LineInfo, TextAlignment } from '../core/types';

/** Create an empty LineInfo. */
export function createLineInfo(
    firstCharIndex: number,
    y: number,
    height: number,
    alignment: TextAlignment = 'left',
): LineInfo {
    return {
        firstCharIndex,
        lastCharIndex: firstCharIndex,
        characterCount: 0,
        width: 0,
        height,
        baseline: y + height,
        y,
        alignmentOffset: 0,
        alignment,
        spaceCount: 0,
        ascender: 0,
        descender: 0,
        firstVisibleCharIndex: -1,
        lastVisibleCharIndex: -1,
        visibleCharacterCount: 0,
        maxAdvance: 0,
    };
}
