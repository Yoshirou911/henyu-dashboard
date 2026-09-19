"use client";

import { GitBranch, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusSelect } from "@/components/topic/status-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useTopics } from "@/hooks/use-data";
import { SUGGESTED_STUDIED_TOPICS } from "@/lib/db/seed";
import type { ID, Status } from "@/lib/types";

export function SetupScreen() {
  const repo = useRepository();
  const router = useRouter();
  const settings = useSettings();
  const topics = useTopics();

  const [examName, setExamName] = useState<string | null>(null);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<ID, Status>>({});
  const [busy, setBusy] = useState(false);

  const suggested = useMemo(() => {
    if (!topics) return [];
    return SUGGESTED_STUDIED_TOPICS.map((name) => topics.find((t) => t.name === name)).filter(
      (t): t is NonNullable<typeof t> => Boolean(t),
    );
  }, [topics]);

  if (!settings || !topics) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const nameValue = examName ?? settings.examName;
  const dateValue = examDate ?? settings.examDate;

  async function finish(skip: boolean) {
    setBusy(true);
    try {
      if (!skip) {
        if (nameValue !== settings!.examName || dateValue !== settings!.examDate) {
          await repo.updateSettings({ examName: nameValue.trim(), examDate: dateValue });
        }
        for (const [topicId, status] of Object.entries(picks)) {
          if (status > 0) await repo.setTopicStatus(topicId, status);
        }
      }
      await repo.markOnboarded();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
          <GitBranch className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">初期セットアップ</h1>
          <p className="text-muted-foreground text-sm">
            数分で完了します。あとから設定で変更できます。
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            受験科目のロードマップを作成しました
          </CardTitle>
          <CardDescription>
            数学・物理・英語・TOEIC・C/C++・アルゴリズム・CS基礎・面接の {topics.length}{" "}
            単元と、第一志望（電通大）を含む志望校10校を登録しました。
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>試験の予定</CardTitle>
          <CardDescription>正式日程が未発表のため仮の日付が入っています。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="setup-name">試験名</Label>
            <Input
              id="setup-name"
              value={nameValue}
              onChange={(e) => setExamName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setup-date">試験日</Label>
            <Input
              id="setup-date"
              type="date"
              value={dateValue}
              onChange={(e) => setExamDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>すでに学習済みの単元</CardTitle>
          <CardDescription>
            当てはまるものだけステータスを選んでください。自動で習得扱いにはしません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {suggested.length === 0 ? (
            <p className="text-muted-foreground text-sm">候補が見つかりませんでした。</p>
          ) : (
            suggested.map((topic) => (
              <div
                key={topic.id}
                className="border-border flex items-center justify-between gap-3 rounded-lg border p-2.5"
              >
                <span className="text-sm">{topic.name}</span>
                <StatusSelect
                  value={picks[topic.id] ?? 0}
                  onChange={(s: Status) => setPicks((p) => ({ ...p, [topic.id]: s }))}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => void finish(true)} disabled={busy}>
          スキップ
        </Button>
        <Button onClick={() => void finish(false)} disabled={busy}>
          はじめる
        </Button>
      </div>
    </div>
  );
}
