"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { RepositoryProvider } from "@/components/providers/repository-provider";
import { SettingsThemeSync } from "@/components/providers/settings-theme-sync";
import { TimerProvider } from "@/hooks/use-timer";
import { CommandPalette } from "@/components/command-palette/command-palette";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="henyu.theme"
    >
      <RepositoryProvider>
        <SettingsThemeSync />
        <TimerProvider>
          <TooltipProvider delay={200}>
            {children}
            <CommandPalette />
            <Toaster />
          </TooltipProvider>
        </TimerProvider>
      </RepositoryProvider>
    </ThemeProvider>
  );
}
