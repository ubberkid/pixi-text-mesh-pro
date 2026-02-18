import { hashCode } from '../utils/hashCode';
import type { StyleState } from './RichTextData';

/** Handler function for an opening tag. Returns true if tag was handled. */
export type TagOpenHandler = (
    state: StyleState,
    value: string,
    baseFontSize: number,
) => void;

/** Handler function for a closing tag. */
export type TagCloseHandler = (state: StyleState) => void;

interface TagEntry {
    name: string;
    onOpen: TagOpenHandler;
    onClose: TagCloseHandler;
}

/**
 * FNV-1a hash-based O(1) tag lookup registry.
 * Tags are registered by name and looked up by hash during parsing.
 */
export class TagRegistry {
    private _tags = new Map<number, TagEntry>();

    register(name: string, onOpen: TagOpenHandler, onClose: TagCloseHandler): void {
        const hash = hashCode(name.toLowerCase());
        this._tags.set(hash, { name: name.toLowerCase(), onOpen, onClose });
    }

    getByHash(hash: number): TagEntry | undefined {
        return this._tags.get(hash);
    }

    getByName(name: string): TagEntry | undefined {
        return this._tags.get(hashCode(name.toLowerCase()));
    }

    has(name: string): boolean {
        return this._tags.has(hashCode(name.toLowerCase()));
    }
}
