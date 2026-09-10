"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getRepository } from "@/lib/db";
import type { DataRepository } from "@/lib/db/repository";
import { AppLoading } from "@/components/common/app-loading";
import { AppError } from "@/components/common/app-error";

interface RepositoryState {
  repo: DataRepository;
  seeded: boolean;
}

const RepositoryContext = createContext<RepositoryState | null>(null);

type Phase =
  { kind: "loading" } | { kind: "ready"; seeded: boolean } | { kind: "error"; message: string };

/**
 * Opens IndexedDB, seeds the roadmap on first run, and blocks the tree until
 * the store is ready — this is what prevents the load-time flicker (spec §19).
 */
export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [repo] = useState<DataRepository>(() => getRepository());

  useEffect(() => {
    let cancelled = false;
    repo
      .initialize()
      .then(({ seeded }) => {
        if (!cancelled) setPhase({ kind: "ready", seeded });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "データベースの初期化に失敗しました";
        setPhase({ kind: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  if (phase.kind === "loading") return <AppLoading />;
  if (phase.kind === "error") {
    return <AppError message={phase.message} onRetry={() => window.location.reload()} />;
  }

  return (
    <RepositoryContext.Provider value={{ repo, seeded: phase.seeded }}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository(): DataRepository {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error("useRepository must be used within <RepositoryProvider>");
  return ctx.repo;
}

export function useJustSeeded(): boolean {
  return useContext(RepositoryContext)?.seeded ?? false;
}
