import type {
    ParsedChar, CharacterInfo, TextInfo, LineInfo, WordInfo, LinkInfo,
    TextAlignment, DecorationSpan,
} from '../core/types';
import type { TMPFont } from '../font/TMPFont';
import type { TMPTextStyle } from '../core/TMPTextStyle';
import { InlineSpriteManager } from '../sprites/InlineSpriteManager';
import { createLineInfo } from './LineMetrics';
import { acquireCharacterInfo } from './CharacterInfoPool';

/** Soft hyphen codepoint. */
const SOFT_HYPHEN = 0x00AD;
/** Hyphen-minus used as visible replacement for soft hyphens at break points. */
const HYPHEN_MINUS = 0x002D;

/**
 * Layout engine: takes ParsedChar[] + TMPFont → TextInfo with positioned characters.
 *
 * Supports per-character font size, word wrap, justified/flush alignment, indent/margin,
 * sub/sup offsets (from font metrics when available), inline alignment changes,
 * soft hyphen support, dynamic line height, and paragraph spacing in em units.
 */
export class TMPLayoutEngine {
    static layout(
        chars: ParsedChar[],
        font: TMPFont,
        style: TMPTextStyle,
    ): TextInfo {
        const characterInfo: CharacterInfo[] = [];
        const lineInfos: LineInfo[] = [];
        const wordInfos: WordInfo[] = [];

        if (chars.length === 0) {
            return emptyTextInfo(characterInfo, lineInfos, wordInfos);
        }

        const baseFontSize = font.baseMeasurementFontSize;
        const fontLineHeight = font.lineHeight;
        const baseOffset = font.baseLineOffset;
        const wordWrap = style.wordWrap;
        const breakWords = style.breakWords;
        const baseLetterSpacing = style.letterSpacing;
        const baseWordSpacing = style.wordSpacing;
        const characterSpacingEm = style.characterSpacing ?? 0;
        const baseParagraphSpacing = style.paragraphSpacing;
        const styleAlign = style.align;

        // Font ascender/descender for dynamic line height
        const fontAscender = font.fontMetrics.ascent;
        const fontDescender = font.fontMetrics.descent;

        // Component-level margins (from style, not inline tags)
        const styleMarginLeft = style.marginLeft ?? 0;
        const styleMarginRight = style.marginRight ?? 0;
        const styleMarginTop = style.marginTop ?? 0;

        let cursorX = styleMarginLeft;
        let cursorY = baseOffset + styleMarginTop;
        let lineIndex = 0;
        let wordIndex = 0;
        let maxWidth = 0;

        const lineSpacingAdj = style.lineSpacingAdjustment ?? 0;
        const baseLineHeight = (style.lineHeight > 0
            ? style.lineHeight
            : fontLineHeight * (style.fontSize / baseFontSize))
            + lineSpacingAdj;

        // Track current effective line height (can be overridden by <line-height>)
        let currentLineHeight = baseLineHeight;

        // Per-line ascender/descender tracking for dynamic line height
        let lineMaxAscender = -Infinity;
        let lineMaxDescender = Infinity;

        // Get effective alignment for current position
        const getAlign = (pc: ParsedChar): TextAlignment =>
            (pc.align || styleAlign) as TextAlignment;

        // Get effective wrap width considering margin and width constraint
        const getWrapWidth = (pc: ParsedChar): number => {
            const base = pc.widthConstraint > 0 ? pc.widthConstraint : style.wordWrapWidth;
            return base - pc.marginLeft - pc.marginRight - styleMarginLeft - styleMarginRight;
        };

        // Check if alignment is justified or flush for overflow tolerance
        const isJustifiedOrFlush = (align: TextAlignment): boolean =>
            align === 'justified' || align === 'flush';

        let currentLine = createLineInfo(0, cursorY, currentLineHeight, getAlign(chars[0]));

        // Apply line-indent at text start
        if (chars[0].lineIndent > 0) {
            cursorX = chars[0].lineIndent;
        }

        const wordBuffer: CharacterInfo[] = [];
        let wordWidth = 0;
        let wordStart = 0;
        let isFirstWord = true;
        let lineSpaceCount = 0;
        let lineVisibleCount = 0;

        // Soft hyphen tracking
        let softHyphenBreakIndex = -1; // Index in wordBuffer where a soft hyphen sits

        const flushWord = (): void => {
            if (wordBuffer.length === 0) return;

            const wrapWidth = wordBuffer.length > 0
                ? getWrapWidth(chars[wordBuffer[0].index])
                : style.wordWrapWidth;

            // 5% overflow tolerance for justified/flush text
            const effectiveAlign = getAlign(chars[wordBuffer[0].index]);
            const tolerance = isJustifiedOrFlush(effectiveAlign) ? 1.05 : 1.0;
            const addToNextLine = !isFirstWord && wordWrap && (cursorX + wordWidth > wrapWidth * tolerance);

            if (addToNextLine) {
                finalizeLine(currentLine, characterInfo, cursorX, lineSpaceCount, lineVisibleCount, lineMaxAscender, lineMaxDescender);
                lineInfos.push(currentLine);
                maxWidth = Math.max(maxWidth, currentLine.width);

                lineIndex++;
                // Dynamic line height: use tracked ascender/descender if available, otherwise fixed
                if (lineMaxAscender > -Infinity && lineMaxDescender < Infinity) {
                    cursorY += lineMaxAscender - lineMaxDescender;
                } else {
                    cursorY += currentLineHeight;
                }
                cursorX = styleMarginLeft;
                lineSpaceCount = 0;
                lineVisibleCount = 0;
                lineMaxAscender = -Infinity;
                lineMaxDescender = Infinity;

                // Check for indent on new line
                const firstPC = chars[wordBuffer[0].index];
                if (firstPC.indent > 0) {
                    cursorX = firstPC.indent;
                }
                if (firstPC.marginLeft > 0) {
                    cursorX += firstPC.marginLeft;
                }

                currentLine = createLineInfo(characterInfo.length, cursorY, currentLineHeight, getAlign(firstPC));
                isFirstWord = true;
            }

            for (const ci of wordBuffer) {
                ci.x += cursorX;
                ci.lineIndex = lineIndex;
                ci.wordIndex = wordIndex;
                characterInfo.push(ci);
            }

            currentLine.lastCharIndex = characterInfo.length - 1;
            currentLine.characterCount = currentLine.lastCharIndex - currentLine.firstCharIndex + 1;
            cursorX += wordWidth;
            currentLine.width = cursorX;
            isFirstWord = false;

            wordInfos.push({
                firstCharIndex: wordStart,
                lastCharIndex: characterInfo.length - 1,
                characterCount: wordBuffer.length,
                width: wordWidth,
                lineIndex,
            });
            wordIndex++;

            wordBuffer.length = 0;
            wordWidth = 0;
            wordStart = characterInfo.length;
            softHyphenBreakIndex = -1;
        };

        let previousChar: string | null = null;

        for (let i = 0; i < chars.length; i++) {
            const pc = chars[i];

            // Update line height if overridden
            if (pc.lineHeightOverride > 0) {
                currentLineHeight = pc.lineHeightOverride;
            }

            // Line break
            if (pc.isLineBreak) {
                flushWord();

                const ci = createCharacterInfo(i, pc, null, 0, cursorX, cursorY, 0, 0, lineIndex, wordIndex);
                ci.origin = cursorX;
                ci.xAdvance = cursorX;
                characterInfo.push(ci);

                finalizeLine(currentLine, characterInfo, cursorX, lineSpaceCount, lineVisibleCount, lineMaxAscender, lineMaxDescender);
                lineInfos.push(currentLine);
                maxWidth = Math.max(maxWidth, currentLine.width);

                lineIndex++;
                // Paragraph spacing in em units: scale by currentEmScale (fontSize * 0.01)
                const currentEmScale = style.fontSize * 0.01;
                const paragraphExtra = baseParagraphSpacing * currentEmScale;
                // Dynamic line height for explicit line breaks
                if (lineMaxAscender > -Infinity && lineMaxDescender < Infinity) {
                    cursorY += lineMaxAscender - lineMaxDescender + paragraphExtra;
                } else {
                    cursorY += currentLineHeight + paragraphExtra;
                }
                cursorX = styleMarginLeft;
                lineSpaceCount = 0;
                lineVisibleCount = 0;
                lineMaxAscender = -Infinity;
                lineMaxDescender = Infinity;

                // Reset line height for new line
                currentLineHeight = baseLineHeight;

                // Apply indent/lineIndent for new line after explicit \n
                const nextPC = chars[i + 1];
                if (nextPC) {
                    if (nextPC.indent > 0) cursorX = nextPC.indent;
                    if (nextPC.marginLeft > 0) cursorX += nextPC.marginLeft;
                    if (nextPC.lineIndent > 0) cursorX += nextPC.lineIndent;
                    currentLine = createLineInfo(characterInfo.length, cursorY, currentLineHeight, getAlign(nextPC));
                } else {
                    currentLine = createLineInfo(characterInfo.length, cursorY, currentLineHeight, styleAlign);
                }
                isFirstWord = true;
                previousChar = null;
                continue;
            }

            // Tab character: advance to next tab stop
            if (pc.charCode === 0x09) { // '\t'
                flushWord();
                const tabW = font.tabWidth > 0
                    ? font.tabWidth * (style.fontSize / baseFontSize)
                    : style.fontSize * 4; // fallback: 4 em widths
                if (tabW > 0) {
                    cursorX = Math.ceil(cursorX / tabW) * tabW;
                    if (cursorX === 0) cursorX = tabW;
                }
                const ci = createCharacterInfo(i, pc, null, 0, cursorX, cursorY, 0, 0, lineIndex, wordIndex);
                ci.origin = cursorX;
                ci.xAdvance = cursorX;
                characterInfo.push(ci);
                currentLine.width = cursorX;
                currentLine.lastCharIndex = characterInfo.length - 1;
                currentLine.characterCount = currentLine.lastCharIndex - currentLine.firstCharIndex + 1;
                wordStart = characterInfo.length;
                previousChar = null;
                continue;
            }

            // Apply extra space from <space=N>
            if (pc.extraSpace > 0) {
                cursorX += pc.extraSpace;
                // Also add to word buffer width if we're in a word
                if (wordBuffer.length > 0) {
                    wordWidth += pc.extraSpace;
                }
            }

            // Apply fixed position from <pos=N>
            if (!isNaN(pc.fixedPosition)) {
                flushWord();
                cursorX = pc.fixedPosition;
            }

            // Handle inline sprites
            if (pc.isSprite) {
                let sprite: import('../sprites/InlineSpriteData').InlineSpriteEntry | undefined;
                if (pc.spriteIndex >= 0) {
                    sprite = pc.spriteAsset
                        ? InlineSpriteManager.getSpriteByIndex(pc.spriteAsset, pc.spriteIndex)
                        : InlineSpriteManager.findSpriteByIndex(pc.spriteIndex);
                } else {
                    sprite = pc.spriteAsset
                        ? InlineSpriteManager.getSprite(pc.spriteAsset, pc.spriteName)
                        : InlineSpriteManager.findSprite(pc.spriteName);
                }

                if (sprite) {
                    const spriteScale = pc.fontSize / baseFontSize;
                    const w = (sprite.width || sprite.texture.width) * spriteScale;
                    const h = (sprite.height || sprite.texture.height) * spriteScale;
                    const advance = (sprite.xAdvance || w) * spriteScale;
                    const yOff = sprite.yOffset * spriteScale;

                    const ci = createCharacterInfo(
                        i, pc, sprite.texture, spriteScale,
                        wordWidth, yOff, w, h,
                        lineIndex, wordIndex,
                    );
                    ci.isVisible = true;
                    ci.elementType = 'sprite';
                    ci.origin = cursorX + wordWidth;
                    ci.xAdvance = cursorX + wordWidth + advance;
                    ci.ascender = -yOff;
                    ci.descender = -yOff - h;
                    if (pc.spriteTint >= 0) {
                        ci.color = pc.spriteTint;
                    }

                    // Update per-line ascender/descender
                    lineMaxAscender = Math.max(lineMaxAscender, ci.ascender);
                    lineMaxDescender = Math.min(lineMaxDescender, ci.descender);
                    lineVisibleCount++;

                    wordBuffer.push(ci);
                    wordWidth += advance;
                }

                previousChar = null;
                continue;
            }

            // Soft hyphen handling: mark as break opportunity but don't render
            if (pc.charCode === SOFT_HYPHEN) {
                // Record soft hyphen position in the word buffer as a potential break point
                softHyphenBreakIndex = wordBuffer.length;
                previousChar = pc.char;
                continue;
            }

            // Zero-width space (U+200B): acts as a word break opportunity with zero advance
            if (pc.charCode === 0x200B) {
                flushWord();
                // Emit a zero-width invisible character
                const ci = createCharacterInfo(i, pc, null, 0, cursorX, cursorY, 0, 0, lineIndex, wordIndex);
                ci.origin = cursorX;
                ci.xAdvance = cursorX;
                characterInfo.push(ci);
                currentLine.lastCharIndex = characterInfo.length - 1;
                currentLine.characterCount = currentLine.lastCharIndex - currentLine.firstCharIndex + 1;
                wordStart = characterInfo.length;
                previousChar = null;
                continue;
            }

            const charScale = pc.fontSize / baseFontSize;
            // Apply <scale=N> tag multiplier on top of font-size scale
            const totalCharScale = charScale * pc.charScale;

            // Sub/sup offset: prefer font metrics when available, fallback to parser-provided voffset
            let effectiveVOffset = pc.voffset;
            if (pc.isSuperscript && font.superscriptOffset !== 0) {
                effectiveVOffset = font.superscriptOffset * charScale;
            } else if (pc.isSubscript && font.subscriptOffset !== 0) {
                effectiveVOffset = font.subscriptOffset * charScale;
            }

            // Try primary font, then fallbacks, then space as last resort
            const lookup = font.getCharWithFallback(pc.char);
            const charData = lookup?.charData ?? font.chars[' '];
            if (!charData) {
                previousChar = pc.char;
                continue;
            }

            const isSpace = /\s/.test(pc.char);
            const kerning = previousChar ? (charData.kerning[previousChar] ?? 0) : 0;
            // Em-based characterSpacing: em units * fontSize / 100 (Unity convention: em = fontSize * 0.01)
            const emSpacing = characterSpacingEm * pc.fontSize * 0.01;
            const letterSpacing = (baseLetterSpacing + pc.cspace + emSpacing) * (baseFontSize / pc.fontSize);

            // Bold spacing: add extra advance per bold character (Unity: boldSpacing in font em units)
            const boldExtra = pc.bold ? (font.boldSpacing / baseFontSize) * totalCharScale : 0;

            let advance: number;
            if (pc.mspace > 0) {
                advance = pc.mspace * pc.charScale;
            } else {
                advance = (charData.xAdvance + kerning + letterSpacing) * totalCharScale + boldExtra;
            }

            if (isSpace && !pc.isNoBreak) {
                flushWord();

                const ci = createCharacterInfo(
                    i, pc, null, charScale,
                    cursorX, cursorY, 0, 0,
                    lineIndex, wordIndex,
                );
                ci.origin = cursorX;
                ci.xAdvance = cursorX + advance + baseWordSpacing;
                ci.ascender = fontAscender * charScale;
                ci.descender = fontDescender * charScale;
                characterInfo.push(ci);
                cursorX += advance + baseWordSpacing;
                currentLine.width = cursorX;
                currentLine.lastCharIndex = characterInfo.length - 1;
                currentLine.characterCount = currentLine.lastCharIndex - currentLine.firstCharIndex + 1;
                lineSpaceCount++;
                wordStart = characterInfo.length;
            } else if (isSpace && pc.isNoBreak) {
                // Inside <nobr> — treat space as part of the current word (no break opportunity)
                const texture = charData.texture ?? null;
                const ci = createCharacterInfo(
                    i, pc, texture, charScale,
                    wordWidth, 0, 0, 0,
                    lineIndex, wordIndex,
                );
                ci.origin = cursorX + wordWidth;
                ci.xAdvance = cursorX + wordWidth + advance;
                ci.ascender = fontAscender * charScale;
                ci.descender = fontDescender * charScale;
                wordBuffer.push(ci);
                wordWidth += advance;
            } else {
                const wrapWidth = getWrapWidth(pc);
                // 5% overflow tolerance for justified/flush text
                const effectiveAlign = getAlign(pc);
                const tolerance = isJustifiedOrFlush(effectiveAlign) ? 1.05 : 1.0;

                if (breakWords && wordWrap && cursorX + wordWidth + advance > wrapWidth * tolerance && wordBuffer.length > 0) {
                    // Check if we can break at a soft hyphen position instead
                    if (softHyphenBreakIndex > 0 && softHyphenBreakIndex < wordBuffer.length) {
                        // Break at soft hyphen: insert visible hyphen at the break point
                        const hyphenChar = font.chars[String.fromCodePoint(HYPHEN_MINUS)];
                        if (hyphenChar) {
                            const hyphenScale = chars[wordBuffer[softHyphenBreakIndex - 1].index].fontSize / baseFontSize;
                            const hyphenCi = acquireCharacterInfo();
                            const prevInBuffer = wordBuffer[softHyphenBreakIndex - 1];
                            hyphenCi.index = prevInBuffer.index;
                            hyphenCi.char = '-';
                            hyphenCi.isVisible = true;
                            hyphenCi.texture = hyphenChar.texture ?? null;
                            hyphenCi.x = prevInBuffer.x + prevInBuffer.width;
                            hyphenCi.y = prevInBuffer.y;
                            hyphenCi.width = hyphenChar.texture ? hyphenChar.texture.orig.width * hyphenScale : 0;
                            hyphenCi.height = hyphenChar.texture ? hyphenChar.texture.orig.height * hyphenScale : 0;
                            hyphenCi.scale = hyphenScale;
                            hyphenCi.color = prevInBuffer.color;
                            hyphenCi.alpha = prevInBuffer.alpha;
                            hyphenCi.bold = prevInBuffer.bold;
                            hyphenCi.italic = prevInBuffer.italic;
                            hyphenCi.underline = prevInBuffer.underline;
                            hyphenCi.strikethrough = prevInBuffer.strikethrough;
                            hyphenCi.markColor = prevInBuffer.markColor;
                            hyphenCi.charScale = 1;
                            hyphenCi.rotation = 0;
                            hyphenCi.lineIndex = lineIndex;
                            hyphenCi.wordIndex = wordIndex;
                            hyphenCi.origin = cursorX + prevInBuffer.x + prevInBuffer.width;
                            hyphenCi.xAdvance = cursorX + prevInBuffer.x + prevInBuffer.width + hyphenChar.xAdvance * hyphenScale;
                            hyphenCi.ascender = fontAscender * hyphenScale;
                            hyphenCi.descender = fontDescender * hyphenScale;
                            hyphenCi.elementType = 'character';

                            // Split: flush chars up to soft hyphen + visible hyphen, keep rest
                            const firstHalf = wordBuffer.splice(0, softHyphenBreakIndex);
                            firstHalf.push(hyphenCi);
                            const remainingBuffer = wordBuffer.splice(0);

                            // Flush first half
                            for (const c of firstHalf) {
                                c.x += cursorX;
                                c.lineIndex = lineIndex;
                                c.wordIndex = wordIndex;
                                characterInfo.push(c);
                                if (c.isVisible) lineVisibleCount++;
                                lineMaxAscender = Math.max(lineMaxAscender, c.ascender);
                                lineMaxDescender = Math.min(lineMaxDescender, c.descender);
                            }
                            const firstHalfWidth = hyphenCi.xAdvance - cursorX;
                            cursorX += firstHalfWidth;
                            currentLine.width = cursorX;
                            currentLine.lastCharIndex = characterInfo.length - 1;
                            currentLine.characterCount = currentLine.lastCharIndex - currentLine.firstCharIndex + 1;

                            finalizeLine(currentLine, characterInfo, cursorX, lineSpaceCount, lineVisibleCount, lineMaxAscender, lineMaxDescender);
                            lineInfos.push(currentLine);
                            maxWidth = Math.max(maxWidth, currentLine.width);

                            lineIndex++;
                            if (lineMaxAscender > -Infinity && lineMaxDescender < Infinity) {
                                cursorY += lineMaxAscender - lineMaxDescender;
                            } else {
                                cursorY += currentLineHeight;
                            }
                            cursorX = styleMarginLeft;
                            lineSpaceCount = 0;
                            lineVisibleCount = 0;
                            lineMaxAscender = -Infinity;
                            lineMaxDescender = Infinity;
                            if (pc.marginLeft > 0) cursorX += pc.marginLeft;
                            currentLine = createLineInfo(characterInfo.length, cursorY, currentLineHeight, getAlign(pc));
                            isFirstWord = true;
                            wordIndex++;

                            // Re-position remaining chars relative to 0
                            const offsetX = remainingBuffer.length > 0 ? remainingBuffer[0].x : 0;
                            wordWidth = 0;
                            for (const c of remainingBuffer) {
                                c.x -= offsetX;
                                wordWidth = Math.max(wordWidth, c.x + (c.width || advance));
                            }
                            wordBuffer.length = 0;
                            wordBuffer.push(...remainingBuffer);
                            wordStart = characterInfo.length;
                            softHyphenBreakIndex = -1;
                        }
                    } else {
                        flushWord();
                        finalizeLine(currentLine, characterInfo, cursorX, lineSpaceCount, lineVisibleCount, lineMaxAscender, lineMaxDescender);
                        lineInfos.push(currentLine);
                        maxWidth = Math.max(maxWidth, currentLine.width);

                        lineIndex++;
                        if (lineMaxAscender > -Infinity && lineMaxDescender < Infinity) {
                            cursorY += lineMaxAscender - lineMaxDescender;
                        } else {
                            cursorY += currentLineHeight;
                        }
                        cursorX = styleMarginLeft;
                        lineSpaceCount = 0;
                        lineVisibleCount = 0;
                        lineMaxAscender = -Infinity;
                        lineMaxDescender = Infinity;
                        if (pc.marginLeft > 0) cursorX += pc.marginLeft;
                        currentLine = createLineInfo(characterInfo.length, cursorY, currentLineHeight, getAlign(pc));
                        isFirstWord = true;
                    }
                }

                const texture = charData.texture ?? null;
                // Bold weight simulation: expand glyph quad to shift SDF edge outward
                const boldExpand = pc.bold ? font.boldStyle * totalCharScale : 0;
                const w = texture ? texture.orig.width * totalCharScale + boldExpand : 0;
                const h = texture ? texture.orig.height * totalCharScale + boldExpand : 0;
                const xOff = charData.xOffset * totalCharScale - boldExpand * 0.5;
                const yOff = (charData.yOffset + effectiveVOffset) * totalCharScale - boldExpand * 0.5;

                const ci = createCharacterInfo(
                    i, pc, texture, charScale,
                    wordWidth + xOff + kerning * charScale,
                    yOff,
                    w, h,
                    lineIndex, wordIndex,
                );
                ci.isVisible = texture !== null;
                ci.origin = cursorX + wordWidth;
                ci.xAdvance = cursorX + wordWidth + advance;

                // Compute glyph ascender/descender
                const glyphAscender = (charData.yOffset) * totalCharScale;
                const glyphDescender = (charData.yOffset - (charData.texture ? charData.texture.orig.height : 0)) * totalCharScale;
                ci.ascender = Math.max(fontAscender * totalCharScale, glyphAscender);
                ci.descender = Math.min(fontDescender * totalCharScale, glyphDescender);

                // Update per-line ascender/descender
                if (ci.isVisible) {
                    lineMaxAscender = Math.max(lineMaxAscender, ci.ascender);
                    lineMaxDescender = Math.min(lineMaxDescender, ci.descender);
                    lineVisibleCount++;
                }

                wordBuffer.push(ci);
                wordWidth += advance;
            }

            previousChar = pc.char;
        }

        flushWord();

        finalizeLine(currentLine, characterInfo, cursorX, lineSpaceCount, lineVisibleCount, lineMaxAscender, lineMaxDescender);
        lineInfos.push(currentLine);
        maxWidth = Math.max(maxWidth, currentLine.width);

        const totalHeight = cursorY + currentLineHeight - baseOffset;

        // Alignment: use wordWrapWidth (container width) as reference, not widest line
        const alignmentWidth = style.wordWrap ? style.wordWrapWidth : maxWidth;
        applyAlignment(lineInfos, characterInfo, alignmentWidth, styleAlign, style.wordWrappingRatios);

        // Overflow handling
        const overflowMode = style.overflowMode;
        const containerH = style.containerHeight;
        if (overflowMode !== 'overflow' && containerH > 0 && totalHeight > containerH) {
            applyOverflow(lineInfos, characterInfo, wordInfos, containerH, overflowMode, font, style.fontSize / baseFontSize);
            // Recalculate total height after truncation
            if (lineInfos.length > 0) {
                maxWidth = 0;
                for (const line of lineInfos) {
                    maxWidth = Math.max(maxWidth, line.width);
                }
            }
        }

        // Vertical alignment
        const vertAlign = style.verticalAlign;
        if (vertAlign !== 'top' && containerH > 0) {
            let yOffset = 0;
            if (vertAlign === 'middle') {
                yOffset = (containerH - totalHeight) / 2;
            } else if (vertAlign === 'bottom') {
                yOffset = containerH - totalHeight;
            } else if (vertAlign === 'baseline' && lineInfos.length > 0) {
                // Align first line's baseline to container center
                const firstLine = lineInfos[0];
                const baselineY = firstLine.y + firstLine.ascender;
                yOffset = (containerH / 2) - baselineY;
            } else if (vertAlign === 'midline') {
                // Align to the font's meanLine (x-height midpoint)
                const meanLineOffset = font.meanLine * (style.fontSize / baseFontSize);
                yOffset = (containerH / 2) - meanLineOffset;
            } else if (vertAlign === 'capline') {
                // Align to the font's capLine (cap height)
                const capLineOffset = font.capLine * (style.fontSize / baseFontSize);
                yOffset = (containerH / 2) - capLineOffset;
            } else if (vertAlign === 'geometry') {
                // Align based on actual glyph geometry bounds
                let minY = Infinity;
                let maxY = -Infinity;
                for (let i = 0; i < characterInfo.length; i++) {
                    if (characterInfo[i].isVisible) {
                        minY = Math.min(minY, characterInfo[i].y);
                        maxY = Math.max(maxY, characterInfo[i].y + characterInfo[i].height);
                    }
                }
                if (minY < Infinity) {
                    const geomHeight = maxY - minY;
                    yOffset = (containerH - geomHeight) / 2 - minY;
                }
            }
            if (yOffset !== 0) {
                for (let i = 0; i < characterInfo.length; i++) {
                    characterInfo[i].y += yOffset;
                }
                for (let i = 0; i < lineInfos.length; i++) {
                    lineInfos[i].y += yOffset;
                }
            }
        }

        const linkInfos = buildLinkInfo(chars, characterInfo, lineInfos);

        return {
            characterInfo,
            lineInfo: lineInfos,
            wordInfo: wordInfos,
            linkInfo: linkInfos,
            characterCount: characterInfo.length,
            lineCount: lineInfos.length,
            wordCount: wordInfos.length,
            linkCount: linkInfos.length,
            width: maxWidth,
            height: totalHeight,
        };
    }

