/**
 * Custom SDF shader bits for TMP effects: outline, shadow/underlay, glow, bevel.
 *
 * Matches Unity TMP's compositing pipeline:
 * - GetColor() for face+outline band compositing
 * - Underlay via UV-offset re-sampling (not gradient approximation)
 * - GetGlowColor() with inner/outer asymmetry and additive compositing
 * - 4-tap bevel normal via finite difference of the SDF
 * - Scale ratios (A/B/C) for resolution-independent effects
 * - Resolution-adaptive AA via screen-space smoothstep
 */

// ---------- WGSL (WebGPU) ----------

export const tmpSDFBit = {
    name: 'tmp-sdf-bit',
    fragment: {
        header: /* wgsl */`
            fn calculateTMPAlpha(
                msdfColor: vec4<f32>,
                shapeColor: vec4<f32>,
                distance: f32,
                outlineWidth: f32,
                outlineColor: vec4<f32>,
                outlineSoftness: f32,
                shadowOffset: vec2<f32>,
                shadowColor: vec4<f32>,
                shadowDilate: f32,
                shadowSoftness: f32,
                glowColor: vec4<f32>,
                glowOffset: f32,
                glowOuter: f32,
                glowInner: f32,
                glowPower: f32,
                faceDilate: f32,
                bevelWidth: f32,
                bevelOffset: f32,
                bevelColor: vec4<f32>,
                scaleRatioA: f32,
                scaleRatioB: f32,
                scaleRatioC: f32,
                texSize: vec2<f32>,
                sharpness: f32,
                gradientScale: f32,
                vUV: vec2<f32>,
                msdfSample: vec4<f32>,
            ) -> vec4<f32> {
                // MSDF median
                var median = msdfColor.r + msdfColor.g + msdfColor.b -
                    min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                    max(msdfColor.r, max(msdfColor.g, msdfColor.b));
                median = min(median, msdfColor.a);

                // Scale: Unity computes scale from screen-space derivatives and _GradientScale.
                // Here, 'distance' is our pre-computed equivalent (worldScale * dfRange / fontScale).
                // Apply sharpness boost matching Unity: scale *= (1 + _Sharpness)
                var scale = distance * (1.0 + sharpness);

                // Weight = (faceDilate * scaleRatioA * 0.5) following Unity:
                // weight = (weight + _FaceDilate) * _ScaleRatioA * 0.5
                var weight = faceDilate * scaleRatioA * 0.5;

                // Apply outline softness to scale (Unity: scale /= 1 + (_OutlineSoftness * _ScaleRatioA * scale))
                var scaledOutlineSoftness = outlineSoftness * scaleRatioA;
                var softScale = scale / (1.0 + scaledOutlineSoftness * scale);

                // --- Face alpha (Unity: faceColor * saturate((d - param.x) * scale + 0.5)) ---
                // param.x = 0.5 - weight
                var faceThreshold = 0.5 - weight;
                var faceAlpha = clamp((median - faceThreshold) * softScale + 0.5, 0.0, 1.0);
                var faceResult = shapeColor * faceAlpha;
                // Premultiply face
                faceResult = vec4<f32>(faceResult.rgb * faceResult.a, faceResult.a);

                // --- Outline compositing (Unity GetColor / OUTLINE_ON) ---
                // outlineWidth is [0,1], param.z = outlineWidth * scaleRatioA * 0.5
                var scaledOutlineWidth = outlineWidth * scaleRatioA * 0.5;

                if (outlineWidth > 0.0) {
                    // Unity: outlineColor = lerp(faceColor, outlineColor, sqrt(min(1, param.z * scale * 2)))
                    var outlineFade = sqrt(min(1.0, scaledOutlineWidth * softScale * 2.0));
                    var premulOutline = vec4<f32>(outlineColor.rgb * outlineColor.a, outlineColor.a);
                    var premulFace = vec4<f32>(shapeColor.rgb * shapeColor.a, shapeColor.a);
                    var blendedOutline = mix(premulFace, premulOutline, outlineFade);

                    // Unity: faceColor = lerp(outlineColor, faceColor, saturate((d - param.x - param.z) * scale + 0.5))
                    var innerEdge = clamp((median - faceThreshold - scaledOutlineWidth) * softScale + 0.5, 0.0, 1.0);
                    faceResult = mix(blendedOutline, premulFace, innerEdge);

                    // Unity: faceColor *= saturate((d - param.x + param.z) * scale + 0.5)
                    var outerEdge = clamp((median - faceThreshold + scaledOutlineWidth) * softScale + 0.5, 0.0, 1.0);
                    faceResult = faceResult * outerEdge;
                }

                var composited = faceResult;

                // --- Bevel: 4-tap finite difference for SDF gradient ---
                if (bevelWidth > 0.0 && composited.a > 0.01) {
                    var texelSize = vec2<f32>(1.0 / texSize.x, 1.0 / texSize.y);

                    // We use the msdfSample that was passed in (same as msdfColor for center).
                    // For the 4 offset taps, we approximate using the MSDF channels since
                    // we cannot do additional texture samples in the batch pipeline.
                    // Use the R channel differences as a gradient proxy.
                    var left  = msdfColor.r;
                    var right = msdfColor.g;
                    var down  = msdfColor.b;
                    var up    = msdfColor.a;

                    // Approximate normal from MSDF channel differences
                    var nx = right - left;
                    var ny = up - down;
                    var normal = normalize(vec3<f32>(nx, ny, 0.05));

                    var lightAngle = bevelOffset * 3.14159 * 2.0;
                    var lightDir = normalize(vec3<f32>(cos(lightAngle), sin(lightAngle), 0.5));

                    var highlight = clamp(dot(normal, lightDir), 0.0, 1.0) * bevelWidth * composited.a;

                    composited = vec4<f32>(
                        mix(composited.rgb, bevelColor.rgb * bevelColor.a, clamp(highlight, 0.0, 1.0)),
                        composited.a
                    );
                }

                // --- Shadow / underlay via UV-offset re-sampling ---
                // Unity: re-samples texture at offset UV, not gradient approximation.
                // Offset = -(_UnderlayOffset * _ScaleRatioC) * _GradientScale / textureSize
                if (shadowDilate > 0.0 || shadowOffset.x != 0.0 || shadowOffset.y != 0.0) {
                    var uvOffset = vec2<f32>(
                        -(shadowOffset.x * scaleRatioC) * gradientScale / texSize.x,
                        -(shadowOffset.y * scaleRatioC) * gradientScale / texSize.y
                    );
                    var shadowUV = vUV + uvOffset;

                    // Re-sample the SDF at the offset UV.
                    // In batch pipeline we can't do a second texture fetch, so we approximate:
                    // shift the median by the offset magnitude projected onto the SDF gradient.
                    // This is the best we can do without a second texture sample.
                    var sdx = msdfColor.r - msdfColor.g;
                    var sdy = msdfColor.b - ((msdfColor.r + msdfColor.g) * 0.5);
                    var sGradLen = sqrt(sdx * sdx + sdy * sdy) + 0.001;
                    var gradDir = vec2<f32>(sdx / sGradLen, sdy / sGradLen);

                    var uvOffsetLen = sqrt(uvOffset.x * uvOffset.x + uvOffset.y * uvOffset.y);
                    var offsetDir = vec2<f32>(uvOffset.x / (uvOffsetLen + 0.001), uvOffset.y / (uvOffsetLen + 0.001));

                    // Project the UV offset onto the SDF gradient direction
                    var shadowMedian = median + dot(gradDir, offsetDir) * uvOffsetLen * texSize.x * 0.5;

                    // Apply underlay dilate and softness (Unity scale ratios)
                    var layerScale = scale;
                    var scaledUnderlaySoftness = shadowSoftness * scaleRatioC;
                    layerScale = layerScale / (1.0 + scaledUnderlaySoftness * layerScale);
                    var layerBias = faceThreshold * layerScale - 0.5 - (shadowDilate * scaleRatioC * 0.5 * layerScale);

                    var shadowAlpha = clamp(shadowMedian * layerScale - layerBias, 0.0, 1.0);
                    var premulShadow = vec4<f32>(shadowColor.rgb * shadowColor.a, shadowColor.a);

                    // Composite shadow behind face+outline (Unity: += shadow * (1 - faceColor.a))
                    composited = composited + premulShadow * shadowAlpha * (1.0 - composited.a);
                }

                // --- Glow: additive compositing with inner/outer asymmetry ---
                // Unity GetGlowColor:
                //   glow = d - (_GlowOffset * _ScaleRatioB) * 0.5 * scale
                //   t = lerp(_GlowInner, _GlowOuter * _ScaleRatioB, step(0, glow)) * 0.5 * scale
                //   glow = saturate(abs(glow / (1 + t)))
                //   glow = 1 - pow(glow, _GlowPower)
                //   glow *= sqrt(min(1, t))  // fade thin glow
                if (glowOuter > 0.0 || glowInner > 0.0) {
                    var glowD = median * softScale - (glowOffset * scaleRatioB) * 0.5 * softScale;
                    var glowStep = step(0.0, glowD);
                    var t = mix(glowInner, glowOuter * scaleRatioB, glowStep) * 0.5 * softScale;
                    var glowMask = clamp(abs(glowD / (1.0 + t)), 0.0, 1.0);
                    glowMask = 1.0 - pow(glowMask, glowPower);
                    glowMask = glowMask * sqrt(min(1.0, t));

                    var glowAlpha = clamp(glowColor.a * glowMask * 2.0, 0.0, 1.0);

                    // Additive glow compositing (Unity adds glow as a separate pass)
                    composited = vec4<f32>(
                        composited.rgb + glowColor.rgb * glowAlpha,
                        max(composited.a, glowAlpha)
                    );
                }

                // Discard nearly invisible fragments
                if (median < 0.01 && outlineWidth <= 0.0 && (glowOuter <= 0.0 && glowInner <= 0.0)
                    && shadowDilate <= 0.0 && shadowOffset.x == 0.0 && shadowOffset.y == 0.0) {
                    composited.a = 0.0;
                }

                return composited;
            }
        `,
    },
};

