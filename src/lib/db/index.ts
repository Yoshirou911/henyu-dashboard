import { DexieRepository } from "@/lib/db/dexie-repository";
import type { DataRepository } from "@/lib/db/repository";

export type { DataRepository } from "@/lib/db/repository";
export { getDb, DB_NAME } from "@/lib/db/schema";

let repo: DataRepository | null = null;

/**
 * Single shared repository instance. The rest of the app imports *this*, never
 * Dexie directly — that keeps a future Supabase implementation a one-file swap.
 */
export function getRepository(): DataRepository {
  if (!repo) repo = new DexieRepository();
  return repo;
}

/** Test helper — inject a fake / fresh repository. */
export function __setRepository(next: DataRepository | null): void {
  repo = next;
}