    /**
     * Build decoration spans (underline, strikethrough, mark) from character info.
     * Called by the render pipe after layout.
     */
    static buildDecorations(
        textInfo: TextInfo,
        font: TMPFont,
        baseFontSize: number,
    ): DecorationSpan[] {
        const spans: DecorationSpan[] = [];
        const chars = textInfo.characterInfo;
        const lines = textInfo.lineInfo;

        if (chars.length === 0) return spans;

        const baseScale = baseFontSize / font.baseMeasurementFontSize;

        // Use font metrics for underline/strikethrough when available, fallback to heuristics
        const underlineY = font.underlineOffset !== 0
            ? -font.underlineOffset * baseScale
            : font.lineHeight * baseScale * 0.85;
        const underlineH = font.underlineThickness !== 0
            ? font.underlineThickness * baseScale
            : Math.max(1, baseFontSize * 0.05);
        const strikeY = font.strikethroughOffset !== 0
            ? -font.strikethroughOffset * baseScale
            : font.lineHeight * baseScale * 0.55;
        const strikeH = font.strikethroughThickness !== 0
            ? font.strikethroughThickness * baseScale
            : underlineH;

        // Track active spans
        let ulStart = -1;
        let stStart = -1;
        let markStart = -1;
        let markColor = 0;
        let prevLine = -1;

        for (let i = 0; i <= chars.length; i++) {
            const ci = i < chars.length ? chars[i] : null;
            const lineChanged = ci ? ci.lineIndex !== prevLine : true;
            const isEnd = i === chars.length;

            // Close spans on line change or end
            if ((lineChanged || isEnd) && prevLine >= 0 && i > 0) {
                const lastOnLine = chars[i - 1];
                const lineY = lines[prevLine]?.y ?? 0;

                if (ulStart >= 0) {
                    spans.push({
                        type: 'underline',
                        color: chars[ulStart].color,
                        x: chars[ulStart].x,
                        y: lineY + underlineY,
                        width: (lastOnLine.x + lastOnLine.width) - chars[ulStart].x,
                        height: underlineH,
                        lineIndex: prevLine,
                    });
                    ulStart = ci?.underline ? i : -1;
                }
                if (stStart >= 0) {
                    spans.push({
                        type: 'strikethrough',
                        color: chars[stStart].color,
                        x: chars[stStart].x,
                        y: lineY + strikeY,
                        width: (lastOnLine.x + lastOnLine.width) - chars[stStart].x,
                        height: strikeH,
                        lineIndex: prevLine,
                    });
                    stStart = ci?.strikethrough ? i : -1;
                }
                if (markStart >= 0) {
                    spans.push({
                        type: 'mark',
                        color: markColor,
                        x: chars[markStart].x,
                        y: lineY,
                        width: (lastOnLine.x + lastOnLine.width) - chars[markStart].x,
                        height: lines[prevLine]?.height ?? baseFontSize,
                        lineIndex: prevLine,
                    });
                    markStart = ci?.markColor ? i : -1;
                    markColor = ci?.markColor ?? 0;
                }
            }

            if (isEnd) break;

            if (ci!.lineIndex !== prevLine) {
                prevLine = ci!.lineIndex;
            }

            // Start/continue underline
            if (ci!.underline && ulStart < 0) {
                ulStart = i;
            } else if (!ci!.underline && ulStart >= 0) {
                const lineY = lines[ci!.lineIndex]?.y ?? 0;
                const prev = chars[i - 1];
                spans.push({
                    type: 'underline',
                    color: chars[ulStart].color,
                    x: chars[ulStart].x,
                    y: lineY + underlineY,
                    width: (prev.x + prev.width) - chars[ulStart].x,
                    height: underlineH,
                    lineIndex: ci!.lineIndex,
                });
                ulStart = -1;
            }

            // Start/continue strikethrough
            if (ci!.strikethrough && stStart < 0) {
                stStart = i;
            } else if (!ci!.strikethrough && stStart >= 0) {
                const lineY = lines[ci!.lineIndex]?.y ?? 0;
                const prev = chars[i - 1];
                spans.push({
                    type: 'strikethrough',
                    color: chars[stStart].color,
                    x: chars[stStart].x,
                    y: lineY + strikeY,
                    width: (prev.x + prev.width) - chars[stStart].x,
                    height: strikeH,
                    lineIndex: ci!.lineIndex,
                });
                stStart = -1;
            }

            // Start/continue mark
            if (ci!.markColor && markStart < 0) {
                markStart = i;
                markColor = ci!.markColor;
            } else if (!ci!.markColor && markStart >= 0) {
                const lineY = lines[ci!.lineIndex]?.y ?? 0;
                const prev = chars[i - 1];
                spans.push({
                    type: 'mark',
                    color: markColor,
                    x: chars[markStart].x,
                    y: lineY,
                    width: (prev.x + prev.width) - chars[markStart].x,
                    height: lines[ci!.lineIndex]?.height ?? baseFontSize,
                    lineIndex: ci!.lineIndex,
                });
                markStart = -1;
            }
        }

        return spans;
    }
}

