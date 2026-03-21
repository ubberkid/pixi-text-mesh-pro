import {
    ExtensionType,
    LoaderParserPriority,
    DOMAdapter,
    path,
    copySearchParams,
} from 'pixi.js';
import type { Loader, ResolvedAsset, Texture } from 'pixi.js';
import { TMPFont } from './TMPFont';
import type { UnityTMPData } from './UnityTMPData';

/**
 * PixiJS LoadParser extension for Unity TMP font files (`.unitytmp.json`).
 *
 * Register once:
 * ```ts
 * import { extensions } from 'pixi.js';
 * import { loadUnityTMPFont } from 'pixi-text-mesh-pro';
 * extensions.add(loadUnityTMPFont);
 * ```
 *
 * Then load fonts via the asset system:
 * ```ts
 * const font = await Assets.load<TMPFont>('fonts/dimbo.unitytmp.json');
 * ```
 */
export const loadUnityTMPFont = {
    extension: {
        type: ExtensionType.LoadParser as const,
        priority: LoaderParserPriority.Normal,
    },

    id: 'unity-tmp-font',
    name: 'loadUnityTMPFont',

    test(url: string): boolean {
        const clean = url.split('?')[0].split('#')[0].toLowerCase();
        return clean.endsWith('.unitytmp.json') || clean.endsWith('.unitytmp');
    },

    async load(url: string): Promise<UnityTMPData> {
        const response = await DOMAdapter.get().fetch(url);
        const json: UnityTMPData = await response.json();
        return json;
    },

    async testParse(data: unknown): Promise<boolean> {
        return typeof data === 'object'
            && data !== null
            && 'faceInfo' in data
            && 'atlas' in data
            && 'glyphTable' in data
            && 'characterTable' in data;
    },

    async parse(
        data: UnityTMPData,
        resolvedAsset: ResolvedAsset,
        loader: Loader,
    ): Promise<TMPFont> {
        const src = resolvedAsset.src!;
        const dir = path.dirname(src);

        // Build texture URLs for each atlas page
        const textureUrls: { src: string }[] = [];
        for (const pageFile of data.pages) {
            let imagePath = path.join(dir, pageFile);
            imagePath = copySearchParams(imagePath, src);
            textureUrls.push({ src: imagePath });
        }

        // Load all page textures in parallel
        const loadedTextures = await loader.load<Texture>(textureUrls);

        // Collect textures in page order
        const pageTextures: Texture[] = textureUrls.map(
            (entry) => loadedTextures[entry.src],
        );

        return TMPFont.fromUnityData(data, pageTextures);
    },

    async unload(
        font: TMPFont,
        _resolvedAsset: ResolvedAsset,
        loader: Loader,
    ): Promise<void> {
        await Promise.all(
            font.pages.map((page) =>
                loader.unload(page.texture.source._sourceOrigin),
            ),
        );
        font.destroy();
    },
};
