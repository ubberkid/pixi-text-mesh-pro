import type { ParsedChar, TextAlignment } from '../core/types';
import { hashCode } from '../utils/hashCode';
import { parseUnit } from '../utils/unitParser';
import { parseColor } from '../utils/colorUtils';
import { TagRegistry } from './TagRegistry';
import { TagStack } from './TagStack';
import { createDefaultStyleState, createParsedChar, type StyleState } from './RichTextData';
import { registerColorTags } from './tags/ColorTags';
import { registerFormattingTags } from './tags/FormattingTags';
import { registerSizeTags } from './tags/SizeTags';
import { registerSpecialTags } from './tags/SpecialTags';
import { registerLayoutTags } from './tags/LayoutTags';
import { registerCaseTags } from './tags/CaseTags';
import { registerLinkTags } from './tags/LinkTags';
import { registerFontTags } from './tags/FontTags';
import { registerTransformTags } from './tags/TransformTags';
import { registerGradientTags } from './tags/GradientTags';
import { parseSpriteTag } from './tags/SpriteTags';
import type { TMPStyleSheet } from '../styles/TMPStyleSheet';

/** Result of parsing a single tag. */
interface TagParseResult {
    tagName: string;
    tagNameHash: number;
    value: string;
    isClosing: boolean;
    /** Number of characters consumed from the source (including < and >). */
    length: number;
}

/**
 * Rich text parser: converts a tagged string into a flat ParsedChar[] array
 * where each character carries its fully resolved style state.
 *
 * Supports TMP-style tags: <b>, <i>, <color=#hex>, <alpha=#XX>, <size=N>, <br>,
 * <align>, <voffset>, <indent>, <margin>, <line-height>, <allcaps>, <lowercase>,
 * <smallcaps>, <sub>, <sup>, <font>, <link>, <a>, <style>, <space>, <pos>, etc.
 */
export class RichTextParser {
    private _registry: TagRegistry;

    // Stacks for each pushable property
    private _colorStack: TagStack<number>;
    private _alphaStack: TagStack<number>;
    private _sizeStack: TagStack<number>;
    private _boldStack: TagStack<boolean>;
    private _italicStack: TagStack<boolean>;
    private _underlineStack: TagStack<boolean>;
    private _strikethroughStack: TagStack<boolean>;
    private _markStack: TagStack<number>;
    private _cspaceStack: TagStack<number>;
    private _mspaceStack: TagStack<number>;
    private _nobrStack: TagStack<boolean>;
    // Phase 2 stacks
    private _alignStack: TagStack<TextAlignment | ''>;
    private _voffsetStack: TagStack<number>;
    private _indentStack: TagStack<number>;
    private _marginStack: TagStack<number>;
    private _lineHeightStack: TagStack<number>;
    private _allCapsStack: TagStack<boolean>;
    private _lowercaseStack: TagStack<boolean>;
    private _smallCapsStack: TagStack<boolean>;
    private _superscriptStack: TagStack<boolean>;
    private _subscriptStack: TagStack<boolean>;
    private _linkStack: TagStack<boolean>;
    private _linkIdStack: TagStack<string>;
    private _fontStack: TagStack<string>;
    private _charScaleStack: TagStack<number>;
    private _rotationStack: TagStack<number>;
    private _gradientStack: TagStack<number[]>;
    private _widthStack: TagStack<number>;
    private _styleNameStack: TagStack<string>;
    private _fontWeightStack: TagStack<string>;
    private _lineIndentStack: TagStack<number>;
    private _materialStack: TagStack<string>;

    /** Optional style sheet for <style> tag lookups. */
    styleSheet: TMPStyleSheet | null = null;

