"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False during the server render and the first client render, true after.
 * Replaces the `useEffect(() => setMounted(true), [])` pattern, which React
 * now flags because it renders everything twice (2026-11-19).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Reads a localStorage key, safely: null on the server, in private mode, or on error. */
export function useLocalStorageValue(key: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}
