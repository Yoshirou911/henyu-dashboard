import type { Metadata } from "next";
import { SubjectsScreen } from "@/components/subjects/subjects-screen";

export const metadata: Metadata = { title: "科目" };

export default function SubjectsPage() {
  return <SubjectsScreen />;
}
