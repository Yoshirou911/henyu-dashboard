"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/common/empty-state";
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  ChartTooltip,
} from "@/components/analytics/chart-primitives";
import {
  dailyStudyMinutes,
  progressTrend,
  weeklyStudyMinutes,
  type SplitSlice,
} from "@/lib/analytics";
import type { ActivityLog, StudySession, Topic } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

export function WeeklyHoursChart({ sessions }: { sessions: StudySession[] }) {
  const data = useMemo(() => dailyStudyMinutes(sessions, 7), [sessions]);
  const hasData = data.some((d) => d.minutes > 0);
  return (
    <ChartFrame title="週間学習時間" description="直近7日間の日別学習時間">
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} width={44} />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              content={<ChartTooltip format={(v) => formatMinutes(v)} />}
            />
            <Bar dataKey="minutes" name="学習時間" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="この7日間の学習記録がありません" />
      )}
    </ChartFrame>
  );
}

export function MonthlyHoursChart({ sessions }: { sessions: StudySession[] }) {
  const data = useMemo(() => weeklyStudyMinutes(sessions, 10), [sessions]);
  const hasData = data.some((d) => d.minutes > 0);
  return (
    <ChartFrame title="月間学習時間" description="直近10週間の週別学習時間">
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} width={44} />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              content={<ChartTooltip format={(v) => formatMinutes(v)} />}
            />
            <Bar dataKey="minutes" name="学習時間" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="学習記録がありません" />
      )}
    </ChartFrame>
  );
}

export function SplitChart({
  title,
  description,
  data: raw,
}: {
  title: string;
  description: string;
  data: SplitSlice[];
}) {
  const data = raw.filter((s) => s.minutes > 0);
  return (
    <ChartFrame title={title} description={description}>
      {data.length > 0 ? (
        <div className="flex h-full flex-col gap-2 sm:flex-row sm:items-center">
          <ResponsiveContainer width="100%" height="100%" className="max-h-full sm:!w-1/2">
            <PieChart>
              <Pie
                data={data}
                dataKey="minutes"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.id} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip format={(v) => formatMinutes(v)} />} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-1 text-xs sm:w-1/2">
            {data.map((entry, i) => (
              <li key={entry.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {entry.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          title="単元に紐づく学習記録がありません"
          description="タイマーで単元を選んで計測すると集計されます。"
        />
      )}
    </ChartFrame>
  );
}

export function ProgressTrendChart({
  subjectTopics,
  activityLogs,
}: {
  subjectTopics: Topic[];
  activityLogs: ActivityLog[];
}) {
  const data = useMemo(
    () => progressTrend(30, subjectTopics, activityLogs),
    [subjectTopics, activityLogs],
  );
  return (
    <ChartFrame title="進捗推移" description="直近30日間の全体進捗率">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...AXIS_PROPS} width={44} domain={[0, 100]} />
          <Tooltip content={<ChartTooltip unit="%" />} />
          <Line
            type="monotone"
            dataKey="percent"
            name="進捗率"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
