import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';
import { parseUnit } from '../../utils/unitParser';

/**
 * Register size-related tags: <size>, <cspace>, <mspace>
 */
export function registerSizeTags(
    registry: TagRegistry,
    sizeStack: TagStack<number>,
    cspaceStack: TagStack<number>,
    mspaceStack: TagStack<number>,
): void {
    // <size=24> or <size=150%> or <size=1.5em> or <size=+4> or <size=-4>
    registry.register('size',
        (state, value, baseFontSize) => {
            let size: number;
            const trimmed = value.trim();
            if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
                // Relative sizing: offset from current fontSize
                size = state.fontSize + parseFloat(trimmed);
            } else {
                size = parseUnit(trimmed, baseFontSize);
            }
            sizeStack.push(size);
            state.fontSize = size;
        },
        (state) => { state.fontSize = sizeStack.pop(); },
    );

    // <cspace=N> — character spacing
    registry.register('cspace',
        (state, value, baseFontSize) => {
            const spacing = parseUnit(value, baseFontSize);
            cspaceStack.push(spacing);
            state.cspace = spacing;
        },
        (state) => { state.cspace = cspaceStack.pop(); },
    );

    // <mspace=N> — monospace width
    registry.register('mspace',
        (state, value, baseFontSize) => {
            const width = parseUnit(value, baseFontSize);
            mspaceStack.push(width);
            state.mspace = width;
        },
        (state) => { state.mspace = mspaceStack.pop(); },
    );

    // <duospace=N> — alias for <mspace>
    registry.register('duospace',
        (state, value, baseFontSize) => {
            const width = parseUnit(value, baseFontSize);
            mspaceStack.push(width);
            state.mspace = width;
        },
        (state) => { state.mspace = mspaceStack.pop(); },
    );
}