    constructor() {
        this._registry = new TagRegistry();

        // Initialize all stacks
        this._colorStack = new TagStack(0xffffff);
        this._alphaStack = new TagStack(1);
        this._sizeStack = new TagStack(32);
        this._boldStack = new TagStack(false);
        this._italicStack = new TagStack(false);
        this._underlineStack = new TagStack(false);
        this._strikethroughStack = new TagStack(false);
        this._markStack = new TagStack(0);
        this._cspaceStack = new TagStack(0);
        this._mspaceStack = new TagStack(0);
        this._nobrStack = new TagStack(false);
        this._alignStack = new TagStack<TextAlignment | ''>('');
        this._voffsetStack = new TagStack(0);
        this._indentStack = new TagStack(0);
        this._marginStack = new TagStack(0);
        this._lineHeightStack = new TagStack(0);
        this._allCapsStack = new TagStack(false);
        this._lowercaseStack = new TagStack(false);
        this._smallCapsStack = new TagStack(false);
        this._superscriptStack = new TagStack(false);
        this._subscriptStack = new TagStack(false);
        this._linkStack = new TagStack(false);
        this._linkIdStack = new TagStack('');
        this._fontStack = new TagStack('');
        this._charScaleStack = new TagStack(1);
        this._rotationStack = new TagStack(0);
        this._gradientStack = new TagStack<number[]>([]);
        this._widthStack = new TagStack(0);
        this._styleNameStack = new TagStack('');
        this._fontWeightStack = new TagStack('');
        this._lineIndentStack = new TagStack(0);
        this._materialStack = new TagStack('');

        // Register all tags
        registerColorTags(this._registry, this._colorStack, this._alphaStack);
        registerFormattingTags(
            this._registry,
            this._boldStack, this._italicStack,
            this._underlineStack, this._strikethroughStack,
            this._markStack,
        );
        registerSizeTags(this._registry, this._sizeStack, this._cspaceStack, this._mspaceStack);
        registerSpecialTags(this._registry, this._nobrStack);
        registerLayoutTags(
            this._registry,
            this._alignStack, this._voffsetStack,
            this._indentStack, this._marginStack,
            this._lineHeightStack,
            this._lineIndentStack,
        );
        registerCaseTags(
            this._registry,
            this._allCapsStack, this._lowercaseStack, this._smallCapsStack,
            this._superscriptStack, this._subscriptStack,
            this._voffsetStack, this._sizeStack,
        );
        registerLinkTags(this._registry, this._linkStack, this._linkIdStack);
        registerFontTags(this._registry, this._fontStack, this._fontWeightStack, this._materialStack);
        registerTransformTags(this._registry, this._charScaleStack, this._rotationStack);
        registerGradientTags(this._registry, this._gradientStack);

        // <width=N> — constrain text area width
        this._registry.register('width',
            (state, value, baseFontSize) => {
                const w = parseUnit(value, baseFontSize);
                this._widthStack.push(w);
                state.widthConstraint = w;
            },
            (state) => { state.widthConstraint = this._widthStack.pop(); },
        );

        // Standalone <material="name"> tag — changes SDF material without changing font
        this._registry.register('material',
            (state, value) => {
                this._materialStack.push(value);
                state.material = value;
            },
            (state) => { state.material = this._materialStack.pop(); },
        );

        // Register <style> tag (handler is a no-op; resolved inline below)
        this._registry.register('style', () => {}, () => {});
    }

    /** The tag registry, for registering custom tags. */
    get registry(): TagRegistry {
        return this._registry;
    }

