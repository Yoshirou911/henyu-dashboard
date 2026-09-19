import type { Metadata } from "next";
import { SubjectDetailScreen } from "@/components/subjects/subject-detail-screen";

export const metadata: Metadata = { title: "科目" };

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  return <SubjectDetailScreen subjectId={decodeURIComponent(subjectId)} />;
}
