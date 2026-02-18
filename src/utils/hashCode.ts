/**
 * FNV-1a hash for fast O(1) tag name lookups.
 * Same approach as TMP uses for rich text tag identification.
 */
export function hashCode(str: string): number {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0; // FNV prime, keep as uint32
    }
    return hash;
}
