import type { TextAlignment } from '../../core/types';
import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';
import { parseUnit } from '../../utils/unitParser';

/**
 * Register layout tags: <align>, <voffset>, <indent>, <margin>,
 * <line-height>, <space>, <pos>, <width>
 */
export function registerLayoutTags(
    registry: TagRegistry,
    alignStack: TagStack<TextAlignment | ''>,
    voffsetStack: TagStack<number>,
    indentStack: TagStack<number>,
    marginStack: TagStack<number>,
    lineHeightStack: TagStack<number>,
    lineIndentStack?: TagStack<number>,
): void {
    // <align=left|center|right|justified>
    registry.register('align',
        (state, value) => {
            const align = value.toLowerCase() as TextAlignment;
            alignStack.push(align);
            state.align = align;
        },
        (state) => { state.align = alignStack.pop(); },
    );

    // <voffset=N> — vertical offset
    registry.register('voffset',
        (state, value, baseFontSize) => {
            const offset = parseUnit(value, baseFontSize);
            voffsetStack.push(offset);
            state.voffset = offset;
        },
        (state) => { state.voffset = voffsetStack.pop(); },
    );

    // <indent=N> — left indent
    registry.register('indent',
        (state, value, baseFontSize) => {
            const indent = parseUnit(value, baseFontSize);
            indentStack.push(indent);
            state.indent = indent;
        },
        (state) => { state.indent = indentStack.pop(); },
    );

    // <margin=N> — horizontal margin (applies to both left and right)
    registry.register('margin',
        (state, value, baseFontSize) => {
            const margin = parseUnit(value, baseFontSize);
            marginStack.push(margin);
            state.marginLeft = margin;
            state.marginRight = margin;
        },
        (state) => {
            const prev = marginStack.pop();
            state.marginLeft = prev;
            state.marginRight = prev;
        },
    );

    // <margin-left=N> — left margin only
    registry.register('margin-left',
        (state, value, baseFontSize) => {
            const margin = parseUnit(value, baseFontSize);
            state.marginLeft = margin;
        },
        (state) => { state.marginLeft = 0; },
    );

    // <margin-right=N> — right margin only
    registry.register('margin-right',
        (state, value, baseFontSize) => {
            const margin = parseUnit(value, baseFontSize);
            state.marginRight = margin;
        },
        (state) => { state.marginRight = 0; },
    );

    // <padding=N> — alias for <margin>
    registry.register('padding',
        (state, value, baseFontSize) => {
            const margin = parseUnit(value, baseFontSize);
            marginStack.push(margin);
            state.marginLeft = margin;
            state.marginRight = margin;
        },
        (state) => {
            const prev = marginStack.pop();
            state.marginLeft = prev;
            state.marginRight = prev;
        },
    );

    // <line-height=N> — line height override
    registry.register('line-height',
        (state, value, baseFontSize) => {
            const lh = parseUnit(value, baseFontSize);
            lineHeightStack.push(lh);
            state.lineHeightOverride = lh;
        },
        (state) => { state.lineHeightOverride = lineHeightStack.pop(); },
    );

    // <space=N> — insert horizontal space (handled as extraSpace on next char)
    // This is a self-closing tag handled specially in the parser
    registry.register('space',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <pos=N> — set absolute horizontal position (handled in parser)
    registry.register('pos',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <line-indent=N> — indent at text start and after explicit \n (not word-wrap)
    if (lineIndentStack) {
        registry.register('line-indent',
            (state, value, baseFontSize) => {
                const indent = parseUnit(value, baseFontSize);
                lineIndentStack.push(indent);
                state.lineIndent = indent;
            },
            (state) => { state.lineIndent = lineIndentStack.pop(); },
        );
    }
}
