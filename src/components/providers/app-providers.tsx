"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { RepositoryProvider } from "@/components/providers/repository-provider";
import { SettingsThemeSync } from "@/components/providers/settings-theme-sync";
import { RecordProvider } from "@/components/record/record-provider";
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
        <TooltipProvider delay={200}>
          <RecordProvider>
            <TimerProvider>
              {children}
              <CommandPalette />
              <Toaster />
            </TimerProvider>
          </RecordProvider>
        </TooltipProvider>
      </RepositoryProvider>
    </ThemeProvider>
  );
}
