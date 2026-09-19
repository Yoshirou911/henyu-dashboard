import { SCHEMA_VERSION } from "@/lib/constants";
import type { BackupFile } from "@/lib/types";
import { isRecord } from "@/lib/utils";

const REQUIRED_KEYS: (keyof BackupFile["data"])[] = [
  "subjects",
  "categories",
  "topics",
  "studySessions",
  "reviews",
  "dailyGoals",
  "examScores",
  "settings",
  "activityLogs",
];

const OPTIONAL_KEYS: (keyof BackupFile["data"])[] = [
  "universities",
  "universityRequirements",
  "exerciseResults",
  "monthlyGoals",
  "milestones",
  "mockExams",
  "pastExams",
  "pastExamProblems",
];

export interface BackupSummary {
  exportedAt: string;
  schemaVersion: number;
  counts: Record<string, number>;
  schemaMismatch: boolean;
  /** older files are migrated on import; newer ones must not be imported (their extra data would be dropped) */
  versionStatus: "same" | "older" | "newer";
}

export function parseBackup(text: string): { file: BackupFile; summary: BackupSummary } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("JSON として読み取れませんでした。");
  }
  if (!isRecord(json) || json.format !== "henyu-dashboard-backup") {
    throw new Error("このアプリのバックアップファイルではありません。");
  }
  const data = json.data;
  if (!isRecord(data)) throw new Error("バックアップの data セクションが不正です。");

  const counts: Record<string, number> = {};
  for (const key of REQUIRED_KEYS) {
    const arr = (data as Record<string, unknown>)[key];
    if (!Array.isArray(arr)) throw new Error(`「${key}」が配列ではありません。`);
    counts[key] = arr.length;
  }
  // v2 tables are optional so v1 backups still import (they are migrated afterwards)
  for (const key of OPTIONAL_KEYS) {
    const arr = (data as Record<string, unknown>)[key];
    if (arr === undefined) continue;
    if (!Array.isArray(arr)) throw new Error(`「${key}」が配列ではありません。`);
    counts[key] = arr.length;
  }

  const schemaVersion = typeof json.schemaVersion === "number" ? json.schemaVersion : 0;

  return {
    file: json as unknown as BackupFile,
    summary: {
      exportedAt: typeof json.exportedAt === "string" ? json.exportedAt : "不明",
      schemaVersion,
      counts,
      schemaMismatch: schemaVersion !== SCHEMA_VERSION,
      versionStatus:
        schemaVersion === SCHEMA_VERSION
          ? "same"
          : schemaVersion < SCHEMA_VERSION
            ? "older"
            : "newer",
    },
  };
}

export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `henyu-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
