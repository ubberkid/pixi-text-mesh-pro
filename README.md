# pixi-text-mesh-pro

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ubberkid/pixi-text-mesh-pro/blob/main/LICENSE)

Unity TextMeshPro-style rich text rendering for **PixiJS v8** — SDF/MSDF effects, inline sprites, per-character animation, and a full rich text tag parser.

## Features

- **SDF & MSDF rendering** — crisp text at any scale with outline, shadow, glow, and bevel effects
- **Rich text tags** — `<color>`, `<size>`, `<sprite>`, `<b>`, `<i>`, and many more
- **Unity TMP font support** — load fonts directly from Unity TextMeshPro SDF font assets
- **Inline sprites** — embed sprite atlas images in text with `<sprite>` tags
- **Material presets** — reusable SDF effect bundles via `TMPMaterial`
- **Style sheets** — named style presets with `<style="name">` tags
- **Per-character access** — full `textInfo` with character positions for typewriter effects, wave animations, etc.
- **Auto-sizing** — binary search for the largest font size that fits a container
- **Link events** — clickable `<link>` and `<a href>` regions with hit detection
- **Custom tags** — extensible `TagRegistry` for registering your own tags

## Installation

```bash
npm install github:ubberkid/pixi-text-mesh-pro
```

**Requires:** `pixi.js` ^8.0.0

## Getting Started

### 1. Register Extensions

The render pipe must be registered **before** `app.init()`. Font loaders must be registered before loading fonts:

```ts
import { Application, Assets, extensions } from 'pixi.js';
import { TMPTextPipe, loadTMPFont, loadTMPFontAsset } from 'pixi-text-mesh-pro';

// Register render pipe BEFORE app.init (so the renderer includes it)
extensions.add(TMPTextPipe);

const app = new Application();
await app.init({ width: 800, height: 600 });

// Register font loaders BEFORE loading fonts
extensions.add(loadTMPFont);        // for .tmpfont.json files
extensions.add(loadTMPFontAsset);   // for .unitytmp.json files (TMP font assets)
```

### 2. Set Up Defaults (TMPSettings)

`TMPSettings` mirrors Unity's TMP Settings asset — set global defaults once during initialization:

```ts
import { TMPSettings, TMPMaterial, TMPStyleSheet } from 'pixi-text-mesh-pro';
import type { TMPFont } from 'pixi-text-mesh-pro';

// Load font
const font = await Assets.load<TMPFont>('fonts/dimbo-sdf.unitytmp.json');

// Register material presets
TMPMaterial.register('Brown Stroke', new TMPMaterial({
    faceDilate: 0.3,
    outlineWidth: 0.3,
    outlineColor: '#451400',
    shadowOffsetY: -0.4,
    shadowDilate: 0.28,
    shadowAlpha: 0.25,
}));

// Set global defaults
TMPSettings.defaultFont = font;
TMPSettings.defaultStyleSheet = TMPStyleSheet.fromJSON({
    yellow: { open: '<color=#ffff00>', close: '</color>' },
    red:    { open: '<color=#ff0000>', close: '</color>' },
});
TMPSettings.defaultSpriteAsset = 'Small_Icons';

// Set default material on the font (applied as base style)
font.defaultMaterial = 'Brown Stroke';
```

### 3. Create Text

With defaults set, creating text is simple — no need to specify font or material:

```ts
import { TMPText } from 'pixi-text-mesh-pro';

const text = new TMPText({
    text: 'Hello <style="yellow">World</style>!',
    style: { fontSize: 48, fill: '#ffffff' },
});

app.stage.addChild(text);
// Automatically uses default font, material (outline + shadow), and style sheet
```

You can still override any default per-instance:

```ts
const text = new TMPText({
    text: 'Custom',
    font: otherFont,  // override default font
    style: {
        fontSize: 64,
        fill: '#ffffff',
        outlineWidth: 0.5,  // overrides material default
    },
});
```

## Unity TMP Font Assets

If you have existing Unity TextMeshPro SDF fonts, you can use them directly.

