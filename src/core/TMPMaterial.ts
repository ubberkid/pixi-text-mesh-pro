/** SDF effect properties that constitute a "material" preset. */
export interface TMPMaterialOptions {
    outlineWidth?: number;
    outlineColor?: string | number;
    outlineSoftness?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowColor?: string | number;
    shadowDilate?: number;
    shadowSoftness?: number;
    glowColor?: string | number;
    glowOffset?: number;
    glowInner?: number;
    glowOuter?: number;
    glowPower?: number;
    faceDilate?: number;
    bevelWidth?: number;
    bevelOffset?: number;
    bevelColor?: string | number;
    sharpness?: number;
    outlineAlpha?: number;
    shadowAlpha?: number;
    glowAlpha?: number;
    bevelAlpha?: number;
}

/**
 * Named preset of SDF shader properties (outline, shadow, glow, bevel, face).
 *
 * Register presets by name, then reference them in rich text:
 * ```ts
 * TMPMaterial.register('Strong Brown Stroke', new TMPMaterial({
 *     outlineWidth: 0.3,
 *     outlineColor: '#5A3000',
 * }));
 *
 * text.text = '<font="Dimbo SDF" material="Strong Brown Stroke">Hello</font>';
 * ```
 */
export class TMPMaterial {
    readonly outlineWidth: number;
    readonly outlineColor: number;
    readonly outlineSoftness: number;
    readonly shadowOffsetX: number;
    readonly shadowOffsetY: number;
    readonly shadowColor: number;
    readonly shadowDilate: number;
    readonly shadowSoftness: number;
    readonly glowColor: number;
    readonly glowOffset: number;
    readonly glowInner: number;
    readonly glowOuter: number;
    readonly glowPower: number;
    readonly faceDilate: number;
    readonly bevelWidth: number;
    readonly bevelOffset: number;
    readonly bevelColor: number;
    readonly sharpness: number;
    readonly outlineAlpha: number;
    readonly shadowAlpha: number;
    readonly glowAlpha: number;
    readonly bevelAlpha: number;

    constructor(options: TMPMaterialOptions = {}) {
        this.outlineWidth = options.outlineWidth ?? 0;
        this.outlineColor = normalizeColor(options.outlineColor ?? 0x000000);
        this.outlineSoftness = options.outlineSoftness ?? 0;
        this.shadowOffsetX = options.shadowOffsetX ?? 0;
        this.shadowOffsetY = options.shadowOffsetY ?? 0;
        this.shadowColor = normalizeColor(options.shadowColor ?? 0x000000);
        this.shadowDilate = options.shadowDilate ?? 0;
        this.shadowSoftness = options.shadowSoftness ?? 0.5;
        this.glowColor = normalizeColor(options.glowColor ?? 0x000000);
        this.glowOffset = options.glowOffset ?? 0;
        this.glowInner = options.glowInner ?? 0;
        this.glowOuter = options.glowOuter ?? 0;
        this.glowPower = options.glowPower ?? 1;
        this.faceDilate = options.faceDilate ?? 0;
        this.bevelWidth = options.bevelWidth ?? 0;
        this.bevelOffset = options.bevelOffset ?? 0.5;
        this.bevelColor = normalizeColor(options.bevelColor ?? 0xffffff);
        this.sharpness = options.sharpness ?? 0;
        this.outlineAlpha = options.outlineAlpha ?? 1;
        this.shadowAlpha = options.shadowAlpha ?? 0.5;
        this.glowAlpha = options.glowAlpha ?? 1;
        this.bevelAlpha = options.bevelAlpha ?? 1;
    }

    // --- Static registry ---

    private static _registry = new Map<string, TMPMaterial>();

    static register(name: string, material: TMPMaterial): void {
        TMPMaterial._registry.set(name.toLowerCase(), material);
    }

    static get(name: string): TMPMaterial | undefined {
        return TMPMaterial._registry.get(name.toLowerCase());
    }

    static has(name: string): boolean {
        return TMPMaterial._registry.has(name.toLowerCase());
    }

    static unregister(name: string): boolean {
        return TMPMaterial._registry.delete(name.toLowerCase());
    }

    static clearRegistry(): void {
        TMPMaterial._registry.clear();
    }

    /**
     * Bulk-register materials from a plain JSON object.
     * ```ts
     * TMPMaterial.fromJSON({
     *     'Strong Brown Stroke': { outlineWidth: 0.3, outlineColor: '#5A3000' },
     *     'White Stroke': { outlineWidth: 0.2, outlineColor: '#ffffff' },
     * });
     * ```
     */
    static fromJSON(data: Record<string, TMPMaterialOptions>): void {
        for (const name in data) {
            TMPMaterial.register(name, new TMPMaterial(data[name]));
        }
    }
}

function normalizeColor(value: string | number): number {
    if (typeof value === 'number') return value;
    if (value.startsWith('#')) {
        return parseInt(value.slice(1), 16);
    }
    return parseInt(value, 16) || 0;
}
