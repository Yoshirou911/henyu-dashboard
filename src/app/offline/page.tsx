import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "オフライン" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="text-muted-foreground size-8" />
      <h1 className="text-base font-semibold">オフラインです</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        このページはまだキャッシュされていません。学習データは端末内に保存されているため、
        オンラインに戻ると通常どおり利用できます。
      </p>
    </div>
  );
}
