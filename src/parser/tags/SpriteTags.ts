/**
 * Sprite tag parsing utility.
 *
 * The `<sprite>` tag is handled directly in the parser's main loop
 * (like `<br>` and `<space>`) because it inserts a character rather
 * than modifying style state.
 *
 * Supported formats:
 * - `<sprite="atlas" name="coin">` — specific atlas + sprite name
 * - `<sprite name="coin">` — search all atlases
 * - `<sprite="spriteName">` — shorthand (no atlas, direct name)
 */

/** Result of parsing a sprite tag. */
export interface SpriteTagResult {
    atlasName: string;
    spriteName: string;
    index: number;
    tint: number;
}

/** Parse sprite tag attributes from the raw value string. */
export function parseSpriteTag(value: string): SpriteTagResult {
    const trimmed = value.trim();
    let atlasName = '';
    let spriteName = '';
    let index = -1;
    let tint = -1;

    // Look for name="..." attribute
    const nameMatch = trimmed.match(/name\s*=\s*["']?([^"'\s>]+)/i);
    if (nameMatch) {
        spriteName = nameMatch[1];
        // Everything before the name= attribute is the atlas name
        const nameIdx = trimmed.indexOf(nameMatch[0]);
        if (nameIdx > 0) {
            atlasName = trimmed.substring(0, nameIdx).trim().replace(/^["']|["']$/g, '');
        }
    } else {
        // Simple format: <sprite="spriteName"> — treat leading value as sprite name
        // Extract just the first token (before any attribute)
        const firstSpace = trimmed.indexOf(' ');
        const leading = firstSpace >= 0 ? trimmed.substring(0, firstSpace) : trimmed;
        spriteName = leading.replace(/^["']|["']$/g, '');
    }

    // Look for index=N attribute
    const indexMatch = trimmed.match(/index\s*=\s*["']?(\d+)/i);
    if (indexMatch) {
        index = parseInt(indexMatch[1], 10);
    }

    // Look for tint=#hex attribute
    const tintMatch = trimmed.match(/tint\s*=\s*["']?#?([0-9a-fA-F]{3,8})/i);
    if (tintMatch) {
        tint = parseInt(tintMatch[1], 16);
    }

    return { atlasName, spriteName, index, tint };
}