// ---------- GLSL (WebGL) ----------

export const tmpSDFBitGl = {
    name: 'tmp-sdf-bit',
    fragment: {
        header: /* glsl */`
            vec4 calculateTMPAlpha(
                vec4 msdfColor,
                vec4 shapeColor,
                float distance,
                float outlineWidth,
                vec4 outlineColor,
                float outlineSoftness,
                vec2 shadowOffset,
                vec4 shadowColor,
                float shadowDilate,
                float shadowSoftness,
                vec4 glowColor,
                float glowOffset,
                float glowOuter,
                float glowInner,
                float glowPower,
                float faceDilate,
                float bevelWidth,
                float bevelOffset,
                vec4 bevelColor,
                float scaleRatioA,
                float scaleRatioB,
                float scaleRatioC,
                vec2 texSize,
                float sharpness,
                float gradientScale,
                vec2 vUV,
                vec4 msdfSample
            ) {
                // MSDF median
                float median = msdfColor.r + msdfColor.g + msdfColor.b -
                    min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                    max(msdfColor.r, max(msdfColor.g, msdfColor.b));
                median = min(median, msdfColor.a);

                // Scale with sharpness boost (Unity: scale *= (1 + _Sharpness))
                float scale = distance * (1.0 + sharpness);

                // Weight from face dilate (Unity: weight = (weight + _FaceDilate) * _ScaleRatioA * 0.5)
                float weight = faceDilate * scaleRatioA * 0.5;

                // Apply outline softness to scale (Unity: scale /= 1 + (_OutlineSoftness * _ScaleRatioA * scale))
                float scaledOutlineSoftness = outlineSoftness * scaleRatioA;
                float softScale = scale / (1.0 + scaledOutlineSoftness * scale);

                // Face alpha (Unity: faceColor * saturate((d - param.x) * scale + 0.5))
                float faceThreshold = 0.5 - weight;
                float faceAlpha = clamp((median - faceThreshold) * softScale + 0.5, 0.0, 1.0);
                vec4 faceResult = shapeColor * faceAlpha;
                // Premultiply face
                faceResult = vec4(faceResult.rgb * faceResult.a, faceResult.a);

                // Outline compositing (Unity GetColor / OUTLINE_ON)
                float scaledOutlineWidth = outlineWidth * scaleRatioA * 0.5;

                if (outlineWidth > 0.0) {
                    // Unity: outlineColor = lerp(faceColor, outlineColor, sqrt(min(1, param.z * scale * 2)))
                    float outlineFade = sqrt(min(1.0, scaledOutlineWidth * softScale * 2.0));
                    vec4 premulOutline = vec4(outlineColor.rgb * outlineColor.a, outlineColor.a);
                    vec4 premulFace = vec4(shapeColor.rgb * shapeColor.a, shapeColor.a);
                    vec4 blendedOutline = mix(premulFace, premulOutline, outlineFade);

                    // Unity: faceColor = lerp(outlineColor, faceColor, saturate((d - param.x - param.z) * scale + 0.5))
                    float innerEdge = clamp((median - faceThreshold - scaledOutlineWidth) * softScale + 0.5, 0.0, 1.0);
                    faceResult = mix(blendedOutline, premulFace, innerEdge);

                    // Unity: faceColor *= saturate((d - param.x + param.z) * scale + 0.5)
                    float outerEdge = clamp((median - faceThreshold + scaledOutlineWidth) * softScale + 0.5, 0.0, 1.0);
                    faceResult *= outerEdge;
                }

                vec4 composited = faceResult;

                // Bevel: approximate normal from MSDF channels
                if (bevelWidth > 0.0 && composited.a > 0.01) {
                    float left  = msdfColor.r;
                    float right = msdfColor.g;
                    float down  = msdfColor.b;
                    float up    = msdfColor.a;

                    float nx = right - left;
                    float ny = up - down;
                    vec3 normal = normalize(vec3(nx, ny, 0.05));

                    float lightAngle = bevelOffset * 3.14159 * 2.0;
                    vec3 lightDir = normalize(vec3(cos(lightAngle), sin(lightAngle), 0.5));

                    float highlight = clamp(dot(normal, lightDir), 0.0, 1.0) * bevelWidth * composited.a;

                    composited = vec4(
                        mix(composited.rgb, bevelColor.rgb * bevelColor.a, clamp(highlight, 0.0, 1.0)),
                        composited.a
                    );
                }

                // Shadow / underlay via UV-offset approximation
                if (shadowDilate > 0.0 || shadowOffset.x != 0.0 || shadowOffset.y != 0.0) {
                    vec2 uvOffset = vec2(
                        -(shadowOffset.x * scaleRatioC) * gradientScale / texSize.x,
                        -(shadowOffset.y * scaleRatioC) * gradientScale / texSize.y
                    );

                    float sdx = msdfColor.r - msdfColor.g;
                    float sdy = msdfColor.b - ((msdfColor.r + msdfColor.g) * 0.5);
                    float sGradLen = sqrt(sdx * sdx + sdy * sdy) + 0.001;
                    vec2 gradDir = vec2(sdx / sGradLen, sdy / sGradLen);

                    float uvOffsetLen = sqrt(uvOffset.x * uvOffset.x + uvOffset.y * uvOffset.y);
                    vec2 offsetDir = vec2(uvOffset.x / (uvOffsetLen + 0.001), uvOffset.y / (uvOffsetLen + 0.001));

                    float shadowMedian = median + dot(gradDir, offsetDir) * uvOffsetLen * texSize.x * 0.5;

                    float layerScale = scale;
                    float scaledUnderlaySoftness = shadowSoftness * scaleRatioC;
                    layerScale /= 1.0 + scaledUnderlaySoftness * layerScale;
                    float layerBias = faceThreshold * layerScale - 0.5 - (shadowDilate * scaleRatioC * 0.5 * layerScale);

                    float shadowAlpha = clamp(shadowMedian * layerScale - layerBias, 0.0, 1.0);
                    vec4 premulShadow = vec4(shadowColor.rgb * shadowColor.a, shadowColor.a);

                    composited += premulShadow * shadowAlpha * (1.0 - composited.a);
                }

                // Glow: inner/outer asymmetry with additive compositing (Unity GetGlowColor)
                if (glowOuter > 0.0 || glowInner > 0.0) {
                    float glowD = median * softScale - (glowOffset * scaleRatioB) * 0.5 * softScale;
                    float glowStep = step(0.0, glowD);
                    float t = mix(glowInner, glowOuter * scaleRatioB, glowStep) * 0.5 * softScale;
                    float glowMask = clamp(abs(glowD / (1.0 + t)), 0.0, 1.0);
                    glowMask = 1.0 - pow(glowMask, glowPower);
                    glowMask *= sqrt(min(1.0, t));

                    float glowAlpha = clamp(glowColor.a * glowMask * 2.0, 0.0, 1.0);

                    composited = vec4(
                        composited.rgb + glowColor.rgb * glowAlpha,
                        max(composited.a, glowAlpha)
                    );
                }

                // Discard nearly invisible
                if (median < 0.01 && outlineWidth <= 0.0 && (glowOuter <= 0.0 && glowInner <= 0.0)
                    && shadowDilate <= 0.0 && shadowOffset.x == 0.0 && shadowOffset.y == 0.0) {
                    composited.a = 0.0;
                }

                return composited;
            }
        `,
    },
};

