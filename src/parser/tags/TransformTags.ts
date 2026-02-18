import type { TagRegistry } from '../TagRegistry';
import type { TagStack } from '../TagStack';

/**
 * Register per-character transform tags: <scale>, <rotate>
 */
export function registerTransformTags(
    registry: TagRegistry,
    scaleStack: TagStack<number>,
    rotationStack: TagStack<number>,
): void {
    // <scale=N> — per-character scale multiplier (1 = normal)
    registry.register('scale',
        (state, value) => {
            const n = parseFloat(value);
            if (!isNaN(n)) {
                scaleStack.push(n);
                state.charScale = n;
            }
        },
        (state) => {
            state.charScale = scaleStack.pop();
        },
    );

    // <rotate=N> — per-character rotation in degrees
    registry.register('rotate',
        (state, value) => {
            const n = parseFloat(value);
            if (!isNaN(n)) {
                rotationStack.push(n);
                state.rotation = n;
            }
        },
        (state) => {
            state.rotation = rotationStack.pop();
        },
    );
}