function emptyTextInfo(
    characterInfo: CharacterInfo[],
    lineInfo: LineInfo[],
    wordInfo: WordInfo[],
): TextInfo {
    return {
        characterInfo, lineInfo, wordInfo,
        linkInfo: [],
        characterCount: 0, lineCount: 0, wordCount: 0,
        linkCount: 0,
        width: 0, height: 0,
    };
}

function createCharacterInfo(
    index: number,
    pc: ParsedChar,
    texture: import('pixi.js').Texture | null,
    scale: number,
    x: number,
    y: number,
    width: number,
    height: number,
    lineIndex: number,
    wordIndex: number,
): CharacterInfo {
    const ci = acquireCharacterInfo();
    ci.index = index;
    ci.char = pc.char;
    ci.isVisible = false;
    ci.texture = texture;
    ci.x = x;
    ci.y = y;
    ci.width = width;
    ci.height = height;
    ci.scale = scale;
    ci.color = pc.color;
    ci.alpha = pc.alpha;
    ci.bold = pc.bold;
    ci.italic = pc.italic;
    ci.underline = pc.underline;
    ci.strikethrough = pc.strikethrough;
    ci.markColor = pc.markColor;
    ci.charScale = pc.charScale;
    ci.rotation = pc.rotation;
    ci.lineIndex = lineIndex;
    ci.wordIndex = wordIndex;
    ci.elementType = pc.isSprite ? 'sprite' : 'character';
    ci.material = pc.material;
    return ci;
}

