"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <h2 className="text-base font-semibold">画面の表示中に問題が発生しました</h2>
      <p className="text-muted-foreground max-w-md text-sm">{error.message}</p>
      <Button variant="outline" onClick={reset}>
        再試行
      </Button>
    </div>
  );
}
