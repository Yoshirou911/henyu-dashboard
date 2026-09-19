import type { Metadata } from "next";
import { ExamsScreen } from "@/components/exams/exams-screen";

export const metadata: Metadata = { title: "模試・過去問" };

export default function ExamsPage() {
  return <ExamsScreen />;
}
