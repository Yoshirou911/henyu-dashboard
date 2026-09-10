import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsScreen } from "@/components/analytics/analytics-screen";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsScreen />
    </Suspense>
  );
}
