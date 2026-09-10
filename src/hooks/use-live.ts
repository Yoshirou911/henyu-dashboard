"use client";

import { useLiveQuery } from "dexie-react-hooks";

/**
 * Thin wrapper over Dexie's `useLiveQuery`. Screens call repository read
 * methods inside the querier so the reactive layer stays isolated and a
 * future realtime backend can replace just this file.
 */
export function useLive<T>(
  querier: () => Promise<T> | T,
  deps: readonly unknown[] = [],
): T | undefined {
  return useLiveQuery(querier, deps as unknown[]);
}

export function useLiveWithDefault<T>(
  querier: () => Promise<T> | T,
  fallback: T,
  deps: readonly unknown[] = [],
): T {
  return useLiveQuery(querier, deps as unknown[], fallback) as T;
}
