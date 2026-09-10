"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** `false` during SSR / first paint, `true` after hydration — without an effect. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
