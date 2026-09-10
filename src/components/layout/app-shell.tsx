"use client";

import type { ReactNode } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <OnboardingGate>
      <div className="bg-background flex min-h-dvh">
        <Sidebar className="hidden lg:flex" />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-12">
            <div className="app-fade-in">{children}</div>
          </main>
          <MobileNav className="lg:hidden" />
        </div>
      </div>
    </OnboardingGate>
  );
}
