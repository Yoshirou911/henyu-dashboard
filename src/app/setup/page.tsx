import type { Metadata } from "next";
import { SetupScreen } from "@/components/onboarding/setup-screen";

export const metadata: Metadata = { title: "セットアップ" };

export default function SetupPage() {
  return <SetupScreen />;
}
