import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';

/**
 * Parse a compound font tag value that may contain a material attribute.
 *
 * After _tryParseTag processes `<font="Dimbo SDF" material="Dimbo Strong Brown Stroke">`,
 * the value string arrives with naive outer-quote stripping applied, which can break
 * when the value contains embedded attributes with their own quotes. This function
 * robustly extracts both the font name and material name from any mangled form.
 */
function parseFontValue(raw: string): { fontName: string; materialName: string } {
    const materialMatch = raw.match(/["']?\s+material\s*=\s*["']?/i);
    if (!materialMatch || materialMatch.index === undefined) {
        return { fontName: stripQuotes(raw), materialName: '' };
    }

    const fontPart = raw.substring(0, materialMatch.index);
    const materialPart = raw.substring(materialMatch.index + materialMatch[0].length);

    return {
        fontName: stripQuotes(fontPart),
        materialName: stripQuotes(materialPart),
    };
}

function stripQuotes(s: string): string {
    s = s.trim();
    if ((s.startsWith('"') && s.endsWith('"')) ||
        (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    if (s.endsWith('"') || s.endsWith("'")) {
        s = s.slice(0, -1);
    }
    if (s.startsWith('"') || s.startsWith("'")) {
        s = s.slice(1);
    }
    return s.trim();
}

/**
 * Register font tags: <font="name" material="name">, <font-weight="value">
 */
export function registerFontTags(
    registry: TagRegistry,
    fontStack: TagStack<string>,
    fontWeightStack: TagStack<string>,
    materialStack: TagStack<string>,
): void {
    // Track whether each font tag open also pushed a material
    const fontPushedMaterial: boolean[] = [];

    registry.register('font',
        (state, value) => {
            const { fontName, materialName } = parseFontValue(value);
            fontStack.push(fontName);
            state.fontFamily = fontName;
            if (materialName) {
                materialStack.push(materialName);
                state.material = materialName;
                fontPushedMaterial.push(true);
            } else {
                fontPushedMaterial.push(false);
            }
        },
        (state) => {
            state.fontFamily = fontStack.pop();
            const pushed = fontPushedMaterial.pop() ?? false;
            if (pushed) {
                state.material = materialStack.pop();
            }
        },
    );

    // <font-weight="400"|"700"|"bold"> — store weight for consumers
    registry.register('font-weight',
        (state, value) => {
            fontWeightStack.push(value);
            state.fontWeight = value;
        },
        (state) => {
            state.fontWeight = fontWeightStack.pop();
        },
    );
}
