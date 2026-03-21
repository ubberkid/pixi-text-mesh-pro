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
    private _managedItems: Record<number, TMPText | null>;

    constructor(renderer: Renderer) {
        this._renderer = renderer;
        // Register a managed hash with the GC system so it periodically
        // calls updateRenderableGCTick → _onTouch on tracked TMPTexts,
        // which propagates to proxy Graphics keeping them alive.
        this._managedItems = Object.create(null);
        (renderer as unknown as { gc: {
            addResourceHash: (ctx: unknown, hash: string, type: string, priority: number) => void;
        } }).gc.addResourceHash(this, '_managedItems', 'renderable', -2);
    }

    validateRenderable(tmpText: TMPText): boolean {
        const proxyMap = this._getProxies(tmpText);
        const proxy = this._getOrCreateProxy(proxyMap, '');
        const needsRebuild = this._renderer.renderPipes.graphics.validateRenderable(proxy);

        if (needsRebuild) {
            // Force context rebuild so _updateContexts runs in addRenderable.
            // Without this, the graphics pipe's GPU data gets cleared but
            // never rebuilt because the cached instruction set doesn't
            // re-trigger addRenderable with _didTextUpdate = true.
            tmpText._didTextUpdate = true;
        }

        return needsRebuild;
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
        const proxyMap = this._getProxyMap(tmpText);
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
        const proxyMap = this._getProxyMap(tmpText);
        if (proxyMap) {
            for (const proxy of proxyMap.values()) {
                proxy.destroy();
            }
            tmpText._gpuData[this._renderer.uid] = null;
        }
    }

    /**
     * Get or create the proxy map, stored on tmText._gpuData[renderer.uid].
     * This follows the BitmapTextPipe pattern so PixiJS's GC system can
     * keep the proxy alive via TMPText._onTouch() propagation.
     */
    private _getProxies(tmpText: TMPText): Map<string, TMPTextGraphics> {
        const existing = this._getProxyMap(tmpText);
        if (existing) return existing;

        return this._initProxies(tmpText);
    }

    private _initProxies(tmpText: TMPText): Map<string, TMPTextGraphics> {
        const proxyMap = new Map<string, TMPTextGraphics>();
        const wrapper = {
            _map: proxyMap,
            _onTouch(now: number) {
                for (const proxy of proxyMap.values()) {
                    // Must touch both the proxy AND its context —
                    // Graphics._onTouch does both, and the GC system
                    // tracks them independently.
                    (proxy as unknown as { _gcLastUsed: number })._gcLastUsed = now;
                    (proxy.context as unknown as { _gcLastUsed: number })._gcLastUsed = now;
                }
            },
            destroy() {
                for (const proxy of proxyMap.values()) {
                    proxy.destroy();
                }
                proxyMap.clear();
            },
        };
        tmpText._gpuData[this._renderer.uid] = wrapper;
        // Register with GC so updateRenderableGCTick → _onTouch is
        // called periodically, propagating to proxy _gcLastUsed.
        if (!this._managedItems[tmpText.uid]) {
            this._managedItems[tmpText.uid] = tmpText;
            (tmpText as unknown as { _gcLastUsed: number })._gcLastUsed = performance.now();
        }
        // Force initial context build
        tmpText._didTextUpdate = true;
        return proxyMap;
    }

    /** Get existing proxy map from _gpuData (returns null if GC'd or not yet created). */
    private _getProxyMap(tmpText: TMPText): Map<string, TMPTextGraphics> | null {
        const wrapper = tmpText._gpuData?.[this._renderer?.uid] as
            | { _map: Map<string, TMPTextGraphics> }
            | null
            | undefined;
        return wrapper?._map ?? null;
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

            // Shadow pass: render offset shadow glyphs behind main text.
            // Done as geometry rather than in the fragment shader because the
            // batch pipeline can't re-sample the SDF texture at offset UVs.
            const style = tmpText.style;
            const hasShadow = materialName === '' && (
                style.shadowDilate > 0 || style.shadowOffsetX !== 0 || style.shadowOffsetY !== 0
            );

            if (hasShadow) {
                const shadowColor = style.shadowColor;
                const shadowTint = ((shadowColor >> 16) & 0xff) << 16
                    | ((shadowColor >> 8) & 0xff) << 8
                    | (shadowColor & 0xff);
                const fontSize = style.fontSize;
                const sx = style.shadowOffsetX * fontSize * 0.05;
                const sy = style.shadowOffsetY * fontSize * 0.05;

                for (const i of charIndices) {
                    if (maxChars >= 0 && i >= maxChars) break;
                    const charInfo = textInfo.characterInfo[i];
                    if (!charInfo.isVisible || !charInfo.texture) continue;

                    context.texture(
                        charInfo.texture,
                        shadowTint || 'black',
                        Math.round(charInfo.x + sx),
                        Math.round(charInfo.y + sy),
                        charInfo.width,
                        charInfo.height,
                    );
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
        // Multiply by renderer resolution to account for DPR —
        // groupTransform doesn't include it, but the GPU renders at that density.
        const resolution = this._renderer.resolution;
        const distance = worldScale * dfRange * (1 / fontScale) * resolution;

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
        this._managedItems = Object.create(null);
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
