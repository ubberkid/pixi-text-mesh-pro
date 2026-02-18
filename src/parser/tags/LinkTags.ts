import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';

/**
 * Register link tags: <link>, <a>
 */
export function registerLinkTags(
    registry: TagRegistry,
    linkStack: TagStack<boolean>,
    linkIdStack: TagStack<string>,
): void {
    // <link="id">
    registry.register('link',
        (state, value) => {
            linkStack.push(true);
            linkIdStack.push(value);
            state.isLink = true;
            state.linkId = value;
        },
        (state) => {
            state.isLink = linkStack.pop();
            state.linkId = linkIdStack.pop();
        },
    );

    // <a href="url"> — alias for link
    registry.register('a',
        (state, value) => {
            // value might be 'href="url"' — extract the url
            let url = value;
            const hrefMatch = value.match(/href\s*=\s*["']?([^"'>\s]+)/i);
            if (hrefMatch) {
                url = hrefMatch[1];
            }
            linkStack.push(true);
            linkIdStack.push(url);
            state.isLink = true;
            state.linkId = url;
        },
        (state) => {
            state.isLink = linkStack.pop();
            state.linkId = linkIdStack.pop();
        },
    );
}
