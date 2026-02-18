// Mock browser globals needed by PixiJS when running in Node
if (typeof globalThis.navigator === 'undefined') {
    (globalThis as Record<string, unknown>).navigator = { userAgent: 'node', gpu: undefined };
}
if (typeof globalThis.window === 'undefined') {
    (globalThis as Record<string, unknown>).window = globalThis;
}
if (typeof globalThis.document === 'undefined') {
    (globalThis as Record<string, unknown>).document = {
        createElement: () => ({
            getContext: () => null,
            style: {},
        }),
        createElementNS: () => ({ style: {} }),
    };
}
