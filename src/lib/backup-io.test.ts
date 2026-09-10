import { describe, expect, it } from "vitest";
import { parseBackup } from "@/lib/backup-io";
import { SCHEMA_VERSION } from "@/lib/constants";

function validBackup() {
  return {
    format: "henyu-dashboard-backup",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: "2026-06-01T00:00:00.000Z",
    data: {
      subjects: [{ id: "s1" }],
      categories: [],
      topics: [{ id: "t1" }, { id: "t2" }],
      studySessions: [],
      reviews: [],
      dailyGoals: [],
      examScores: [],
      settings: [{ id: "app" }],
      activityLogs: [],
    },
  };
}

describe("parseBackup", () => {
  it("parses a well-formed backup and reports table counts", () => {
    const { summary } = parseBackup(JSON.stringify(validBackup()));
    expect(summary.counts.topics).toBe(2);
    expect(summary.counts.subjects).toBe(1);
    expect(summary.schemaMismatch).toBe(false);
  });

  it("rejects non-JSON input", () => {
    expect(() => parseBackup("{not json")).toThrow(/JSON/);
  });

  it("rejects a file that is not from this app", () => {
    expect(() => parseBackup(JSON.stringify({ format: "something-else" }))).toThrow(
      /バックアップファイル/,
    );
  });

  it("rejects a backup with a missing table", () => {
    const broken = validBackup();
    // @ts-expect-error intentionally break the shape
    delete broken.data.topics;
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/topics/);
  });

  it("flags a schema version mismatch without throwing", () => {
    const older = { ...validBackup(), schemaVersion: SCHEMA_VERSION + 1 };
    const { summary } = parseBackup(JSON.stringify(older));
    expect(summary.schemaMismatch).toBe(true);
  });
});
