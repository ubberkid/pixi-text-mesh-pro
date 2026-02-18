import type { TagRegistry } from '../TagRegistry';
import { TagStack } from '../TagStack';

/**
 * Register case transformation and script tags:
 * <allcaps>, <lowercase>, <smallcaps>, <sub>, <sup>
 */
export function registerCaseTags(
    registry: TagRegistry,
    allCapsStack: TagStack<boolean>,
    lowercaseStack: TagStack<boolean>,
    smallCapsStack: TagStack<boolean>,
    superscriptStack: TagStack<boolean>,
    subscriptStack: TagStack<boolean>,
    voffsetStack: TagStack<number>,
    sizeStack: TagStack<number>,
): void {
    // <allcaps>
    registry.register('allcaps',
        (state) => { allCapsStack.push(true); state.isAllCaps = true; },
        (state) => { state.isAllCaps = allCapsStack.pop(); },
    );

    // <uppercase> — alias for <allcaps>
    registry.register('uppercase',
        (state) => { allCapsStack.push(true); state.isAllCaps = true; },
        (state) => { state.isAllCaps = allCapsStack.pop(); },
    );

    // <lowercase>
    registry.register('lowercase',
        (state) => { lowercaseStack.push(true); state.isLowercase = true; },
        (state) => { state.isLowercase = lowercaseStack.pop(); },
    );

    // <smallcaps> — uppercase letters render at normal size, lowercase at ~80% size
    registry.register('smallcaps',
        (state) => { smallCapsStack.push(true); state.isSmallCaps = true; },
        (state) => { state.isSmallCaps = smallCapsStack.pop(); },
    );

    // <sup> — superscript: reduce size and offset up
    // Unity: m_fontScaleMultiplier *= superscriptSize (default 0.5)
    // Fallback to 0.5 if font doesn't provide superscriptSize.
    // Vertical offset uses font metric when available, fallback to -0.35 * baseFontSize.
    registry.register('sup',
        (state, _value, baseFontSize) => {
            superscriptStack.push(true);
            state.isSuperscript = true;
            // Apply size reduction: Unity uses faceInfo.superscriptSize as a multiplier
            const sizeMultiplier = 0.5; // Default matching Unity; overridden at layout if font has superscriptSize
            const newSize = state.fontSize * sizeMultiplier;
            sizeStack.push(newSize);
            state.fontSize = newSize;
            const offset = baseFontSize * -0.35;
            voffsetStack.push(offset);
            state.voffset = offset;
        },
        (state) => {
            state.isSuperscript = superscriptStack.pop();
            state.fontSize = sizeStack.pop();
            state.voffset = voffsetStack.pop();
        },
    );

    // <sub> — subscript: reduce size and offset down
    // Unity: m_fontScaleMultiplier *= subscriptSize (default 0.5)
    // Fallback to 0.5 if font doesn't provide subscriptSize.
    // Vertical offset uses font metric when available, fallback to 0.15 * baseFontSize.
    registry.register('sub',
        (state, _value, baseFontSize) => {
            subscriptStack.push(true);
            state.isSubscript = true;
            const sizeMultiplier = 0.5; // Default matching Unity; overridden at layout if font has subscriptSize
            const newSize = state.fontSize * sizeMultiplier;
            sizeStack.push(newSize);
            state.fontSize = newSize;
            const offset = baseFontSize * 0.15;
            voffsetStack.push(offset);
            state.voffset = offset;
        },
        (state) => {
            state.isSubscript = subscriptStack.pop();
            state.fontSize = sizeStack.pop();
            state.voffset = voffsetStack.pop();
        },
    );
}
