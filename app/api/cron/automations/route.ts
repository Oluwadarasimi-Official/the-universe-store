import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/supabase/clients";
import { runJob } from "@/lib/automations";

export const dynamic = "force-dynamic";

/* Called once a day by Vercel Cron (vercel.json). Runs only jobs the owner switched on,
   and only if the master automation switch is on. Jobs only flag/summarise — they never publish. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = adminDb();
  // analytics retention
  const { data: ret } = await db.from("site_settings").select("value").eq("key", "analytics_retention_days").maybeSingle();
  const days = Number(ret?.value) || 365;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  await db.from("page_events").delete().lt("occurred_at", cutoff);
  await db.from("click_events").delete().lt("occurred_at", cutoff);
  const { data: master } = await db.from("site_settings").select("value").eq("key", "automation_enabled").maybeSingle();
  if (master?.value !== true) return NextResponse.json({ ran: [], note: "automation master switch is off" });
  const { data: jobs } = await db.from("automation_jobs").select("key").eq("enabled", true);
  const ran = [];
  for (const j of jobs || []) ran.push({ key: j.key, ...(await runJob(j.key, null)) });
  return NextResponse.json({ ran });
}
