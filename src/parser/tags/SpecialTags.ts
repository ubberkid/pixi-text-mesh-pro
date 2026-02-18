import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';

/**
 * Register special tags: <nobr>, <noparse>, <br>
 * Note: <noparse> and <br> are handled specially in the parser itself;
 * we register them here so the registry knows they exist.
 */
export function registerSpecialTags(
    registry: TagRegistry,
    nobrStack: TagStack<boolean>,
): void {
    registry.register('nobr',
        (state) => { nobrStack.push(true); state.isNoBreak = true; },
        (state) => { state.isNoBreak = nobrStack.pop(); },
    );

    // <br> is self-closing — handled directly in parser
    registry.register('br',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <nbsp> is self-closing — handled directly in parser (inserts U+00A0)
    registry.register('nbsp',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <zwsp> — zero-width space U+200B (handled in parser)
    registry.register('zwsp',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <softhyphen> / <shy> — soft hyphen U+00AD (handled in parser)
    registry.register('softhyphen',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );
    registry.register('shy',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <en-space> — en space U+2002 (handled in parser)
    registry.register('en-space',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <em-space> — em space U+2003 (handled in parser)
    registry.register('em-space',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <noparse> — handled directly in parser to skip tag processing
    registry.register('noparse',
        () => { /* handled in parser */ },
        () => { /* handled in parser */ },
    );

    // <cr> — carriage return U+000D (handled in parser)
    registry.register('cr',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );

    // <zwj> — zero-width joiner U+200D (handled in parser)
    registry.register('zwj',
        () => { /* handled in parser */ },
        () => { /* no close */ },
    );
}
