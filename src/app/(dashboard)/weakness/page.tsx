import type { Metadata } from "next";
import { WeaknessScreen } from "@/components/weakness/weakness-screen";

export const metadata: Metadata = { title: "弱点" };

export default function WeaknessPage() {
  return <WeaknessScreen />;
}
