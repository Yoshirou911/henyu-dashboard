"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppLoading } from "@/components/common/app-loading";
import { useSettings } from "@/hooks/use-data";

/** Sends a brand-new user to the setup screen once (spec §17). */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const router = useRouter();
  const pathname = usePathname();

  const needsSetup = settings !== undefined && !settings.onboardedAt;

  useEffect(() => {
    if (needsSetup && pathname !== "/setup") {
      router.replace("/setup");
    }
  }, [needsSetup, pathname, router]);

  if (settings === undefined) return <AppLoading />;
  if (needsSetup && pathname !== "/setup") return <AppLoading />;
  return <>{children}</>;
}