### Extraction

Use the included Python script to extract the font from Unity's `.asset` file:

```bash
python3 scripts/convert-unity-font.py
```

This produces:
- `font-name.unitytmp.json` — font data (face info, glyph table, character table, atlas config)
- `font-name-atlas.png` — the SDF atlas texture (Y-flipped for web)

The JSON preserves Unity's native data format. All coordinate transforms (Y-flip, glyph rect expansion by atlas padding, offset calculations) are handled by the library's `TMPFont.fromUnityData()` at load time.

### Loading

```ts
import { loadUnityTMPFont } from 'pixi-text-mesh-pro';

extensions.add(loadUnityTMPFont);
const font = await Assets.load('fonts/dimbo-sdf.unitytmp.json');
```

The loader automatically loads referenced atlas textures from the same directory.

## Rich Text Tags

### Fully Working

| Tag | Example | Description |
|-----|---------|-------------|
| `<color>` | `<color=#ff0000>red</color>` | Text color (hex, named colors) |
| `<size>` | `<size=24>small</size>` | Font size (px, %, em, +/- relative) |
| `<br>` | `line 1<br>line 2` | Line break |
| `<sprite>` | `<sprite name="coin">` | Inline sprite from registered atlas |
| `<cspace>` | `<cspace=5>spaced</cspace>` | Character spacing |
| `<nobr>` | `<nobr>no break</nobr>` | Prevent word breaking |
| `<voffset>` | `<voffset=10>up</voffset>` | Vertical offset |
| `<space>` | `<space=20>` | Insert horizontal space |
| `<noparse>` | `<noparse><b>literal</noparse>` | Disable tag parsing |
| `<style>` | `<style="warning">text</style>` | Apply named style preset |
| `<font>` | `<font="Other SDF">text</font>` | Switch font with optional `material` |
| `<material>` | `<material="Stroke">text</material>` | Apply material preset |
| `<align>` | `<align=center>text</align>` | Text alignment |
| `<mspace>` | `<mspace=20>mono</mspace>` | Monospace width |
| `<indent>` | `<indent=40>text</indent>` | Left indent |
| `<line-height>` | `<line-height=1.5em>text</line-height>` | Line height override |
| `<margin>` | `<margin=20>text</margin>` | Horizontal margins |
| `<pos>` | `<pos=100>` | Absolute horizontal position |
| `<sup>` | `<sup>2</sup>` | Superscript |
| `<sub>` | `<sub>n</sub>` | Subscript |
| `<allcaps>` | `<allcaps>text</allcaps>` | Uppercase transform |
| `<lowercase>` | `<lowercase>TEXT</lowercase>` | Lowercase transform |
| `<smallcaps>` | `<smallcaps>Text</smallcaps>` | Small caps |
| `<link>` | `<link="id">click</link>` | Clickable link region |
| `<nbsp>` | `word<nbsp>word` | Non-breaking space |
| `<zwsp>` | `long<zwsp>word` | Zero-width space |

### Parsed But Not Yet Rendering

These tags are parsed correctly and stored on character data, but the render pipe does not yet apply visual changes:

| Tag | Status |
|-----|--------|
| `<b>` | Parsed — needs per-character SDF dilate in render pipe |
| `<i>` | Parsed — needs per-character shear transform in render pipe |
| `<u>` | Parsed — `buildDecorations` not generating underline spans |
| `<s>` | Parsed — `buildDecorations` not generating strikethrough spans |
| `<alpha>` | Parsed — `context.texture()` has no per-character alpha support |
| `<rotate>` | Parsed — rotation transform applied but shadow missing, position offset issues |
| `<gradient>` | Parsed — per-character gradient colors not applied in render pipe |
| `<mark>` | Parsed — mark highlight rects generated but may not render visually |
| `<scale>` | Parsed — per-character scale stored but not applied to glyph rendering |

## SDF Effects

Configure outline, shadow, glow, and bevel via `TMPTextStyle`:

