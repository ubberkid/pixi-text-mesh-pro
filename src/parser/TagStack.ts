/**
 * Simple push/pop stack for a single style property.
 * When a tag opens, we push the current value.
 * When a tag closes, we pop to restore the previous value.
 */
export class TagStack<T> {
    private _stack: T[] = [];
    private _current: T;

    constructor(initial: T) {
        this._current = initial;
    }

    get current(): T {
        return this._current;
    }

    push(value: T): void {
        this._stack.push(this._current);
        this._current = value;
    }

    pop(): T {
        if (this._stack.length > 0) {
            this._current = this._stack.pop()!;
        }
        return this._current;
    }

    reset(value: T): void {
        this._stack.length = 0;
        this._current = value;
    }
}
