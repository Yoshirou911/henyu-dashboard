import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-3xl font-semibold">404</p>
      <p className="text-muted-foreground text-sm">ページが見つかりませんでした。</p>
      <Link href="/" className="text-primary text-sm font-medium hover:underline">
        ダッシュボードに戻る
      </Link>
    </div>
  );
}
