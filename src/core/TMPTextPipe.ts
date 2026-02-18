import {
    ExtensionType,
    Graphics,
} from 'pixi.js';
import type { Renderer, InstructionSet } from 'pixi.js';
import { TMPShader } from '../shader/TMPShader';
import { TMPMaterial } from './TMPMaterial';
import { TMPLayoutEngine } from '../layout/TMPLayoutEngine';
import type { TMPText } from './TMPText';

/**
 * Proxy Graphics subclass that cleans up its custom shader on destroy.
 */
class TMPTextGraphics extends Graphics {
    /** @internal Track when last used for GC. */
    _gcLastUsed = -1;

    _onTouch(now: number): void {
        this._gcLastUsed = now;
    }

    destroy(): void {
        if (this.context.customShader) {
            this.context.customShader.destroy();
        }
        super.destroy();
    }
}

/**
 * Render pipe for TMPText — follows the same proxy Graphics pattern
 * as PixiJS's BitmapTextPipe but with per-character color tinting.
 *
 * When text uses multiple materials (via `<font material="...">` or
 * `<material="...">`), one proxy is created per unique material,
 * each with its own TMPShader and SDF uniforms. This mirrors Unity TMP's
 * one-mesh-per-material approach.
 *
 * Registered as a PixiJS extension for both WebGL and WebGPU pipes.
 */
export class TMPTextPipe {
    /** @internal */
    static extension = {
        type: [
            ExtensionType.WebGLPipes,
            ExtensionType.WebGPUPipes,
        ],
        name: 'tmpText',
    };

    private _renderer: Renderer;
    /** Map from TMPText to { materialName -> TMPTextGraphics proxy }. */
    private _gpuMap = new WeakMap<TMPText, Map<string, TMPTextGraphics>>();

    constructor(renderer: Renderer) {
        this._renderer = renderer;
    }

    validateRenderable(tmpText: TMPText): boolean {
        const proxyMap = this._getProxies(tmpText);
        const proxy = this._getOrCreateProxy(proxyMap, '');
        return this._renderer.renderPipes.graphics.validateRenderable(proxy);
    }

    addRenderable(tmpText: TMPText, instructionSet: InstructionSet): void {
        const proxyMap = this._getProxies(tmpText);

        if (tmpText._didTextUpdate) {
            tmpText._didTextUpdate = false;
            if (tmpText._didVerticesUpdate) {
                tmpText._didVerticesUpdate = false;
            }
            this._updateContexts(tmpText, proxyMap);
        }

        for (const [materialName, proxy] of proxyMap) {
            syncWithProxy(tmpText, proxy);
            this._renderer.renderPipes.graphics.addRenderable(proxy, instructionSet);

            if (proxy.context.customShader) {
                this._updateDistanceField(tmpText, proxy, materialName);
            }
        }
    }

    updateRenderable(tmpText: TMPText): void {
        const proxyMap = this._gpuMap.get(tmpText);
        if (!proxyMap) return;
        for (const [materialName, proxy] of proxyMap) {
            syncWithProxy(tmpText, proxy);
            this._renderer.renderPipes.graphics.updateRenderable(proxy);

            if (proxy.context.customShader) {
                this._updateDistanceField(tmpText, proxy, materialName);
            }
        }
    }

    destroyRenderable(tmpText: TMPText): void {
        const proxyMap = this._gpuMap.get(tmpText);
        if (proxyMap) {
            for (const proxy of proxyMap.values()) {
                proxy.destroy();
            }
            this._gpuMap.delete(tmpText);
        }
    }

    private _getProxies(tmpText: TMPText): Map<string, TMPTextGraphics> {
        let proxyMap = this._gpuMap.get(tmpText);
        if (!proxyMap) {
            proxyMap = new Map();
            this._gpuMap.set(tmpText, proxyMap);
        }
        return proxyMap;
    }

    private _getOrCreateProxy(
        proxyMap: Map<string, TMPTextGraphics>,
        materialName: string,
    ): TMPTextGraphics {
        let proxy = proxyMap.get(materialName);
        if (!proxy) {
            proxy = new TMPTextGraphics();
            proxyMap.set(materialName, proxy);
        }
        return proxy;
    }

