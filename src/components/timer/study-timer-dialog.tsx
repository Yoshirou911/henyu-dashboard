"use client";

import { TimerPanel } from "@/components/timer/timer-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StudyTimerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>学習タイマー</DialogTitle>
          <DialogDescription>
            単元を選んでスタート。終了すると学習時間と問題数をまとめて記録できます。
          </DialogDescription>
        </DialogHeader>
        <TimerPanel onRecordOpen={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