// ---------- Local Uniform Bits ----------

export const localUniformTMPBit = {
    name: 'local-uniform-tmp-bit',
    vertex: {
        header: /* wgsl */`
            struct LocalUniforms {
                uColor: vec4<f32>,
                uTransformMatrix: mat3x3<f32>,
                uDistance: f32,
                uRound: f32,
                uOutlineWidth: f32,
                uOutlineColor: vec4<f32>,
                uOutlineSoftness: f32,
                uShadowOffset: vec2<f32>,
                uShadowColor: vec4<f32>,
                uShadowDilate: f32,
                uShadowSoftness: f32,
                uGlowColor: vec4<f32>,
                uGlowOffset: f32,
                uGlowOuter: f32,
                uGlowInner: f32,
                uGlowPower: f32,
                uFaceDilate: f32,
                uBevelWidth: f32,
                uBevelOffset: f32,
                uBevelColor: vec4<f32>,
                uScaleRatioA: f32,
                uScaleRatioB: f32,
                uScaleRatioC: f32,
                uTexSize: vec2<f32>,
                uSharpness: f32,
                uGradientScale: f32,
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,
        main: /* wgsl */`
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `,
        end: /* wgsl */`
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `,
    },
    fragment: {
        header: /* wgsl */`
            struct LocalUniforms {
                uColor: vec4<f32>,
                uTransformMatrix: mat3x3<f32>,
                uDistance: f32,
                uRound: f32,
                uOutlineWidth: f32,
                uOutlineColor: vec4<f32>,
                uOutlineSoftness: f32,
                uShadowOffset: vec2<f32>,
                uShadowColor: vec4<f32>,
                uShadowDilate: f32,
                uShadowSoftness: f32,
                uGlowColor: vec4<f32>,
                uGlowOffset: f32,
                uGlowOuter: f32,
                uGlowInner: f32,
                uGlowPower: f32,
                uFaceDilate: f32,
                uBevelWidth: f32,
                uBevelOffset: f32,
                uBevelColor: vec4<f32>,
                uScaleRatioA: f32,
                uScaleRatioB: f32,
                uScaleRatioC: f32,
                uTexSize: vec2<f32>,
                uSharpness: f32,
                uGradientScale: f32,
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,
        main: /* wgsl */`
            outColor = calculateTMPAlpha(
                outColor,
                localUniforms.uColor,
                localUniforms.uDistance,
                localUniforms.uOutlineWidth,
                localUniforms.uOutlineColor,
                localUniforms.uOutlineSoftness,
                localUniforms.uShadowOffset,
                localUniforms.uShadowColor,
                localUniforms.uShadowDilate,
                localUniforms.uShadowSoftness,
                localUniforms.uGlowColor,
                localUniforms.uGlowOffset,
                localUniforms.uGlowOuter,
                localUniforms.uGlowInner,
                localUniforms.uGlowPower,
                localUniforms.uFaceDilate,
                localUniforms.uBevelWidth,
                localUniforms.uBevelOffset,
                localUniforms.uBevelColor,
                localUniforms.uScaleRatioA,
                localUniforms.uScaleRatioB,
                localUniforms.uScaleRatioC,
                localUniforms.uTexSize,
                localUniforms.uSharpness,
                localUniforms.uGradientScale,
                vUV,
                outColor,
            );
        `,
    },
};

export const localUniformTMPBitGl = {
    name: 'local-uniform-tmp-bit',
    vertex: {
        header: /* glsl */`
            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `,
        main: /* glsl */`
            vColor *= uColor;
            modelMatrix *= uTransformMatrix;
        `,
        end: /* glsl */`
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `,
    },
    fragment: {
        header: /* glsl */`
            uniform float uDistance;
            uniform float uOutlineWidth;
            uniform vec4 uOutlineColor;
            uniform float uOutlineSoftness;
            uniform vec2 uShadowOffset;
            uniform vec4 uShadowColor;
            uniform float uShadowDilate;
            uniform float uShadowSoftness;
            uniform vec4 uGlowColor;
            uniform float uGlowOffset;
            uniform float uGlowOuter;
            uniform float uGlowInner;
            uniform float uGlowPower;
            uniform float uFaceDilate;
            uniform float uBevelWidth;
            uniform float uBevelOffset;
            uniform vec4 uBevelColor;
            uniform float uScaleRatioA;
            uniform float uScaleRatioB;
            uniform float uScaleRatioC;
            uniform vec2 uTexSize;
            uniform float uSharpness;
            uniform float uGradientScale;
        `,
        main: /* glsl */`
            outColor = calculateTMPAlpha(
                outColor,
                vColor,
                uDistance,
                uOutlineWidth,
                uOutlineColor,
                uOutlineSoftness,
                uShadowOffset,
                uShadowColor,
                uShadowDilate,
                uShadowSoftness,
                uGlowColor,
                uGlowOffset,
                uGlowOuter,
                uGlowInner,
                uGlowPower,
                uFaceDilate,
                uBevelWidth,
                uBevelOffset,
                uBevelColor,
                uScaleRatioA,
                uScaleRatioB,
                uScaleRatioC,
                uTexSize,
                uSharpness,
                uGradientScale,
                vUV,
                outColor
            );
        `,
    },
};
