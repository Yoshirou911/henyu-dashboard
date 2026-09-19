"use client";

import { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { useRepository } from "@/components/providers/repository-provider";
import { BackupPanel } from "@/components/backup/backup-panel";
import { AllocationSettings, SubjectManager } from "@/components/settings/subject-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useSubjects } from "@/hooks/use-data";
import { useStudyModel } from "@/hooks/use-study-model";
import { daysUntil } from "@/lib/date";
import type { Settings, Subject } from "@/lib/types";

export function SettingsScreen() {
  const settings = useSettings();
  const subjects = useSubjects();
  const model = useStudyModel();

  return (
    <div className="space-y-6">
      <PageHeader title="設定" />
      {settings ? (
        <SettingsForm
          key="ready"
          settings={settings}
          subjects={(subjects ?? []).filter((s) => !s.archived)}
        />
      ) : (
        <Skeleton className="h-64 w-full rounded-xl" />
      )}
      {model ? (
        <>
          <AllocationSettings
            key={JSON.stringify(model.settings.subjectAllocation ?? {})}
            model={model}
          />
          <SubjectManager model={model} />
        </>
      ) : null}
      <BackupPanel />
    </div>
  );
}

function SettingsForm({ settings, subjects }: { settings: Settings; subjects: Subject[] }) {
  const repo = useRepository();
  const [examName, setExamName] = useState(settings.examName);
  const [examDate, setExamDate] = useState(settings.examDate);
  const [dailyGoal, setDailyGoal] = useState(String(settings.dailyStudyGoalMin));
  const [weeklyGoal, setWeeklyGoal] = useState(String(settings.weeklyStudyGoalMin));
  const [dirty, setDirty] = useState(false);

  async function save() {
    await repo.updateSettings({
      examName: examName.trim() || settings.examName,
      examDate: examDate || settings.examDate,
      dailyStudyGoalMin: Math.max(0, Number.parseInt(dailyGoal, 10) || 0),
      weeklyStudyGoalMin: Math.max(0, Number.parseInt(weeklyGoal, 10) || 0),
    });
    // the countdown follows the 第一志望; keep both in step
    if (settings.primaryUniversityId && examDate && examDate !== settings.examDate) {
      await repo.updateUniversity(settings.primaryUniversityId, { examDate });
    }
    setDirty(false);
    toast({ title: "設定を保存しました", variant: "success" });
  }

  const remaining = daysUntil(examDate || settings.examDate);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>第一志望の試験</CardTitle>
          <CardDescription>正式日程が発表されたら試験日を更新してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-exam-name">試験名</Label>
            <Input
              id="s-exam-name"
              value={examName}
              onChange={(e) => {
                setExamName(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-exam-date">試験日</Label>
              <Input
                id="s-exam-date"
                type="date"
                value={examDate}
                onChange={(e) => {
                  setExamDate(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="flex items-end">
              <p className="text-muted-foreground text-sm">
                現在 <span className="text-foreground font-medium">あと {remaining} 日</span>
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-daily">1日の目標学習時間（分）</Label>
              <Input
                id="s-daily"
                type="number"
                min={0}
                value={dailyGoal}
                onChange={(e) => {
                  setDailyGoal(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-weekly">1週間の目標学習時間（分）</Label>
              <Input
                id="s-weekly"
                type="number"
                min={0}
                value={weeklyGoal}
                onChange={(e) => {
                  setWeeklyGoal(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
          </div>
          <Button onClick={() => void save()} disabled={!dirty}>
            保存
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>表示と復習</CardTitle>
          <CardDescription>ロードマップで最初に開く科目と、復習の扱い。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-primary">既定の科目</Label>
            <Select
              id="s-primary"
              value={settings.primarySubjectId ?? ""}
              onValueChange={(v) => repo.updateSettings({ primarySubjectId: v })}
              items={subjects.map((s) => ({ value: s.id, label: s.name }))}
              aria-label="既定の科目"
              className="max-w-xs"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">
                復習で「できなかった」時にステータスを自動的に下げる
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                オフなら維持し、最初の間隔でやり直します。
              </p>
            </div>
            <Switch
              checked={settings.autoLowerStatusOnFailedReview}
              onCheckedChange={(checked) =>
                repo.updateSettings({ autoLowerStatusOnFailedReview: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
