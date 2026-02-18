import {
    Matrix,
    Shader,
    UniformGroup,
    compileHighShaderGpuProgram,
    compileHighShaderGlProgram,
    colorBit,
    colorBitGl,
    generateTextureBatchBit,
    generateTextureBatchBitGl,
    roundPixelsBit,
    roundPixelsBitGl,
    getBatchSamplersUniformGroup,
} from 'pixi.js';
import type { TMPTextStyle } from '../core/TMPTextStyle';
import type { TMPMaterial } from '../core/TMPMaterial';
import {
    tmpSDFBit, tmpSDFBitGl,
    localUniformTMPBit, localUniformTMPBitGl,
} from './TMPShaderBits';

// Cached programs
let gpuProgram: ReturnType<typeof compileHighShaderGpuProgram>;
let glProgram: ReturnType<typeof compileHighShaderGlProgram>;

/**
 * Custom TMP SDF shader with outline, shadow, glow, and face dilate.
 *
 * Extends PixiJS's SdfShader with additional uniforms for TMP-style effects.
 * Matches Unity TMP's compositing pipeline: GetColor, GetGlowColor, underlay re-sampling.
 */
export class TMPShader extends Shader {
    constructor(maxTextures: number) {
        // Build programs (cached, same pattern as SdfShader)
        gpuProgram ??= compileHighShaderGpuProgram({
            name: 'tmp-sdf-shader',
            bits: [
                colorBit,
                generateTextureBatchBit(maxTextures),
                localUniformTMPBit,
                tmpSDFBit,
                roundPixelsBit,
            ],
        });

        glProgram ??= compileHighShaderGlProgram({
            name: 'tmp-sdf-shader',
            bits: [
                colorBitGl,
                generateTextureBatchBitGl(maxTextures),
                localUniformTMPBitGl,
                tmpSDFBitGl,
                roundPixelsBitGl,
            ],
        });

        const uniforms = new UniformGroup({
            uColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
            uTransformMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
            uDistance: { value: 4, type: 'f32' },
            uRound: { value: 0, type: 'f32' },
            // SDF effect uniforms
            uOutlineWidth: { value: 0, type: 'f32' },
            uOutlineColor: { value: new Float32Array([0, 0, 0, 1]), type: 'vec4<f32>' },
            uOutlineSoftness: { value: 0, type: 'f32' },
            uShadowOffset: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
            uShadowColor: { value: new Float32Array([0, 0, 0, 0.5]), type: 'vec4<f32>' },
            uShadowDilate: { value: 0, type: 'f32' },
            uShadowSoftness: { value: 0.5, type: 'f32' },
            uGlowColor: { value: new Float32Array([0, 0, 0, 1]), type: 'vec4<f32>' },
            uGlowOffset: { value: 0, type: 'f32' },
            uGlowOuter: { value: 0, type: 'f32' },
            uGlowInner: { value: 0, type: 'f32' },
            uGlowPower: { value: 1, type: 'f32' },
            uFaceDilate: { value: 0, type: 'f32' },
            uBevelWidth: { value: 0, type: 'f32' },
            uBevelOffset: { value: 0.5, type: 'f32' },
            uBevelColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
            // Scale ratio uniforms (match Unity _ScaleRatioA/B/C)
            uScaleRatioA: { value: 1, type: 'f32' },
            uScaleRatioB: { value: 1, type: 'f32' },
            uScaleRatioC: { value: 1, type: 'f32' },
            // Texture dimensions for UV-offset shadow sampling
            uTexSize: { value: new Float32Array([512, 512]), type: 'vec2<f32>' },
            // Sharpness control for resolution-adaptive AA
            uSharpness: { value: 0, type: 'f32' },
            // Gradient scale (distance field spread in atlas pixels)
            uGradientScale: { value: 1, type: 'f32' },
        });

        super({
            glProgram,
            gpuProgram,
            resources: {
                localUniforms: uniforms,
                batchSamplers: getBatchSamplersUniformGroup(maxTextures),
            },
        });
    }

    /**
     * Update all SDF effect uniforms from a TMPTextStyle.
     * Scale ratios and texture size are set externally by TMPTextPipe.
     */
    updateFromStyle(style: TMPTextStyle): void {
        const u = this.resources.localUniforms.uniforms;

        u.uOutlineWidth = style.outlineWidth;
        setColorUniform(u.uOutlineColor as Float32Array, style.outlineColor, style.outlineAlpha);
        u.uOutlineSoftness = style.outlineSoftness;

        (u.uShadowOffset as Float32Array)[0] = style.shadowOffsetX;
        (u.uShadowOffset as Float32Array)[1] = style.shadowOffsetY;
        setColorUniform(u.uShadowColor as Float32Array, style.shadowColor, style.shadowAlpha);
        u.uShadowDilate = style.shadowDilate;
        u.uShadowSoftness = style.shadowSoftness;

        setColorUniform(u.uGlowColor as Float32Array, style.glowColor, style.glowAlpha);
        u.uGlowOffset = style.glowOffset;
        u.uGlowOuter = style.glowOuter;
        u.uGlowInner = style.glowInner;
        u.uGlowPower = style.glowPower;

        u.uFaceDilate = style.faceDilate;

        u.uBevelWidth = style.bevelWidth;
        u.uBevelOffset = style.bevelOffset;
        setColorUniform(u.uBevelColor as Float32Array, style.bevelColor, style.bevelAlpha);
    }

    /**
     * Update all SDF effect uniforms from a TMPMaterial preset.
     * Used when rendering characters with a material override.
     */
    updateFromMaterial(material: TMPMaterial): void {
        const u = this.resources.localUniforms.uniforms;

        u.uOutlineWidth = material.outlineWidth;
        setColorUniform(u.uOutlineColor as Float32Array, material.outlineColor, material.outlineAlpha);
        u.uOutlineSoftness = material.outlineSoftness;

        (u.uShadowOffset as Float32Array)[0] = material.shadowOffsetX;
        (u.uShadowOffset as Float32Array)[1] = material.shadowOffsetY;
        setColorUniform(u.uShadowColor as Float32Array, material.shadowColor, material.shadowAlpha);
        u.uShadowDilate = material.shadowDilate;
        u.uShadowSoftness = material.shadowSoftness;

        setColorUniform(u.uGlowColor as Float32Array, material.glowColor, material.glowAlpha);
        u.uGlowOffset = material.glowOffset;
        u.uGlowOuter = material.glowOuter;
        u.uGlowInner = material.glowInner;
        u.uGlowPower = material.glowPower;

        u.uFaceDilate = material.faceDilate;

        u.uBevelWidth = material.bevelWidth;
        u.uBevelOffset = material.bevelOffset;
        setColorUniform(u.uBevelColor as Float32Array, material.bevelColor, material.bevelAlpha);

        u.uSharpness = material.sharpness;
    }
}

/** Convert a hex color number to a Float32Array uniform [r, g, b, a]. */
function setColorUniform(arr: Float32Array, color: number, defaultAlpha: number): void {
    arr[0] = ((color >> 16) & 0xff) / 255;
    arr[1] = ((color >> 8) & 0xff) / 255;
    arr[2] = (color & 0xff) / 255;
    arr[3] = defaultAlpha;
}