    /**
     * Parse a rich text string into a flat array of ParsedChars.
     */
    parse(text: string, baseFontSize: number, baseColor: number, baseFontFamily: string): ParsedChar[] {
        const result: ParsedChar[] = [];

        // Reset all stacks
        this._colorStack.reset(baseColor);
        this._alphaStack.reset(1);
        this._sizeStack.reset(baseFontSize);
        this._boldStack.reset(false);
        this._italicStack.reset(false);
        this._underlineStack.reset(false);
        this._strikethroughStack.reset(false);
        this._markStack.reset(0);
        this._cspaceStack.reset(0);
        this._mspaceStack.reset(0);
        this._nobrStack.reset(false);
        this._alignStack.reset('');
        this._voffsetStack.reset(0);
        this._indentStack.reset(0);
        this._marginStack.reset(0);
        this._lineHeightStack.reset(0);
        this._allCapsStack.reset(false);
        this._lowercaseStack.reset(false);
        this._smallCapsStack.reset(false);
        this._superscriptStack.reset(false);
        this._subscriptStack.reset(false);
        this._linkStack.reset(false);
        this._linkIdStack.reset('');
        this._fontStack.reset(baseFontFamily);
        this._charScaleStack.reset(1);
        this._rotationStack.reset(0);
        this._gradientStack.reset([]);
        this._widthStack.reset(0);
        this._styleNameStack.reset('');
        this._fontWeightStack.reset('');
        this._lineIndentStack.reset(0);
        this._materialStack.reset('');

        const state = createDefaultStyleState(baseFontSize, baseColor, baseFontFamily);
        let noparse = false;
        let pendingSpace = 0;
        let pendingPos = NaN;
        let i = 0;

        while (i < text.length) {
            const char = text[i];

            // Check for </noparse> in noparse mode
            if (char === '<' && noparse) {
                if (text.substring(i, i + 10).toLowerCase() === '</noparse>') {
                    noparse = false;
                    i += 10;
                    continue;
                }
                result.push(createParsedChar('<', i, state));
                i++;
                continue;
            }

            // Try to parse a tag
            if (char === '<' && !noparse) {
                // <#RRGGBB>, <#RRGGBBAA>, <#RGB>, <#RGBA> — standalone color shorthand
                if (text[i + 1] === '#') {
                    const closeIdx = text.indexOf('>', i + 2);
                    if (closeIdx !== -1) {
                        const hexStr = text.substring(i + 2, closeIdx).trim();
                        if (/^[0-9a-fA-F]{3,8}$/.test(hexStr)) {
                            const color = parseColor('#' + hexStr);
                            this._colorStack.push(color);
                            state.color = color;
                            i = closeIdx + 1;
                            continue;
                        }
                    }
                }

                // </#> — close standalone color shorthand
                if (text[i + 1] === '/' && text[i + 2] === '#' && text[i + 3] === '>') {
                    state.color = this._colorStack.pop();
                    i += 4;
                    continue;
                }

                const tag = this._tryParseTag(text, i);

                if (tag) {
                    const lowerName = tag.tagName.toLowerCase();

                    // <noparse>
                    if (lowerName === 'noparse' && !tag.isClosing) {
                        noparse = true;
                        i += tag.length;
                        continue;
                    }

                    // <br> — insert line break
                    if (lowerName === 'br' && !tag.isClosing) {
                        result.push(createParsedChar('\n', i, state));
                        i += tag.length;
                        continue;
                    }

                    // <nbsp> — insert non-breaking space (U+00A0)
                    if (lowerName === 'nbsp' && !tag.isClosing) {
                        const pc = createParsedChar('\u00A0', i, state);
                        pc.isNoBreak = true;
                        result.push(pc);
                        i += tag.length;
                        continue;
                    }

                    // <zwsp> — insert zero-width space (U+200B)
                    if (lowerName === 'zwsp' && !tag.isClosing) {
                        result.push(createParsedChar('\u200B', i, state));
                        i += tag.length;
                        continue;
                    }

                    // <softhyphen> / <shy> — insert soft hyphen (U+00AD)
                    if ((lowerName === 'softhyphen' || lowerName === 'shy') && !tag.isClosing) {
                        result.push(createParsedChar('\u00AD', i, state));
                        i += tag.length;
                        continue;
                    }

                    // <en-space> — insert en space (U+2002)
                    if (lowerName === 'en-space' && !tag.isClosing) {
                        result.push(createParsedChar('\u2002', i, state));
                        i += tag.length;
                        continue;
                    }

                    // <em-space> — insert em space (U+2003)
                    if (lowerName === 'em-space' && !tag.isClosing) {
                        result.push(createParsedChar('\u2003', i, state));
                        i += tag.length;
                        continue;
                    }

                    // <cr> — insert carriage return (U+000D)
                    if (lowerName === 'cr' && !tag.isClosing) {
                        result.push(createParsedChar('\r', i, state));
                        i += tag.length;
                        continue;
                    }

                    // <zwj> — insert zero-width joiner (U+200D)
                    if (lowerName === 'zwj' && !tag.isClosing) {
                        result.push(createParsedChar('\u200D', i, state));
                        i += tag.length;
                        continue;
                    }

                    // <space=N> — add horizontal space to next char
                    if (lowerName === 'space' && !tag.isClosing) {
                        pendingSpace += parseUnit(tag.value, baseFontSize);
                        i += tag.length;
                        continue;
                    }

                    // <pos=N> — set absolute position for next char
                    if (lowerName === 'pos' && !tag.isClosing) {
                        pendingPos = parseUnit(tag.value, baseFontSize);
                        i += tag.length;
                        continue;
                    }

                    // <sprite> — insert inline sprite placeholder
                    if (lowerName === 'sprite' && !tag.isClosing) {
                        const spriteResult = parseSpriteTag(tag.value);
                        const pc = createParsedChar('\uFFFC', i, state); // Object Replacement Character
                        pc.isSprite = true;
                        pc.spriteAsset = spriteResult.atlasName;
                        pc.spriteName = spriteResult.spriteName;
                        pc.spriteIndex = spriteResult.index;
                        pc.spriteTint = spriteResult.tint;
                        if (pendingSpace !== 0) {
                            pc.extraSpace = pendingSpace;
                            pendingSpace = 0;
                        }
                        if (!isNaN(pendingPos)) {
                            pc.fixedPosition = pendingPos;
                            pendingPos = NaN;
                        }
                        result.push(pc);
                        i += tag.length;
                        continue;
                    }

                    // <style="name"> — expand style preset
                    if (lowerName === 'style' && this.styleSheet) {
                        if (!tag.isClosing) {
                            const preset = this.styleSheet.get(tag.value);
                            if (preset) {
                                this._styleNameStack.push(tag.value);
                                this._applyStylePresetOpen(state, preset.open, baseFontSize);
                            }
                        } else {
                            // Get the current style name before popping
                            const styleName = this._styleNameStack.current;
                            this._styleNameStack.pop();
                            const preset = styleName ? this.styleSheet.get(styleName) : null;
                            if (preset) {
                                this._applyStylePresetClose(state, preset.close, baseFontSize);
                            }
                        }
                        i += tag.length;
                        continue;
                    }

                    // Look up tag handler
                    const entry = this._registry.getByHash(tag.tagNameHash);
                    if (entry) {
                        if (tag.isClosing) {
                            entry.onClose(state);
                        } else {
                            entry.onOpen(state, tag.value, baseFontSize);
                        }
                        i += tag.length;
                        continue;
                    }
                }

                // Not a valid tag — emit '<' as literal text
                result.push(createParsedChar('<', i, state));
                i++;
                continue;
            }

            // Handle \n line breaks
            if (char === '\n') {
                const pc = createParsedChar('\n', i, state);
                pc.isLineBreak = true;
                result.push(pc);
                i++;
                continue;
            }

            // Skip \r
            if (char === '\r') {
                i++;
                continue;
            }

            // Regular character — apply pending space/pos and case transforms
            const pc = createParsedChar(char, i, state);

            // Apply pending space
            if (pendingSpace !== 0) {
                pc.extraSpace = pendingSpace;
                pendingSpace = 0;
            }

            // Apply pending fixed position
            if (!isNaN(pendingPos)) {
                pc.fixedPosition = pendingPos;
                pendingPos = NaN;
            }

            // Case transforms
            if (state.isAllCaps) {
                pc.char = pc.char.toUpperCase();
                pc.charCode = pc.char.codePointAt(0) ?? pc.charCode;
            } else if (state.isLowercase) {
                pc.char = pc.char.toLowerCase();
                pc.charCode = pc.char.codePointAt(0) ?? pc.charCode;
            } else if (state.isSmallCaps) {
                const upper = pc.char.toUpperCase();
                if (pc.char !== upper) {
                    // Was lowercase — render as uppercase at reduced size
                    pc.char = upper;
                    pc.charCode = upper.codePointAt(0) ?? pc.charCode;
                    pc.fontSize = pc.fontSize * 0.8;
                }
            }

            result.push(pc);
            i++;
        }

        // Post-process: apply gradient color interpolation
        applyGradients(result);

        return result;
    }

