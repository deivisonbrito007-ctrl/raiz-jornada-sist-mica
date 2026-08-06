import "@testing-library/jest-dom/vitest";

// Radix (checkbox, popover, select) usa ResizeObserver, ausente no jsdom.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
}
