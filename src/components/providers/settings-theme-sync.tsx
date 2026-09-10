"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { useLive } from "@/hooks/use-live";

/** Keeps next-themes in sync with the theme stored in settings (spec §3/§14). */
export function SettingsThemeSync() {
  const repo = useRepository();
  const { theme, setTheme } = useTheme();
  const stored = useLive(() => repo.getSettings().then((s) => s.theme), []);

  useEffect(() => {
    if (stored && stored !== theme) setTheme(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  return null;
}
