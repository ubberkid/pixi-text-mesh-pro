import { Application, Assets, BitmapFont, Cache } from 'pixi.js';
import { TMPText, TMPTextPipe, TMPFont } from '../src';

// Register our render pipe extension
Application.defaultOptions.preferWebGLVersion = 2;

async function main() {
    const app = new Application();
    await app.init({
        resizeTo: window,
        backgroundColor: '#1a1a2e',
        antialias: true,
    });
    document.body.appendChild(app.canvas);

    // Register the TMP render pipe
    app.renderer.renderPipes.tmpText = new TMPTextPipe(app.renderer);

    // Load an MSDF font — for this example, we'll create a simple bitmap font
    // In production, you'd load a real MSDF .fnt file via Assets.load()
    //
    // Example with a real font:
    //   await Assets.load('fonts/roboto-msdf.fnt');
    //   const bitmapFont = Cache.get('Roboto-bitmap');
    //   const font = TMPFont.fromBitmapFont(bitmapFont);

    // For demo purposes, install a dynamic bitmap font
    const style = {
        fontFamily: 'Arial',
        fontSize: 48,
        fill: '#ffffff',
    };
    BitmapFont.install({
        name: 'DemoFont',
        style,
        chars: BitmapFont.ASCII,
    });

    const bitmapFont = Cache.get('DemoFont-bitmap');
    const font = TMPFont.fromBitmapFont(bitmapFont);

    // --- Example 1: Basic rich text ---
    const text1 = new TMPText({
        text: 'Hello <color=#ff6b6b>World</color>! This is <b>bold</b> and <i>italic</i>.',
        font,
        style: {
            fontSize: 36,
            fill: '#ffffff',
            wordWrap: true,
            wordWrapWidth: 600,
        },
    });
    text1.position.set(40, 40);
    app.stage.addChild(text1);

    // --- Example 2: Multiple colors and sizes ---
    const text2 = new TMPText({
        text: '<color=#4ecdc4>Small</color> <size=48>Medium</size> <size=64><color=#ffe66d>BIG</color></size>',
        font,
        style: {
            fontSize: 24,
            fill: '#ffffff',
        },
    });
    text2.position.set(40, 140);
    app.stage.addChild(text2);

    // --- Example 3: Nested tags ---
    const text3 = new TMPText({
        text: '<color=#a8e6cf>Green <b>Bold Green <color=#ff8b94>Red Bold</color> back to Green</b></color>',
        font,
        style: {
            fontSize: 28,
            fill: '#ffffff',
            wordWrap: true,
            wordWrapWidth: 500,
        },
    });
    text3.position.set(40, 230);
    app.stage.addChild(text3);

    // --- Example 4: Alpha tag ---
    const text4 = new TMPText({
        text: 'Full <alpha=#88>Half<alpha=#33> Quarter</alpha></alpha> Full again',
        font,
        style: {
            fontSize: 32,
            fill: '#ffd93d',
        },
    });
    text4.position.set(40, 320);
    app.stage.addChild(text4);

    // --- Example 5: Word wrap ---
    const text5 = new TMPText({
        text: 'This is a <color=#6c5ce7>longer paragraph</color> that demonstrates <b>word wrapping</b>. '
            + 'The text will automatically break at the <color=#fd79a8>word wrap width</color> boundary. '
            + 'Rich text tags are <i>fully supported</i> across line breaks!',
        font,
        style: {
            fontSize: 24,
            fill: '#dfe6e9',
            wordWrap: true,
            wordWrapWidth: 500,
            align: 'left',
        },
    });
    text5.position.set(40, 400);
    app.stage.addChild(text5);

    // --- Example 6: Center alignment ---
    const text6 = new TMPText({
        text: '<color=#74b9ff>Centered Text</color>\n<size=20>with multiple lines</size>\n<color=#a29bfe>and colors!</color>',
        font,
        style: {
            fontSize: 32,
            fill: '#ffffff',
            align: 'center',
            wordWrap: true,
            wordWrapWidth: 400,
        },
    });
    text6.position.set(40, 580);
    app.stage.addChild(text6);

    console.log('pixi-text-mesh-pro basic example loaded!');
    console.log('TextInfo for text1:', text1.textInfo);
}

main().catch(console.error);
