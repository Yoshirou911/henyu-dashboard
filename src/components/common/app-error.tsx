"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="text-destructive size-8" />
      <div className="space-y-1">
        <h1 className="text-base font-semibold">データを読み込めませんでした</h1>
        <p className="text-muted-foreground max-w-md text-sm">{message}</p>
        <p className="text-muted-foreground max-w-md text-xs">
          プライベートブラウジングや、ブラウザのストレージ制限が原因の場合があります。
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          再読み込み
        </Button>
      ) : null}
    </div>
  );
}
