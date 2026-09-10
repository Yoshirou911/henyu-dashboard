import type { Metadata } from "next";
import { Suspense } from "react";
import { RoadmapScreen } from "@/components/roadmap/roadmap-screen";

export const metadata: Metadata = { title: "ロードマップ" };

export default function RoadmapPage() {
  return (
    <Suspense fallback={null}>
      <RoadmapScreen />
    </Suspense>
  );
}
