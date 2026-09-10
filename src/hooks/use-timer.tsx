"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { toast } from "@/components/ui/toaster";
import type { ID } from "@/lib/types";

const STORAGE_KEY = "henyu.timer.v1";
/** Sessions shorter than this are discarded on stop to avoid clutter. */
const MIN_LOGGABLE_SEC = 20;

interface TimerTarget {
  topicId: ID | null;
  topicName: string | null;
  subjectId: ID | null;
}

interface PersistedTimer extends TimerTarget {
  firstStartedAt: number | null;
  lastResumedAt: number | null;
  accumulatedSec: number;
  running: boolean;
}

const EMPTY: PersistedTimer = {
  topicId: null,
  topicName: null,
  subjectId: null,
  firstStartedAt: null,
  lastResumedAt: null,
  accumulatedSec: 0,
  running: false,
};

interface TimerContextValue {
  target: TimerTarget;
  running: boolean;
  /** whole seconds elapsed on the current session */
  elapsedSec: number;
  hasSession: boolean;
  setTarget: (target: TimerTarget) => void;
  start: (target?: TimerTarget) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  /** finalize: persist a StudySession (when long enough) and clear */
  stop: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function readStored(): PersistedTimer {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistedTimer>;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

function computeElapsed(state: PersistedTimer, now: number): number {
  const live = state.running && state.lastResumedAt ? (now - state.lastResumedAt) / 1000 : 0;
  return Math.max(0, Math.floor(state.accumulatedSec + live));
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const repo = useRepository();
  // Safe: the whole tree under RepositoryProvider mounts only after an async
  // init resolves (post-hydration), so reading storage here can't mismatch SSR.
  const [state, setState] = useState<PersistedTimer>(() => readStored());
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);

  // keep a ref copy so `stop()` can read the latest state without a setState hack
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — timer still works in-memory */
    }
  }, [state]);

  // 1s tick while running
  useEffect(() => {
    if (!state.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.running]);

  const setTarget = useCallback((target: TimerTarget) => {
    setState((prev) => {
      // don't reassign mid-session once time has accrued
      if (prev.accumulatedSec > 0 || prev.running) return prev;
      return { ...prev, ...target };
    });
  }, []);

  const start = useCallback((target?: TimerTarget) => {
    const ts = Date.now();
    setNow(ts);
    setState((prev) => {
      if (prev.running) return prev;
      const next: PersistedTimer = {
        ...prev,
        ...(target && prev.accumulatedSec === 0 ? target : {}),
        firstStartedAt: prev.firstStartedAt ?? ts,
        lastResumedAt: ts,
        running: true,
      };
      return next;
    });
  }, []);

  const pause = useCallback(() => {
    const ts = Date.now();
    setState((prev) => {
      if (!prev.running || !prev.lastResumedAt) return prev;
      return {
        ...prev,
        running: false,
        accumulatedSec: prev.accumulatedSec + (ts - prev.lastResumedAt) / 1000,
        lastResumedAt: null,
      };
    });
  }, []);

  const resume = useCallback(() => start(), [start]);

  const reset = useCallback(() => {
    setState(EMPTY);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(async () => {
    const endedAt = Date.now();
    const snapshot = stateRef.current;
    const elapsed = computeElapsed(snapshot, endedAt);
    if (elapsed >= MIN_LOGGABLE_SEC) {
      try {
        await repo.logStudySession({
          topicId: snapshot.topicId,
          subjectId: snapshot.subjectId,
          startedAt: snapshot.firstStartedAt ?? endedAt - elapsed * 1000,
          endedAt,
          durationSec: elapsed,
          source: "timer",
        });
        toast({
          title: "学習を記録しました",
          description: `${snapshot.topicName ?? "全体"} ・ ${Math.round(elapsed / 60)}分`,
        });
      } catch {
        toast({ title: "記録に失敗しました", variant: "error" });
      }
    }
    reset();
  }, [repo, reset]);

  const elapsedSec = computeElapsed(state, now);

  const value = useMemo<TimerContextValue>(
    () => ({
      target: {
        topicId: state.topicId,
        topicName: state.topicName,
        subjectId: state.subjectId,
      },
      running: state.running,
      elapsedSec,
      hasSession: state.running || state.accumulatedSec > 0 || elapsedSec > 0,
      setTarget,
      start,
      pause,
      resume,
      reset,
      stop,
    }),
    [state, elapsedSec, setTarget, start, pause, resume, reset, stop],
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within <TimerProvider>");
  return ctx;
}
