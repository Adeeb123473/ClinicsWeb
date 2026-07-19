import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend the SAME `expect` instance the test files import from "vitest".
// (Using the "@testing-library/jest-dom/vitest" auto-register subpath is
// avoided here because in this monorepo's npm workspace layout jest-dom is
// hoisted to the repo root while vitest is nested under client/, so that
// subpath would extend a different `vitest` module instance than the one
// actually running the tests.)
expect.extend(matchers);

// Node's built-in experimental `localStorage` global (which requires
// `--localstorage-file` and throws otherwise) can shadow jsdom's working
// implementation in this environment. Zustand's `persist` middleware needs a
// real, working localStorage, so provide a small in-memory polyfill.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});
