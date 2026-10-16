globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.matchMedia ??= () => ({matches: false, addEventListener() {}, removeEventListener() {}});