```ts
const text = new TMPText({
    text: 'SDF Effects',
    font,
    style: {
        fontSize: 64,
        fill: '#ffffff',
        // Face
        faceDilate: 0.2,    // thicken the text (like bold)
        sharpness: 0.5,     // edge crispness (0 = normal AA, higher = sharper)
        // Outline
        outlineWidth: 0.3,
        outlineColor: '#000000',
        outlineSoftness: 0,
        // Shadow (rendered as offset geometry)
        shadowOffsetX: 0,
        shadowOffsetY: 2,
        shadowColor: '#000000',
        shadowAlpha: 1,
        shadowDilate: 0.1,
        // Glow
        glowColor: '#00ffff',
        glowOuter: 0.3,
        glowInner: 0.1,
        glowPower: 1,
        // Bevel
        bevelWidth: 0.15,
        bevelOffset: 0.5,
        bevelColor: '#ffffff',
    },
});
```

## Material Presets

Register reusable SDF effect bundles:

```ts
import { TMPMaterial } from 'pixi-text-mesh-pro';

TMPMaterial.register('Strong Stroke', new TMPMaterial({
    outlineWidth: 0.3,
    outlineColor: '#5A3000',
    faceDilate: 0.2,
}));

// Use in rich text
text.text = '<font="Dimbo SDF" material="Strong Stroke">Outlined</font>';

// Bulk-register from JSON
TMPMaterial.fromJSON({
    'White Stroke': { outlineWidth: 0.2, outlineColor: '#ffffff' },
    'Drop Shadow': { shadowOffsetX: 0, shadowOffsetY: 2, shadowDilate: 0.1 },
});
```

## Inline Sprites

### From Unity TMP Sprite Assets

Extract sprite data from Unity's `.asset` file:

```bash
python3 scripts/extract-unity-sprites.py
```

This produces a `.tmpsprites.json` with the full Unity structure — face info, atlas reference, sprite character table, and sprite glyph table (with metrics like bearingX, bearingY, advance).

### Registering Sprites

```ts
import { InlineSpriteManager } from 'pixi-text-mesh-pro';

// Load the sprite atlas and data
const atlasTex = await Assets.load('ui/small-icons.png');
const spriteData = await Assets.load('ui/small-icons.tmpsprites.json');

// Build glyph lookup
const glyphMap = new Map();
for (const g of spriteData.spriteGlyphTable) glyphMap.set(g.index, g);

// Register sprites using Unity's metrics
const fontAscent = myFont.baseLineOffset;
const sprites = {};

for (const ch of spriteData.spriteCharacterTable) {
    const g = glyphMap.get(ch.glyphIndex);
    const m = g.metrics;
    const r = g.glyphRect;

    // Unity scales sprites by ascentLine / spriteHeight when sprite has no face info
    const spriteScale = fontAscent / m.height * ch.scale;

    sprites[ch.name] = {
        texture: new Texture({ source: atlasTex.source, frame: new Rectangle(r.x, r.y, r.width, r.height) }),
        width: m.width * spriteScale,
        height: m.height * spriteScale,
        xAdvance: m.horizontalAdvance * spriteScale,
        xOffset: m.horizontalBearingX * spriteScale,
        yOffset: fontAscent - (m.horizontalBearingY * spriteScale),
    };
}

InlineSpriteManager.register('Small_Icons', { texture: atlasTex, sprites });
```

### Using in Text

```ts
text.text = 'Earn <sprite name="Gem_Green"> gems! Get <sprite name="Cash"> cash!';
```

Sprites render as regular textures (no SDF shader) and align to the text baseline using `horizontalBearingY`. Sprites respond to `<size>` tags and maintain baseline alignment across mixed sizes.

## Style Sheets

Define reusable named styles:

```ts
import { TMPStyleSheet } from 'pixi-text-mesh-pro';

const styles = TMPStyleSheet.fromJSON({
    warning: { open: '<color=#ff4400><b>', close: '</b></color>' },
    highlight: { open: '<color=#ffcc00>', close: '</color>' },
});

text.styleSheet = styles;
text.text = '<style="warning">DANGER!</style> Normal text.';
```

