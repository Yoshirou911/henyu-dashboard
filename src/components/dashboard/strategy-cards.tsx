"use client";

import { CalendarClock, GraduationCap, Pencil } from "lucide-react";
import Link from "next/link";
import { Meter, scoreColor } from "@/components/common/meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import { longDateLabel } from "@/lib/date";
import type { StudyModel } from "@/lib/model/buildStudyModel";

/** 第一志望カウントダウン (spec §25 — top of the dashboard). */
export function CountdownCard({ model }: { model: StudyModel }) {
  const univ = model.primaryUniversity?.university;
  const days = model.daysToExam;
  const label = univ ? `${univ.name.replace("大学", "大")}3年次編入まで` : model.settings.examName;
  return (
    <Card className="relative overflow-hidden p-5">
      <div
        className="bg-primary/10 pointer-events-none absolute -top-16 -right-16 size-48 rounded-full blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <CalendarClock className="size-3.5" />
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {days >= 0 ? (
              <>
                <span className="text-muted-foreground">あと</span>{" "}
                <span className="text-primary tabular-nums">{days}</span>{" "}
                <span className="text-muted-foreground text-lg font-medium">日</span>
              </>
            ) : (
              <span className="text-muted-foreground">試験日を過ぎています</span>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            試験日: {longDateLabel(model.examDate)}
            {univ ? ` ・ ${univ.faculty} ${univ.departmentOrCourse}` : ""}
          </p>
        </div>
        <Link
          href="/universities"
          className="border-border text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md border p-1.5 transition-colors"
          aria-label="志望校と試験日を編集"
        >
          <Pencil className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}

/** 第一志望の準備度 — only subjects that university requires, by its weights (spec §5). */
export function ReadinessCard({ model }: { model: StudyModel }) {
  const primary = model.primaryUniversity;
  if (!primary) {
    return (
      <Card className="p-5">
        <p className="text-muted-foreground text-sm">
          第一志望が未設定です。
          <Link className="text-primary hover:underline" href="/universities">
            志望校
          </Link>
          から設定してください。
        </p>
      </Card>
    );
  }
  const short = primary.university.name.replace("大学", "大");
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="text-primary size-4" />
          {short}準備度
        </CardTitle>
        <Link href="/universities" className="text-primary text-xs hover:underline">
          全志望校 →
        </Link>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        <ProgressRing value={primary.readiness.score} size={112} strokeWidth={10}>
          <span className="text-2xl font-semibold tabular-nums">
            {Math.round(primary.readiness.score)}
            <span className="text-muted-foreground text-sm">%</span>
          </span>
        </ProgressRing>
        <ul className="min-w-0 flex-1 space-y-2">
          {primary.readiness.breakdown.map((b) => (
            <li key={b.subjectId} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {model.subjectById.get(b.subjectId)?.name}
                  <span className="text-muted-foreground ml-1 text-[10px]">
                    配点{Math.round(b.share * 100)}%
                  </span>
                </span>
                <span className="text-muted-foreground tabular-nums">{Math.round(b.score)}%</span>
              </div>
              <Meter
                value={b.score}
                showValue={false}
                label={`${model.subjectById.get(b.subjectId)?.name}の習熟度`}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** 編入学習全体 — every active subject, independent of any one university (spec §6). */
export function OverallSubjectsCard({ model }: { model: StudyModel }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>編入学習全体</CardTitle>
        <Link href="/subjects" className="text-primary text-xs hover:underline">
          科目別 →
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {model.subjectSummaries
            .filter((s) => !s.subject.hidden)
            .map((s) => (
              <li key={s.subject.id}>
                <Link href={`/subjects/${s.subject.id}`} className="group block space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="group-hover:text-primary font-medium">{s.subject.name}</span>
                    <span className="tabular-nums" style={{ color: scoreColor(s.score) }}>
                      {Math.round(s.score)}%
                    </span>
                  </div>
                  <Meter value={s.score} showValue={false} label={`${s.subject.name}の習熟度`} />
                </Link>
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