    private _updateContexts(
        tmpText: TMPText,
        proxyMap: Map<string, TMPTextGraphics>,
    ): void {
        const font = tmpText.font;
        if (!font) return;

        const textInfo = tmpText.textInfo;
        if (!textInfo) return;

        // Group character indices by material name
        const materialGroups = new Map<string, number[]>();
        for (let i = 0; i < textInfo.characterCount; i++) {
            const mat = textInfo.characterInfo[i].material || '';
            let group = materialGroups.get(mat);
            if (!group) {
                group = [];
                materialGroups.set(mat, group);
            }
            group.push(i);
        }

        // Ensure default group exists even if empty (for decorations)
        if (!materialGroups.has('')) {
            materialGroups.set('', []);
        }

        // Remove proxies for materials no longer in use
        for (const [name, proxy] of proxyMap) {
            if (!materialGroups.has(name)) {
                proxy.destroy();
                proxyMap.delete(name);
            }
        }

        // Shared values
        const dfType = font.distanceField?.type ?? 'none';
        const maxTextures = (this._renderer as unknown as { limits: { maxBatchableTextures: number } }).limits.maxBatchableTextures;
        const padding = tmpText.style.padding;
        const anchorX = tmpText.anchor.x;
        const anchorY = tmpText.anchor.y;
        const totalWidth = textInfo.width;
        const totalHeight = textInfo.height;
        const applyTint = font.applyFillAsTint;
        const maxChars = computeMaxVisibleChars(tmpText, textInfo);
        const overrideColor = tmpText.style.overrideColorTags ? tmpText.style.fill : -1;

        // Build decorations once (shared, rendered in default group only)
        const decorations = TMPLayoutEngine.buildDecorations(textInfo, font, tmpText.style.fontSize);

        for (const [materialName, charIndices] of materialGroups) {
            const proxy = this._getOrCreateProxy(proxyMap, materialName);
            const { context } = proxy;
            context.clear();

            // Set up SDF shader
            if (dfType !== 'none' && !context.customShader) {
                context.customShader = new TMPShader(maxTextures);
            }

            // Apply anchor offset and padding
            context.translate(
                -anchorX * totalWidth - padding,
                -anchorY * totalHeight - padding,
            );

            // Decorations: render in the default material group only
            if (materialName === '') {
                for (const span of decorations) {
                    if (span.type === 'mark') {
                        context.rect(span.x, span.y, span.width, span.height);
                        context.fill({ color: span.color, alpha: ((span.color >> 24) & 0xff) / 255 || 0.25 });
                    }
                }
            }

            // Render characters in this material group
            for (const i of charIndices) {
                if (maxChars >= 0 && i >= maxChars) break;
                const charInfo = textInfo.characterInfo[i];
                if (!charInfo.isVisible || !charInfo.texture) continue;

                const tint = applyTint
                    ? (overrideColor >= 0 ? overrideColor : charInfo.color)
                    : 0xffffff;

                if (charInfo.rotation !== 0) {
                    const cx = charInfo.x + charInfo.width / 2;
                    const cy = charInfo.y + charInfo.height / 2;
                    const rad = charInfo.rotation * Math.PI / 180;
                    context.setTransform(
                        Math.cos(rad), Math.sin(rad),
                        -Math.sin(rad), Math.cos(rad),
                        cx - cx * Math.cos(rad) + cy * Math.sin(rad),
                        cy - cx * Math.sin(rad) - cy * Math.cos(rad),
                    );
                    context.texture(
                        charInfo.texture,
                        tint || 'black',
                        Math.round(charInfo.x),
                        Math.round(charInfo.y),
                        charInfo.width,
                        charInfo.height,
                    );
                    context.setTransform(1, 0, 0, 1, 0, 0);
                } else {
                    context.texture(
                        charInfo.texture,
                        tint || 'black',
                        Math.round(charInfo.x),
                        Math.round(charInfo.y),
                        charInfo.width,
                        charInfo.height,
                    );
                }
            }

            // Underline/strikethrough decorations on top (default group only)
            if (materialName === '') {
                for (const span of decorations) {
                    if (span.type === 'underline' || span.type === 'strikethrough') {
                        context.rect(span.x, span.y, span.width, span.height);
                        context.fill({ color: span.color });
                    }
                }
            }
        }
    }