function finalizeLine(
    line: LineInfo,
    allChars: CharacterInfo[],
    width: number,
    spaceCount: number,
    visibleCount: number,
    maxAscender: number,
    maxDescender: number,
): void {
    let trimmedWidth = width;
    for (let i = allChars.length - 1; i >= line.firstCharIndex; i--) {
        if (allChars[i].char === ' ') {
            trimmedWidth = allChars[i].x;
        } else {
            break;
        }
    }
    line.width = trimmedWidth > 0 ? trimmedWidth : width;
    line.spaceCount = spaceCount;
    line.ascender = maxAscender > -Infinity ? maxAscender : 0;
    line.descender = maxDescender < Infinity ? maxDescender : 0;
    line.visibleCharacterCount = visibleCount;

    if (allChars.length > line.firstCharIndex) {
        line.lastCharIndex = allChars.length - 1;
        line.characterCount = line.lastCharIndex - line.firstCharIndex + 1;

        // Compute maxAdvance from the last character's xAdvance
        const lastChar = allChars[line.lastCharIndex];
        line.maxAdvance = lastChar.xAdvance;

        // Compute firstVisibleCharIndex and lastVisibleCharIndex
        line.firstVisibleCharIndex = -1;
        line.lastVisibleCharIndex = -1;
        for (let i = line.firstCharIndex; i <= line.lastCharIndex; i++) {
            if (allChars[i].isVisible) {
                if (line.firstVisibleCharIndex < 0) {
                    line.firstVisibleCharIndex = i;
                }
                line.lastVisibleCharIndex = i;
            }
        }
    }
}

