import type { TMPFont } from '../font/TMPFont';
import type { TMPTextStyle } from '../core/TMPTextStyle';
import { RichTextParser } from '../parser/RichTextParser';
import { TMPLayoutEngine } from '../layout/TMPLayoutEngine';

/**
 * Binary search for the largest font size that fits text within a container.
 *
 * @param text - The rich text string to measure.
 * @param font - The TMP font to use for layout.
 * @param style - The text style (fontSize will be varied).
 * @param containerWidth - Maximum allowed width.
 * @param containerHeight - Maximum allowed height.
 * @param min - Minimum font size to consider (default 1).
 * @param max - Maximum font size to consider (default 500).
 * @returns The largest font size that fits, clamped to [min, max].
 */
export function autoSizeFontSize(
    text: string,
    font: TMPFont,
    style: TMPTextStyle,
    containerWidth: number,
    containerHeight: number,
    min = 1,
    max = 500,
): number {
    const parser = new RichTextParser();
    const testStyle = style.clone();
    testStyle.wordWrap = true;
    testStyle.wordWrapWidth = containerWidth;

    let lo = min;
    let hi = max;
    const tolerance = 0.5;

    while (hi - lo > tolerance) {
        const mid = (lo + hi) / 2;
        testStyle.fontSize = mid;

        const parsed = parser.parse(
            text, mid,
            testStyle.fill,
            testStyle.fontFamily || font.fontFamily,
        );
        const info = TMPLayoutEngine.layout(parsed, font, testStyle);

        if (info.width <= containerWidth && info.height <= containerHeight) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    return Math.floor(lo);
}
