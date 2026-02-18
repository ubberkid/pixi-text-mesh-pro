import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';
import { parseColor, parseAlpha } from '../../utils/colorUtils';

/**
 * Register color-related tags: <color>, <alpha>
 */
export function registerColorTags(registry: TagRegistry, colorStack: TagStack<number>, alphaStack: TagStack<number>): void {
    // <color=#hex> or <color="name">
    registry.register('color',
        (state, value) => {
            const color = parseColor(value);
            colorStack.push(color);
            state.color = color;
        },
        (state) => {
            state.color = colorStack.pop();
        },
    );

    // <alpha=#XX>
    registry.register('alpha',
        (state, value) => {
            const alpha = parseAlpha(value);
            alphaStack.push(alpha);
            state.alpha = alpha;
        },
        (state) => {
            state.alpha = alphaStack.pop();
        },
    );
}
