/** Named color map — matches Unity TMP named colors. */
const NAMED_COLORS: Record<string, number> = {
    black: 0x000000, white: 0xffffff, red: 0xff0000, green: 0x00ff00,
    blue: 0x0000ff, yellow: 0xffff00, cyan: 0x00ffff, magenta: 0xff00ff,
    orange: 0xff8000, purple: 0xa020f0, lightblue: 0xadd8e6,
    grey: 0x808080, gray: 0x808080,
};

/**
 * Parse a TMP-style color value.
 * Supports: "#RRGGBB", "#RRGGBBAA", "#RGB", "red", "0xRRGGBB"
 * Returns a numeric RGB color (no alpha — alpha handled separately).
 */
export function parseColor(value: string): number {
    value = value.trim().toLowerCase();

    // Named colors
    if (NAMED_COLORS[value] !== undefined) {
        return NAMED_COLORS[value];
    }

    // Strip leading '#' or '0x'
    if (value.startsWith('#')) value = value.slice(1);
    else if (value.startsWith('0x')) value = value.slice(2);

    // 3-char shorthand #RGB → RRGGBB
    if (value.length === 3) {
        value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }

    // 4-char shorthand #RGBA → RRGGBB (discard alpha)
    if (value.length === 4) {
        value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }

    // 8-char RRGGBBAA → take only RGB
    if (value.length === 8) {
        value = value.slice(0, 6);
    }

    return parseInt(value, 16) || 0;
}

/**
 * Parse a TMP-style alpha value (#XX hex byte → 0..1 float).
 */
export function parseAlpha(value: string): number {
    value = value.trim();
    if (value.startsWith('#')) value = value.slice(1);
    const byte = parseInt(value, 16);
    if (isNaN(byte)) return 1;
    return byte / 255;
}