function applyAlignment(
    lines: LineInfo[],
    chars: CharacterInfo[],
    containerWidth: number,
    defaultAlign: TextAlignment,
    wordWrappingRatios: number,
): void {
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const align = line.alignment || defaultAlign;
        let offset = 0;

        if (align === 'center') {
            offset = (containerWidth - line.width) / 2;
        } else if (align === 'right') {
            offset = containerWidth - line.width;
        } else if (align === 'justified' || align === 'flush') {
            const isLastLine = li === lines.length - 1;
            const endsWithBreak = line.lastCharIndex < chars.length && chars[line.lastCharIndex]?.char === '\n';
            const isFlush = align === 'flush';

            // In Justified mode, all lines are justified except the last one.
            // In Flush mode, all lines are justified including the last.
            if ((!isLastLine && !endsWithBreak) || isFlush || line.maxAdvance > containerWidth) {
                const gap = containerWidth - line.width;

                if (gap > 0) {
                    // Count visible characters (excluding first) and spaces
                    let visibleCount = 0;
                    let spaces = 0;
                    let isFirstVisible = true;

                    for (let i = line.firstCharIndex; i <= line.lastCharIndex && i < chars.length; i++) {
                        if (chars[i].isVisible) {
                            if (isFirstVisible) {
                                isFirstVisible = false;
                            } else {
                                visibleCount++;
                            }
                        }
                        if (chars[i].char === ' ') {
                            spaces++;
                        }
                    }

                    // Use wordWrappingRatios to distribute between words and characters
                    // ratio=0: all gap between words, ratio=1: all gap between chars
                    const ratio = spaces > 0 ? wordWrappingRatios : 1;
                    const safeSpaces = Math.max(spaces, 1);
                    const safeVisible = Math.max(visibleCount, 1);
                    const spaceExtra = gap * (1 - ratio) / safeSpaces;
                    const charExtra = gap * ratio / safeVisible;

                    let cumulativeOffset = 0;
                    let isFirstVisibleChar = true;

                    for (let i = line.firstCharIndex; i <= line.lastCharIndex && i < chars.length; i++) {
                        if (i > line.firstCharIndex) {
                            if (chars[i].char === ' ') {
                                cumulativeOffset += spaceExtra;
                            } else if (chars[i].isVisible && !isFirstVisibleChar) {
                                cumulativeOffset += charExtra;
                            }
                        }
                        if (chars[i].isVisible && isFirstVisibleChar) {
                            isFirstVisibleChar = false;
                        }
                        chars[i].x += cumulativeOffset;
                    }

                    line.width = containerWidth;
                    line.alignmentOffset = 0;
                    continue;
                }
            }
            // Fall through to left alignment for last line (justified) / single-word lines
        }

        if (offset !== 0) {
            line.alignmentOffset = offset;
            for (let i = line.firstCharIndex; i <= line.lastCharIndex && i < chars.length; i++) {
                chars[i].x += offset;
            }
        }
    }
}

