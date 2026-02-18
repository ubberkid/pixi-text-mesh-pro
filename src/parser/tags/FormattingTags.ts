import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';
import { parseColor } from '../../utils/colorUtils';

/**
 * Parse a `color=#hex` or `color=name` attribute from a tag value string.
 * Returns -1 if no color attribute is found.
 */
function parseColorAttribute(value: string): number {
    const match = value.match(/color\s*=\s*([^\s,>"']+)/i);
    if (!match) return -1;
    return parseColor(match[1]);
}

/**
 * Parse an `angle=N` attribute from a tag value string.
 * Returns 0 if no angle attribute is found.
 */
function parseAngleAttribute(value: string): number {
    const match = value.match(/angle\s*=\s*([^\s,>"']+)/i);
    if (!match) return 0;
    return parseFloat(match[1]) || 0;
}

/**
 * Parse a `padding="N,N,N,N"` or `padding=N` attribute from a tag value string.
 * Returns empty array if no padding attribute is found.
 * Format: [left, right, top, bottom] (Unity TMP convention).
 */
function parsePaddingAttribute(value: string): number[] {
    const match = value.match(/padding\s*=\s*"?([^"'>]+)"?/i);
    if (!match) return [];
    const parts = match[1].split(',').map(s => parseFloat(s.trim()) || 0);
    if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
    if (parts.length === 4) return parts;
    return [];
}

/**
 * Register formatting tags: <b>, <i>, <u>, <s>, <mark>
 *
 * Uses counter-based nesting (matching Unity TMP behavior):
 * `<b><b></b>` keeps bold active because counter goes 0→1→2→1 (still > 0).
 */
export function registerFormattingTags(
    registry: TagRegistry,
    boldStack: TagStack<boolean>,
    italicStack: TagStack<boolean>,
    underlineStack: TagStack<boolean>,
    strikethroughStack: TagStack<boolean>,
    markStack: TagStack<number>,
): void {
    // Counter-based nesting: use TagStack<number> internally.
    // The passed-in boolean stacks are kept in sync for backwards compatibility
    // with anything reading from them externally.
    let boldCount = 0;
    let italicCount = 0;
    let underlineCount = 0;
    let strikethroughCount = 0;

    registry.register('b',
        (state) => {
            boldCount++;
            boldStack.push(true);
            state.bold = true;
        },
        (state) => {
            boldCount = Math.max(0, boldCount - 1);
            boldStack.pop();
            state.bold = boldCount > 0;
        },
    );

    // <i> or <i angle=N>
    registry.register('i',
        (state, value) => {
            italicCount++;
            italicStack.push(true);
            state.italic = true;
            if (value) {
                const angle = parseAngleAttribute(value);
                if (angle !== 0) {
                    state.italicAngle = angle;
                }
            }
        },
        (state) => {
            italicCount = Math.max(0, italicCount - 1);
            italicStack.pop();
            state.italic = italicCount > 0;
            if (!state.italic) {
                state.italicAngle = 0;
            }
        },
    );

    // <u> or <u color=#hex>
    registry.register('u',
        (state, value) => {
            underlineCount++;
            underlineStack.push(true);
            state.underline = true;
            if (value) {
                const color = parseColorAttribute(value);
                if (color !== -1) {
                    state.underlineColor = color;
                }
            }
        },
        (state) => {
            underlineCount = Math.max(0, underlineCount - 1);
            underlineStack.pop();
            state.underline = underlineCount > 0;
            if (!state.underline) {
                state.underlineColor = -1;
            }
        },
    );

    // <s> or <s color=#hex>
    registry.register('s',
        (state, value) => {
            strikethroughCount++;
            strikethroughStack.push(true);
            state.strikethrough = true;
            if (value) {
                const color = parseColorAttribute(value);
                if (color !== -1) {
                    state.strikethroughColor = color;
                }
            }
        },
        (state) => {
            strikethroughCount = Math.max(0, strikethroughCount - 1);
            strikethroughStack.pop();
            state.strikethrough = strikethroughCount > 0;
            if (!state.strikethrough) {
                state.strikethroughColor = -1;
            }
        },
    );

    // <strikethrough> — alias for <s>
    registry.register('strikethrough',
        (state, value) => {
            strikethroughCount++;
            strikethroughStack.push(true);
            state.strikethrough = true;
            if (value) {
                const color = parseColorAttribute(value);
                if (color !== -1) {
                    state.strikethroughColor = color;
                }
            }
        },
        (state) => {
            strikethroughCount = Math.max(0, strikethroughCount - 1);
            strikethroughStack.pop();
            state.strikethrough = strikethroughCount > 0;
            if (!state.strikethrough) {
                state.strikethroughColor = -1;
            }
        },
    );

    // <mark=#hex> or <mark=#hex padding="L,R,T,B">
    registry.register('mark',
        (state, value) => {
            let color: number;
            if (value) {
                // Extract the color part (before any space-separated attributes)
                const colorPart = value.split(/\s+/)[0];
                const hex = colorPart.replace('#', '');
                if (hex.length === 8) {
                    // 8-digit hex: RRGGBBAA — pack alpha into high byte
                    const rgb = parseInt(hex.substring(0, 6), 16);
                    const alpha = parseInt(hex.substring(6, 8), 16);
                    color = ((alpha << 24) | rgb) >>> 0;
                } else {
                    color = parseInt(hex, 16);
                }
                // Parse optional padding attribute
                const padding = parsePaddingAttribute(value);
                if (padding.length > 0) {
                    state.markPadding = padding;
                }
            } else {
                color = 0xffff00;
            }
            markStack.push(color);
            state.markColor = color;
        },
        (state) => {
            state.markColor = markStack.pop();
            state.markPadding = [];
        },
    );
}
