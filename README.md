# pixi-text-mesh-pro

[![npm version](https://img.shields.io/npm/v/pixi-text-mesh-pro.svg)](https://www.npmjs.com/package/pixi-text-mesh-pro)
[![license](https://img.shields.io/npm/l/pixi-text-mesh-pro.svg)](https://github.com/ubberkid/pixi-text-mesh-pro/blob/main/LICENSE)

Unity TextMeshPro-style rich text rendering for **PixiJS v8** — SDF/MSDF effects, inline sprites, per-character animation, and a full rich text tag parser.

## Features

- **SDF & MSDF rendering** — crisp text at any scale with outline, shadow, glow, and bevel effects
- **Rich text tags** — `<color>`, `<size>`, `<b>`, `<i>`, `<u>`, `<s>`, `<gradient>`, `<sprite>`, and many more
- **Material presets** — reusable SDF effect bundles via `TMPMaterial`
- **Inline sprites** — embed sprite atlas images in text with `<sprite>` tags
- **Style sheets** — named style presets with `<style="name">` tags
- **Per-character access** — full `textInfo` with character positions for typewriter effects, wave animations, etc.
- **Auto-sizing** — binary search for the largest font size that fits a container
- **Link events** — clickable `<link>` and `<a href>` regions with hit detection
- **Custom tags** — extensible `TagRegistry` for registering your own tags
- **PixiJS render pipe** — renders through PixiJS v8's `ViewContainer` pipeline with proper batching

## Installation

```bash
npm install pixi-text-mesh-pro
```

**Peer dependency:** `pixi.js` ^8.0.0

## Quick Start

```ts
import { Application, Assets, extensions } from 'pixi.js';
import { TMPText, loadTMPFont } from 'pixi-text-mesh-pro';

// Register the font loader extension
extensions.add(loadTMPFont);

const app = new Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

// Load an SDF font
const font = await Assets.load('fonts/roboto.tmpfont.json');

// Create rich text
const text = new TMPText({
    text: 'Hello <color=#ff0000>World</color>!',
    font,
    style: { fontSize: 48, fill: '#ffffff' },
});

app.stage.addChild(text);
```

## Rich Text Tags

| Tag | Example | Description |
|-----|---------|-------------|
| `<color>` | `<color=#ff0000>red</color>` | Text color (hex, named colors) |
| `<alpha>` | `<alpha=#80>faded</alpha>` | Text opacity |
| `<size>` | `<size=24>small</size>` | Font size (px, %, em, +/- relative) |
| `<b>` | `<b>bold</b>` | Bold (SDF dilate + extra spacing) |
| `<i>` | `<i>italic</i>` or `<i angle=15>` | Italic shear with optional angle |
| `<u>` | `<u>underline</u>` | Underline with optional `color` attribute |
| `<s>` | `<s>strike</s>` | Strikethrough with optional `color` attribute |
| `<mark>` | `<mark=#ffff0044>highlight</mark>` | Background highlight (RRGGBBAA) with optional padding |
| `<font>` | `<font="Other SDF">text</font>` | Switch font, with optional `material` attribute |
| `<font-weight>` | `<font-weight=700>bold</font-weight>` | Font weight hint |
| `<gradient>` | `<gradient=#ff0000,#0000ff>text</gradient>` | Horizontal color gradient |
| `<align>` | `<align=center>centered</align>` | Text alignment (left, center, right, justified) |
| `<cspace>` | `<cspace=5>spaced</cspace>` | Character spacing (px, em) |
| `<mspace>` | `<mspace=20>mono</mspace>` | Monospace width |
| `<duospace>` | `<duospace=20>mono</duospace>` | Alias for `<mspace>` |
| `<voffset>` | `<voffset=10>up</voffset>` | Vertical offset |
| `<indent>` | `<indent=40>indented</indent>` | Left indent |
| `<line-indent>` | `<line-indent=20>text</line-indent>` | Indent after explicit line breaks |
| `<line-height>` | `<line-height=1.5em>text</line-height>` | Line height override |
| `<margin>` | `<margin=20>text</margin>` | Horizontal margins (both sides) |
| `<margin-left>` | `<margin-left=10>text</margin-left>` | Left margin only |
| `<margin-right>` | `<margin-right=10>text</margin-right>` | Right margin only |
| `<padding>` | `<padding=10>text</padding>` | Alias for `<margin>` |
| `<space>` | `<space=20>` | Insert horizontal space (self-closing) |
| `<pos>` | `<pos=100>` | Absolute horizontal position (self-closing) |
| `<sup>` | `<sup>2</sup>` | Superscript |
| `<sub>` | `<sub>n</sub>` | Subscript |
| `<allcaps>` | `<allcaps>text</allcaps>` | Uppercase transform |
| `<uppercase>` | `<uppercase>text</uppercase>` | Alias for `<allcaps>` |
| `<lowercase>` | `<lowercase>TEXT</lowercase>` | Lowercase transform |
| `<smallcaps>` | `<smallcaps>Text</smallcaps>` | Small caps |
| `<scale>` | `<scale=2>big</scale>` | Per-character scale |
| `<rotate>` | `<rotate=45>tilted</rotate>` | Per-character rotation (degrees) |
| `<link>` | `<link="id">click</link>` | Clickable link region |
| `<a>` | `<a href="url">click</a>` | HTML-style link |
| `<sprite>` | `<sprite="atlas" name="coin">` | Inline sprite |
| `<style>` | `<style="warning">text</style>` | Apply named style preset |
| `<nobr>` | `<nobr>no break</nobr>` | Prevent word breaking |
| `<noparse>` | `<noparse><b>literal</b></noparse>` | Disable tag parsing |
| `<br>` | `line 1<br>line 2` | Line break (self-closing) |
| `<nbsp>` | `word<nbsp>word` | Non-breaking space |
| `<zwsp>` | `long<zwsp>word` | Zero-width space (break opportunity) |
| `<softhyphen>` | `long<softhyphen>word` | Soft hyphen |
| `<shy>` | `long<shy>word` | Alias for `<softhyphen>` |
| `<en-space>` | `a<en-space>b` | En space |
| `<em-space>` | `a<em-space>b` | Em space |
| `<cr>` | `text<cr>` | Carriage return |
| `<zwj>` | `a<zwj>b` | Zero-width joiner |

## SDF Effects

Configure outline, shadow, glow, and bevel via `TMPTextStyle`:

```ts
const text = new TMPText({
    text: 'SDF Effects',
    font,
    style: {
        fontSize: 64,
        fill: '#ffffff',
        // Outline
        outlineWidth: 0.2,
        outlineColor: '#000000',
        outlineSoftness: 0,
        // Shadow
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowColor: '#000000',
        shadowDilate: 0,
        shadowSoftness: 0.5,
        shadowAlpha: 0.5,
        // Glow
        glowColor: '#00ffff',
        glowOffset: 0,
        glowInner: 0.1,
        glowOuter: 0.3,
        glowPower: 1,
        // Bevel
        bevelWidth: 0.15,
        bevelOffset: 0.5,
        bevelColor: '#ffffff',
        // Face
        faceDilate: 0,
        sharpness: 0,
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
}));

TMPMaterial.register('Neon Glow', new TMPMaterial({
    glowColor: '#00ff88',
    glowOuter: 0.4,
    glowPower: 1.5,
}));

// Use in rich text
text.text = '<font="Dimbo SDF" material="Strong Stroke">Outlined</font>';

// Or bulk-register from JSON
TMPMaterial.fromJSON({
    'White Stroke': { outlineWidth: 0.2, outlineColor: '#ffffff' },
    'Drop Shadow': { shadowOffsetX: 2, shadowOffsetY: 2, shadowSoftness: 0.5 },
});
```

## Inline Sprites

Embed sprites in text using `InlineSpriteManager`:

```ts
import { InlineSpriteManager } from 'pixi-text-mesh-pro';

InlineSpriteManager.register('icons', {
    texture: atlasTexture,
    sprites: {
        coin: { texture: coinTex, width: 24, height: 24, xAdvance: 0, xOffset: 0, yOffset: 0 },
        heart: { texture: heartTex, width: 24, height: 24, xAdvance: 0, xOffset: 0, yOffset: 0 },
    },
});

text.text = 'Earn <sprite="icons" name="coin"> gold!';
```

Sprites can also be referenced by index (`<sprite="icons" index=0>`) or searched across all atlases (`<sprite name="coin">`). Use `tint` for colorization: `<sprite name="coin" tint=#ff0000>`.

## Style Sheets

Define reusable named styles:

```ts
import { TMPStyleSheet } from 'pixi-text-mesh-pro';

const styles = TMPStyleSheet.fromJSON({
    warning: { open: '<color=#ff4400><b>', close: '</b></color>' },
    highlight: { open: '<color=#ffcc00><mark=#ffcc0044>', close: '</mark></color>' },
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
        wordWrapWidth: 300,
        containerHeight: 200,
    },
});

text.enableAutoSize = true;
text.autoSizeMin = 8;
text.autoSizeMax = 64;
```

Or use the standalone utility:

```ts
import { autoSizeFontSize } from 'pixi-text-mesh-pro';

const bestSize = autoSizeFontSize(text, font, style, 300, 200, 8, 64);
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

// Word/line visibility
text.maxVisibleWords = 5;
text.maxVisibleLines = 2;
```

## Link Events

Enable clickable link regions:

```ts
text.text = 'Click <link="shop">here</link> or visit <a href="https://example.com">example</a>';

text.enableLinkEvents();
text.on('linkClick', (linkId, linkInfo, event) => {
    console.log('Clicked:', linkId);
});
text.on('linkHover', (linkId, linkInfo, event) => {
    // Handle hover state
});
```

## API Reference

### Core

| Export | Description |
|--------|-------------|
| `TMPText` | Main display object — extends PixiJS `ViewContainer` |
| `TMPTextStyle` | Style class with SDF effect properties, emits `update` events |
| `TMPMaterial` | Named SDF effect presets with static registry |
| `TMPTextPipe` | PixiJS render pipe for the GPU rendering pipeline |

### Font

| Export | Description |
|--------|-------------|
| `TMPFont` | Font class extending `AbstractBitmapFont` with fallback support |
| `loadTMPFont` | PixiJS `LoadParser` extension for `.tmpfont.json` files |

### Parser

| Export | Description |
|--------|-------------|
| `RichTextParser` | Stateful rich text parser with tag stack management |
| `TagRegistry` | FNV-1a hash-based O(1) tag lookup registry |
| `TagStack` | Generic stack with default-value restoration for nested tags |

### Styles & Sprites

| Export | Description |
|--------|-------------|
| `TMPStyleSheet` | Named style preset collections for `<style>` tags |
| `InlineSpriteManager` | Static sprite atlas registry for `<sprite>` tags |

### Layout & Shader

| Export | Description |
|--------|-------------|
| `TMPLayoutEngine` | Text layout engine producing `TextInfo` with character/line/word data |
| `TMPShader` | SDF/MSDF shader with dynamic feature compilation |

### Utilities

| Export | Description |
|--------|-------------|
| `autoSizeFontSize` | Binary search for largest font size that fits a container |
| `parseColor` | Parse hex/named colors to numeric values |
| `parseAlpha` | Parse `#XX` alpha values |
| `parseUnit` | Parse values with px/em/% units |
| `hashCode` | FNV-1a string hash |

## Font Preparation

pixi-text-mesh-pro uses SDF (Signed Distance Field) or MSDF (Multi-channel SDF) bitmap fonts. You need to generate a `.tmpfont.json` font file and atlas texture(s).

### Recommended Tools

- **[msdf-atlas-gen](https://github.com/Chlumsky/msdf-atlas-gen)** — Best quality MSDF generation. Export as JSON + PNG atlas, then convert to `.tmpfont.json` format.
- **[Hiero](https://libgdx.com/wiki/tools/hiero)** — GUI-based SDF font generator. Supports distance field output.
- **Unity TextMeshPro Font Asset Creator** — If you have Unity, export the font asset JSON directly.

### Font File Format

The `.tmpfont.json` file contains:

```json
{
  "info": {
    "face": "Roboto",
    "size": 42,
    "lineHeight": 48,
    "base": 36,
    "ascent": 36,
    "descent": -12
  },
  "distanceField": {
    "type": "msdf",
    "range": 4
  },
  "glyphs": [
    { "id": 65, "x": 0, "y": 0, "width": 28, "height": 32, "xOffset": -1, "yOffset": 4, "xAdvance": 26, "page": 0 }
  ],
  "pages": [
    { "file": "roboto-atlas.png" }
  ],
  "kernings": [
    { "first": 65, "second": 86, "amount": -2 }
  ]
}
```

## Differences from Unity TextMeshPro

### Exceeds Unity TMP

- **MSDF support** — Unity TMP only supports SDF; this library supports both SDF and MSDF for sharper rendering at small sizes
- **Per-character rotation** — `<rotate=45>` tag for rotating individual characters (no Unity equivalent)
- **HTML-style links** — `<a href="url">` in addition to Unity's `<link="id">`
- **Horizontal gradients** — `<gradient=#color1,#color2>` interpolates across characters
- **Per-effect alpha** — independent `outlineAlpha`, `shadowAlpha`, `glowAlpha`, `bevelAlpha` controls
- **Per-character scale** — `<scale=2>` tag for scaling individual characters
- **Custom italic angle** — `<i angle=15>` for arbitrary shear angles

### Known Limitations

- **Shadow** — approximated in the SDF shader (offset + softness + dilate) rather than Unity's separate underlay pass. Looks similar but not pixel-identical.
- **Bevel** — simplified normal-based bevel effect. Does not match Unity's bump map bevel exactly.
- **No inner shadow** — Unity TMP's face texture underlay is not implemented.
- **No vertex gradients** — Unity TMP supports 4-corner vertex color gradients; this library supports horizontal tag-based gradients only.
- **No font weight tables** — `<font-weight>` stores the value but doesn't swap font assets. Use `<b>` for bold (SDF dilate approach).
- **No texture overlays** — Unity TMP's face/outline texture mapping is not implemented.

### Behavioral Differences

- **Character spacing** — `<cspace>` values are in pixels (or em/% with units), not Unity's font-unit space. The `characterSpacing` style property uses em units.
- **Line height** — `lineSpacingAdjustment` is additive (added to computed line height), matching Unity's behavior. The `lineHeight` style property sets an absolute override.
- **Overflow** — supports `overflow`, `truncate`, and `ellipsis` modes. Unity's `page` and `scroll` modes are not implemented.
- **Margins** — style-level margins (`marginLeft`, `marginTop`, `marginRight`, `marginBottom`) plus tag-level `<margin>`. Unity uses a single `Vector4` margin.
- **Word wrapping ratios** — `wordWrappingRatios` (default 0.4) controls preferred vs non-preferred break points, matching Unity's algorithm.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and PR guidelines.

## License

[MIT](LICENSE)