/**
 * Build LinkInfo array from parsed chars and positioned character info.
 * Groups consecutive characters with the same linkId into link regions
 * and computes bounding rects per line for hit testing.
 */
function buildLinkInfo(
    parsed: ParsedChar[],
    chars: CharacterInfo[],
    lines: LineInfo[],
): LinkInfo[] {
    const links: LinkInfo[] = [];
    let currentLinkId = '';
    let linkStart = -1;

    for (let i = 0; i <= chars.length; i++) {
        const pc = i < parsed.length ? parsed[chars[i]?.index ?? i] : null;
        const linkId = pc?.isLink ? pc.linkId : '';

        if (linkId !== currentLinkId) {
            // Close current link
            if (currentLinkId && linkStart >= 0) {
                links.push(createLinkInfo(currentLinkId, linkStart, i - 1, chars, lines));
            }
            // Start new link
            currentLinkId = linkId;
            linkStart = linkId ? i : -1;
        }
    }

    return links;
}

function createLinkInfo(
    linkId: string,
    firstIdx: number,
    lastIdx: number,
    chars: CharacterInfo[],
    lines: LineInfo[],
): LinkInfo {
    const rects: { x: number; y: number; width: number; height: number }[] = [];

    let lineStart = firstIdx;
    let currentLine = chars[firstIdx].lineIndex;

    for (let i = firstIdx; i <= lastIdx + 1; i++) {
        const ci = i <= lastIdx ? chars[i] : null;
        const lineChanged = ci ? ci.lineIndex !== currentLine : true;

        if (lineChanged && lineStart <= i - 1) {
            const first = chars[lineStart];
            const last = chars[i - 1];
            const line = lines[currentLine];
            rects.push({
                x: first.x,
                y: line?.y ?? first.y,
                width: (last.x + last.width) - first.x,
                height: line?.height ?? 20,
            });

            if (ci) {
                lineStart = i;
                currentLine = ci.lineIndex;
            }
        }
    }

    return { linkId, firstCharIndex: firstIdx, lastCharIndex: lastIdx, rects };
}