    private _updateDistanceField(
        tmpText: TMPText,
        proxy: TMPTextGraphics,
        materialName: string,
    ): void {
        const { context } = proxy;
        const font = tmpText.font;
        const shader = context.customShader;
        if (!font || !shader) return;

        const { a, b, c, d } = tmpText.groupTransform;
        const dx = Math.sqrt(a * a + b * b);
        const dy = Math.sqrt(c * c + d * d);
        const worldScale = (Math.abs(dx) + Math.abs(dy)) / 2;
        const fontScale = font.renderedFontSize / tmpText.style.fontSize;
        const dfRange = font.distanceField?.range ?? 0;
        const distance = worldScale * dfRange * (1 / fontScale);

        const u = shader.resources.localUniforms.uniforms;
        u.uDistance = distance;

        const fontDataScale = (font as unknown as { fontScale?: number }).fontScale ?? 1;
        const scaleRatio = (tmpText.style.fontSize / font.renderedFontSize) * fontDataScale;
        u.uScaleRatioA = scaleRatio;
        u.uScaleRatioB = scaleRatio;
        u.uScaleRatioC = scaleRatio;

        const pageTexture = font.pages?.[0]?.texture;
        if (pageTexture) {
            (u.uTexSize as Float32Array)[0] = pageTexture.source.width;
            (u.uTexSize as Float32Array)[1] = pageTexture.source.height;
        }

        u.uGradientScale = dfRange;

        // Apply material-specific or style-level SDF uniforms
        if (shader instanceof TMPShader) {
            if (materialName) {
                const material = TMPMaterial.get(materialName);
                if (material) {
                    shader.updateFromMaterial(material);
                } else {
                    shader.updateFromStyle(tmpText.style);
                }
            } else {
                shader.updateFromStyle(tmpText.style);
            }
        }
    }

    destroy(): void {
        this._renderer = null!;
    }
}

/**
 * Compute effective maxVisibleCharacters from maxVisibleCharacters, maxVisibleWords, and maxVisibleLines.
 * Returns the most restrictive (smallest) limit, or -1 if no limit.
 */
function computeMaxVisibleChars(tmpText: TMPText, textInfo: import('./types').TextInfo): number {
    let limit = tmpText.maxVisibleCharacters;

    // maxVisibleWords: find the char index after the last allowed word
    const maxWords = tmpText.maxVisibleWords;
    if (maxWords >= 0 && textInfo.wordInfo.length > 0) {
        if (maxWords === 0) {
            limit = limit >= 0 ? Math.min(limit, 0) : 0;
        } else if (maxWords <= textInfo.wordInfo.length) {
            const wordLimit = textInfo.wordInfo[maxWords - 1].lastCharIndex + 1;
            limit = limit >= 0 ? Math.min(limit, wordLimit) : wordLimit;
        }
    }

    // maxVisibleLines: find the char index after the last allowed line
    const maxLines = tmpText.maxVisibleLines;
    if (maxLines >= 0 && textInfo.lineInfo.length > 0) {
        if (maxLines === 0) {
            limit = limit >= 0 ? Math.min(limit, 0) : 0;
        } else if (maxLines <= textInfo.lineInfo.length) {
            const lineLimit = textInfo.lineInfo[maxLines - 1].lastCharIndex + 1;
            limit = limit >= 0 ? Math.min(limit, lineLimit) : lineLimit;
        }
    }

    return limit;
}

function syncWithProxy(container: TMPText, proxy: TMPTextGraphics): void {
    proxy.groupTransform = container.groupTransform;
    proxy.groupColorAlpha = container.groupColorAlpha;
    proxy.groupColor = container.groupColor;
    proxy.groupBlendMode = container.groupBlendMode;
    proxy.globalDisplayStatus = container.globalDisplayStatus;
    proxy.localDisplayStatus = container.localDisplayStatus;
    proxy.groupAlpha = container.groupAlpha;
    proxy._roundPixels = container._roundPixels;
}
