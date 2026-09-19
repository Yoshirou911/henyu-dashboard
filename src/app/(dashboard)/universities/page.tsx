import type { Metadata } from "next";
import { UniversitiesScreen } from "@/components/universities/universities-screen";

export const metadata: Metadata = { title: "志望校" };

export default function UniversitiesPage() {
  return <UniversitiesScreen />;
}
