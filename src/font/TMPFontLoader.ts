import {
    ExtensionType,
    LoaderParserPriority,
    DOMAdapter,
    path,
    copySearchParams,
} from 'pixi.js';
import type { Loader, ResolvedAsset, Texture } from 'pixi.js';
import { TMPFont } from './TMPFont';
import type { TMPFontData } from './TMPFontData';

/**
 * PixiJS LoadParser extension for `.tmpfont.json` files.
 *
 * Register it once (auto-registered via extensions if you import it):
 * ```ts
 * import { extensions } from 'pixi.js';
 * import { loadTMPFont } from 'pixi-text-mesh-pro';
 * extensions.add(loadTMPFont);
 * ```
 *
 * Then load fonts via the asset system:
 * ```ts
 * const font = await Assets.load<TMPFont>('fonts/roboto.tmpfont.json');
 * ```
 */
export const loadTMPFont = {
    extension: {
        type: ExtensionType.LoadParser as const,
        priority: LoaderParserPriority.Normal,
    },

    id: 'tmp-font',
    name: 'loadTMPFont',

    test(url: string): boolean {
        // checkExtension only matches the final extension (.json),
        // so we check the URL path directly for compound extensions.
        const clean = url.split('?')[0].split('#')[0].toLowerCase();
        return clean.endsWith('.tmpfont.json') || clean.endsWith('.tmpfont');
    },

    async load(url: string): Promise<TMPFontData> {
        const response = await DOMAdapter.get().fetch(url);
        const json: TMPFontData = await response.json();
        return json;
    },

    async testParse(data: unknown): Promise<boolean> {
        return typeof data === 'object'
            && data !== null
            && 'info' in data
            && 'distanceField' in data
            && 'glyphs' in data
            && 'pages' in data;
    },

    async parse(
        data: TMPFontData,
        resolvedAsset: ResolvedAsset,
        loader: Loader,
    ): Promise<TMPFont> {
        const src = resolvedAsset.src!;
        const dir = path.dirname(src);

        // Build texture URLs for each atlas page
        const textureUrls: { src: string }[] = [];
        for (const page of data.pages) {
            let imagePath = path.join(dir, page.file);
            imagePath = copySearchParams(imagePath, src);
            textureUrls.push({ src: imagePath });
        }

        // Load all page textures in parallel
        const loadedTextures = await loader.load<Texture>(textureUrls);

        // Collect textures in page order
        const pageTextures: Texture[] = textureUrls.map(
            (entry) => loadedTextures[entry.src],
        );

        return TMPFont.fromData(data, pageTextures);
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
