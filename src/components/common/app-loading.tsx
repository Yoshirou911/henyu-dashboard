import { Loader2 } from "lucide-react";

/** Full-screen gate shown while IndexedDB opens (spec §19 — no flicker). */
export function AppLoading() {
  return (
    <div className="bg-background text-muted-foreground flex min-h-dvh flex-col items-center justify-center gap-3">
      <Loader2 className="text-primary size-6 animate-spin" />
      <p className="text-sm">データを読み込んでいます…</p>
    </div>
  );
}
