/** A named style preset — the opening and closing tag sequences. */
export interface TMPStylePreset {
    /** Opening tag markup, e.g. '<color=#ff0000><b>' */
    open: string;
    /** Closing tag markup, e.g. '</b></color>' */
    close: string;
}

/**
 * A collection of named style presets for use with the <style="name"> tag.
 *
 * Usage:
 * ```ts
 * const styles = TMPStyleSheet.fromJSON({
 *     warning: { open: '<color=#ff4400><b>', close: '</b></color>' },
 *     highlight: { open: '<color=#ffcc00><mark=#ffcc0044>', close: '</mark></color>' },
 * });
 *
 * text.parser.styleSheet = styles;
 * text.text = '<style="warning">DANGER!</style> Normal text.';
 * ```
 */
export class TMPStyleSheet {
    private _styles = new Map<string, TMPStylePreset>();

    /** Get a style preset by name (case-insensitive). */
    get(name: string): TMPStylePreset | undefined {
        return this._styles.get(name.toLowerCase());
    }

    /** Register a style preset by name. */
    set(name: string, preset: TMPStylePreset): void {
        this._styles.set(name.toLowerCase(), preset);
    }

    /** Check if a style preset exists. */
    has(name: string): boolean {
        return this._styles.has(name.toLowerCase());
    }

    /** Remove a style preset. */
    delete(name: string): boolean {
        return this._styles.delete(name.toLowerCase());
    }

    /** Clear all style presets. */
    clear(): void {
        this._styles.clear();
    }

    /** Number of registered style presets. */
    get size(): number {
        return this._styles.size;
    }

    /**
     * Create a TMPStyleSheet from a plain JSON object.
     *
     * Each key is a style name; value has `open` and `close` tag sequences.
     */
    static fromJSON(data: Record<string, TMPStylePreset>): TMPStyleSheet {
        const sheet = new TMPStyleSheet();
        for (const name in data) {
            sheet.set(name, data[name]);
        }
        return sheet;
    }
}
