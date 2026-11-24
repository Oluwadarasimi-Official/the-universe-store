import type { Metadata } from "next";
export const metadata: Metadata = { title: "Universe Autopilot", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default function AdminRoot({ children }: { children: React.ReactNode }) { return children; }
