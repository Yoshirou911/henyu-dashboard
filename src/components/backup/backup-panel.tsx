"use client";

import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { SCHEMA_VERSION } from "@/lib/constants";
import { downloadBackup, parseBackup, type BackupSummary } from "@/lib/backup-io";
import type { BackupFile } from "@/lib/types";

const TABLE_LABELS: Record<string, string> = {
  subjects: "教科",
  categories: "分野",
  topics: "単元",
  studySessions: "学習記録",
  reviews: "復習",
  dailyGoals: "日次目標",
  examScores: "過去問得点",
  settings: "設定",
  activityLogs: "アクティビティ",
};

export function BackupPanel() {
  const repo = useRepository();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: BackupFile; summary: BackupSummary } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    try {
      const file = await repo.exportBackup();
      downloadBackup(file);
      toast({ title: "バックアップを書き出しました", variant: "success" });
    } catch {
      toast({ title: "エクスポートに失敗しました", variant: "error" });
    }
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      setPending(parseBackup(text));
    } catch (error) {
      toast({
        title: "読み込めませんでした",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      await repo.importBackup(pending.file);
      toast({ title: "インポートが完了しました", variant: "success" });
      setPending(null);
      setTimeout(() => window.location.reload(), 400);
    } catch {
      toast({ title: "インポートに失敗しました", variant: "error" });
      setBusy(false);
    }
  }

  async function confirmReset() {
    setBusy(true);
    try {
      await repo.resetAll();
      toast({ title: "初期化しました" });
      setTimeout(() => window.location.reload(), 400);
    } catch {
      toast({ title: "初期化に失敗しました", variant: "error" });
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>バックアップ</CardTitle>
        <CardDescription>
          すべてのデータを JSON で書き出し／取り込みできます。schemaVersion: {SCHEMA_VERSION}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleExport()}>
            <Download className="size-4" /> エクスポート
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" /> インポート
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>

        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">全データを削除して初期化</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            数学ロードマップだけの初期状態に戻します。取り消せません。
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-2"
            onClick={() => {
              setResetText("");
              setResetOpen(true);
            }}
          >
            <RotateCcw className="size-4" /> 初期化する
          </Button>
        </div>
      </CardContent>

      {/* Import confirmation (spec §15) */}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>この内容で取り込みますか？</DialogTitle>
            <DialogDescription>
              現在のデータはすべて置き換えられます。事前に現在のデータをエクスポートしておくことを推奨します。
            </DialogDescription>
          </DialogHeader>
          {pending ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground text-xs">
                作成日時: {new Date(pending.summary.exportedAt).toLocaleString("ja-JP")}
              </p>
              {pending.summary.schemaMismatch ? (
                <p className="bg-warning/15 text-warning rounded-md px-2 py-1 text-xs">
                  スキーマバージョンが異なります（ファイル: {pending.summary.schemaVersion} /
                  アプリ: {SCHEMA_VERSION}）。取り込めますが、確認してください。
                </p>
              ) : null}
              <ul className="border-border grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border p-3 text-xs">
                {Object.entries(pending.summary.counts).map(([key, count]) => (
                  <li key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{TABLE_LABELS[key] ?? key}</span>
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              キャンセル
            </Button>
            <Button onClick={() => void confirmImport()} disabled={busy}>
              置き換えて取り込む
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>本当に初期化しますか？</DialogTitle>
            <DialogDescription>
              確認のため <span className="font-mono font-medium">削除</span> と入力してください。
            </DialogDescription>
          </DialogHeader>
          <Input value={resetText} onChange={(e) => setResetText(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={busy}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={resetText !== "削除" || busy}
              onClick={() => void confirmReset()}
            >
              初期化する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