    /**
     * Apply the opening tags of a style preset to the current state.
     * Parses the preset's open string for tag effects only.
     */
    private _applyStylePresetOpen(state: StyleState, openMarkup: string, baseFontSize: number): void {
        let j = 0;
        while (j < openMarkup.length) {
            if (openMarkup[j] === '<') {
                const tag = this._tryParseTag(openMarkup, j);
                if (tag && !tag.isClosing) {
                    const entry = this._registry.getByHash(tag.tagNameHash);
                    if (entry) {
                        entry.onOpen(state, tag.value, baseFontSize);
                    }
                    j += tag.length;
                    continue;
                }
            }
            j++;
        }
    }

    /**
     * Apply the closing tags of a style preset to the current state.
     */
    private _applyStylePresetClose(state: StyleState, closeMarkup: string, baseFontSize: number): void {
        let j = 0;
        while (j < closeMarkup.length) {
            if (closeMarkup[j] === '<') {
                const tag = this._tryParseTag(closeMarkup, j);
                if (tag && tag.isClosing) {
                    const entry = this._registry.getByHash(tag.tagNameHash);
                    if (entry) {
                        entry.onClose(state);
                    }
                    j += tag.length;
                    continue;
                }
            }
            j++;
        }
    }

    /**
     * Try to parse a tag at position `pos` in `text`.
     * Returns null if no valid tag found at this position.
     */
    private _tryParseTag(text: string, pos: number): TagParseResult | null {
        if (text[pos] !== '<') return null;

        const closeIdx = text.indexOf('>', pos + 1);
        if (closeIdx === -1) return null;

        const tagLen = closeIdx - pos + 1;
        if (tagLen > 128) return null;

        const inner = text.substring(pos + 1, closeIdx).trim();
        if (inner.length === 0) return null;

        const isClosing = inner[0] === '/';
        const content = isClosing ? inner.slice(1).trim() : inner;

        const eqIdx = content.indexOf('=');
        const spaceIdx = content.indexOf(' ');
        let tagName: string;
        let value = '';

        if (eqIdx !== -1 && (spaceIdx === -1 || eqIdx < spaceIdx)) {
            // Standard format: <tag=value>
            tagName = content.substring(0, eqIdx).trim();
            value = content.substring(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
        } else if (spaceIdx !== -1) {
            // Attribute format: <tag attr="value"> (e.g. <a href="url">)
            tagName = content.substring(0, spaceIdx).trim();
            value = content.substring(spaceIdx + 1).trim();
        } else {
            tagName = content.trim();
        }

        if (tagName.length === 0) return null;

        return {
            tagName,
            tagNameHash: hashCode(tagName.toLowerCase()),
            value,
            isClosing,
            length: tagLen,
        };
    }
}

/**
 * Post-process: interpolate colors across gradient regions.
 * Characters with gradientColors set get their color replaced
 * with a linear interpolation between the gradient endpoints.
 */
function applyGradients(chars: ParsedChar[]): void {
    let gradStart = -1;
    let gradColors: number[] = [];

    for (let i = 0; i <= chars.length; i++) {
        const gc = i < chars.length ? chars[i].gradientColors : [];
        const isGrad = gc.length >= 2;
        const sameGrad = isGrad && gradColors.length >= 2
            && gc[0] === gradColors[0] && gc[1] === gradColors[1];

        // Detect end of gradient region
        if (gradStart >= 0 && !sameGrad) {
            interpolateRegion(chars, gradStart, i - 1, gradColors);
            gradStart = -1;
        }

        if (isGrad && gradStart < 0) {
            gradStart = i;
            gradColors = gc;
        }
    }
}

function interpolateRegion(
    chars: ParsedChar[],
    start: number,
    end: number,
    colors: number[],
): void {
    const count = end - start;
    if (count <= 0) {
        chars[start].color = colors[0];
        return;
    }

    for (let i = start; i <= end; i++) {
        const t = (i - start) / count;
        chars[i].color = lerpColor(colors[0], colors[1], t);
    }
}

function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const blue = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | blue;
}
