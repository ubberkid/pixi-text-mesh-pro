import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';
import { parseColor } from '../../utils/colorUtils';

/**
 * Register gradient tag: <gradient=#color1,#color2>
 *
 * Marks characters with gradient color endpoints. The actual color
 * interpolation is applied as a post-process step after parsing.
 */
export function registerGradientTags(
    registry: TagRegistry,
    gradientStack: TagStack<number[]>,
): void {
    registry.register('gradient',
        (state, value) => {
            const colors = parseGradientValue(value);
            if (colors.length >= 2) {
                gradientStack.push(colors);
                state.gradientColors = colors;
            }
        },
        (state) => {
            state.gradientColors = gradientStack.pop();
        },
    );
}

/** Parse gradient value: "#FF0000,#0000FF" → [0xFF0000, 0x0000FF] */
function parseGradientValue(value: string): number[] {
    return value.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => parseColor(s));
}