## Auto-Sizing

Automatically fit text to a container:

```ts
const text = new TMPText({
    text: 'This text will shrink to fit',
    font,
    style: {
        fontSize: 64,
        wordWrap: true,
        containerWidth: 300,
        containerHeight: 200,
    },
});

text.enableAutoSize = true;
text.autoSizeMin = 8;
text.autoSizeMax = 64;
```

## Per-Character Animation

Access character positions for typewriter, wave, and other effects:

```ts
// Typewriter reveal
text.maxVisibleCharacters = 0;
let count = 0;
app.ticker.add(() => {
    text.maxVisibleCharacters = Math.floor(count);
    count += 0.5;
});

// Wave animation
const info = text.textInfo;
app.ticker.add(({ elapsedMS }) => {
    for (let i = 0; i < info.characterCount; i++) {
        info.characterInfo[i].y += Math.sin(elapsedMS * 0.003 + i * 0.3) * 2;
    }
    text.updateVertices();
});
```

## Link Events

Enable clickable link regions:

```ts
text.text = 'Click <link="shop">here</link>';

text.enableLinkEvents();
text.on('linkClick', (linkId, linkInfo, event) => {
    console.log('Clicked:', linkId);
});
```

## Known Limitations

- **Shadow** — rendered as offset geometry rather than UV-offset re-sampling in the SDF shader. This is because single-channel SDF (R=G=B) provides no gradient information for the shader's shadow approximation. Visually similar but not pixel-identical to Unity.
- **Bold/Italic** — tags are parsed but the render pipe doesn't yet apply per-character SDF dilate (bold) or shear transform (italic).
- **Underline/Strikethrough** — tags are parsed but `buildDecorations` is not yet generating decoration spans.
- **Per-character alpha** — `<alpha>` tag is parsed but `context.texture()` in PixiJS's batch pipeline doesn't support per-character alpha.
- **Bevel** — simplified normal approximation. Does not match Unity's bump map bevel.
- **No vertex gradients** — Unity TMP supports 4-corner vertex color gradients; this library supports horizontal tag-based gradients only.
- **No texture overlays** — Unity TMP's face/outline texture mapping is not implemented.

## API Reference

### Core

| Export | Description |
|--------|-------------|
| `TMPText` | Main display object — extends PixiJS `ViewContainer` |
| `TMPTextStyle` | Style class with SDF effect properties |
| `TMPMaterial` | Named SDF effect presets with static registry |
| `TMPSettings` | Global defaults (font, style sheet, sprite asset, etc.) |
| `TMPTextPipe` | PixiJS render pipe (must be registered before `app.init()`) |

### Font

| Export | Description |
|--------|-------------|
| `TMPFont` | Font class with `fromData()`, `fromAssetData()`, `fromBitmapFont()` |
| `loadTMPFont` | PixiJS loader for `.tmpfont.json` files |
| `loadTMPFontAsset` | PixiJS loader for `.unitytmp.json` files (TMP font assets) |

### Parser & Layout

| Export | Description |
|--------|-------------|
| `RichTextParser` | Rich text parser with tag stack management |
| `TMPLayoutEngine` | Layout engine producing `TextInfo` |
| `TMPShader` | SDF/MSDF shader with dynamic compilation |
| `TagRegistry` | FNV-1a hash-based tag lookup |

### Styles & Sprites

| Export | Description |
|--------|-------------|
| `TMPStyleSheet` | Named style preset collections |
| `InlineSpriteManager` | Sprite atlas registry for `<sprite>` tags |

### Utilities

| Export | Description |
|--------|-------------|
| `autoSizeFontSize` | Find largest font size that fits a container |
| `parseColor` / `parseAlpha` | Color and alpha parsing |
| `parseUnit` | Parse px/em/% values |
| `hashCode` | FNV-1a string hash |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and PR guidelines.

## License

[MIT](LICENSE)
