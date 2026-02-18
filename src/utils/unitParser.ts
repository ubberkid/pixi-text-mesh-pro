/**
 * Parse a TMP size value with optional unit.
 * "24"    → 24      (pixels)
 * "24px"  → 24
 * "1.5em" → baseFontSize * 1.5
 * "50%"   → baseFontSize * 0.5
 */
export function parseUnit(value: string, baseFontSize: number): number {
    value = value.trim();

    if (value.endsWith('%')) {
        return baseFontSize * (parseFloat(value) / 100);
    }

    if (value.endsWith('em')) {
        return baseFontSize * parseFloat(value);
    }

    if (value.endsWith('px')) {
        return parseFloat(value);
    }

    return parseFloat(value) || 0;
}