/**
 * Apply overflow truncation to the layout results.
 * For 'truncate', removes lines that exceed containerHeight.
 * For 'ellipsis', replaces the last visible characters with '...'
 */
function applyOverflow(
    lines: LineInfo[],
    chars: CharacterInfo[],
    words: WordInfo[],
    containerHeight: number,
    mode: 'truncate' | 'ellipsis',
    font: TMPFont,
    charScale: number,
): void {
    // Find the last line that fits within containerHeight
    let lastVisibleLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].y + lines[i].height <= containerHeight) {
            lastVisibleLine = i;
        } else {
            break;
        }
    }

    if (lastVisibleLine < 0) lastVisibleLine = 0;

    const lastLine = lines[lastVisibleLine];
    const cutIdx = lastLine.lastCharIndex + 1;

    // Remove characters and lines beyond the visible area
    chars.length = cutIdx;
    lines.length = lastVisibleLine + 1;

    // Trim word info
    while (words.length > 0 && words[words.length - 1].firstCharIndex >= cutIdx) {
        words.pop();
    }

    // For ellipsis mode, replace last 3 visible characters with dots
    if (mode === 'ellipsis' && cutIdx > 0) {
        const ellipsis = '\u2026'; // …
        const dotChar = font.chars[ellipsis] ?? font.chars['.'];
        if (dotChar) {
            const dotWidth = dotChar.xAdvance * charScale;
            // Remove characters from the end to make room for ellipsis
            let removedWidth = 0;
            while (chars.length > lastLine.firstCharIndex && removedWidth < dotWidth) {
                const last = chars[chars.length - 1];
                removedWidth += last.width || dotWidth / 3;
                chars.pop();
            }
            // Add ellipsis character
            if (chars.length > 0) {
                const prev = chars[chars.length - 1];
                const ci = acquireCharacterInfo();
                ci.index = prev.index + 1;
                ci.char = ellipsis;
                ci.isVisible = true;
                ci.texture = dotChar.texture ?? null;
                ci.x = prev.x + prev.width;
                ci.y = prev.y;
                ci.width = dotChar.texture ? dotChar.texture.orig.width * charScale : dotWidth;
                ci.height = dotChar.texture ? dotChar.texture.orig.height * charScale : prev.height;
                ci.scale = charScale;
                ci.color = prev.color;
                ci.alpha = prev.alpha;
                ci.bold = prev.bold;
                ci.italic = prev.italic;
                ci.underline = false;
                ci.strikethrough = false;
                ci.markColor = 0;
                ci.charScale = 1;
                ci.rotation = 0;
                ci.lineIndex = prev.lineIndex;
                ci.wordIndex = prev.wordIndex;
                ci.origin = prev.xAdvance;
                ci.xAdvance = prev.xAdvance + dotWidth;
                ci.ascender = prev.ascender;
                ci.descender = prev.descender;
                ci.elementType = 'character';
                ci.material = '';
                chars.push(ci);
            }
        }
    }

    // Update last line metrics
    if (lines.length > 0) {
        const last = lines[lines.length - 1];
        last.lastCharIndex = chars.length - 1;
        last.characterCount = last.lastCharIndex - last.firstCharIndex + 1;
    }
}
