import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { automationAction } from "../system-actions";
import { fmtDate } from "@/lib/util";

export default async function Automations({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const db = adminDb();
  const [{ data: jobs }, { data: logs }, { data: master }] = await Promise.all([db.from("automation_jobs").select("*").order("key"), db.from("automation_logs").select("*").order("started_at", { ascending: false }).limit(40), db.from("site_settings").select("value").eq("key", "automation_enabled").maybeSingle()]);
  const cron = !!process.env.CRON_SECRET;
  return (
    <>
      <Head title="Automations" desc="Rules that flag, remind and summarise. They never publish, post, message or approve anything." />
      <Flash sp={sp} />
      <div className={`notice ${cron && master?.value === true ? "notice-ok" : ""}`} style={{ marginBottom: 16 }}>
        Scheduled runs: {cron ? "Vercel Cron calls the runner once a day at 07:00 WAT (Hobby plan limit: daily)." : "Not configured (CRON_SECRET missing) — use Run now."} Master switch: <b>{master?.value === true ? "ON" : "OFF"}</b> (Settings). Only jobs switched on below run on schedule.
      </div>
      <div className="grid g2" style={{ marginBottom: 16 }}>{(jobs || []).map((j) => (
        <div key={j.key} className="card card-pad stack">
          <div className="row between"><b>{j.name}</b><span className={`badge ${j.enabled ? "badge-green" : "badge-gray"}`}>{j.enabled ? "On" : "Off"}</span></div>
          <p className="small muted" style={{ margin: 0 }}>{j.description}</p>
          <p className="xs" style={{ margin: 0 }}>Last run: {j.last_run_at ? `${fmtDate(j.last_run_at, true)} (${j.last_status})` : "never"}</p>
          <div className="row">
            {me.role !== "analyst" && <form action={automationAction}><input type="hidden" name="key" value={j.key} /><input type="hidden" name="to" value="run" /><Submit className="btn btn-primary btn-sm">Run now</Submit></form>}
            {me.role === "owner" && <form action={automationAction}><input type="hidden" name="key" value={j.key} /><input type="hidden" name="to" value="toggle" /><Submit className="btn btn-outline btn-sm">{j.enabled ? "Turn off" : "Turn on"}</Submit></form>}
            {me.role === "owner" && <form action={automationAction}><input type="hidden" name="key" value={j.key} /><input type="hidden" name="to" value="cancel" /><Submit className="btn btn-ghost btn-sm">Cancel running</Submit></form>}
          </div>
        </div>
      ))}</div>
      <h2 style={{ fontSize: "1.1rem" }}>Execution log</h2>
      {logs?.length ? <div className="stack">{logs.map((l) => (
        <details key={l.id} className="box"><summary><Status s={l.status} /> <b>{l.job_key}</b> · {fmtDate(l.started_at, true)} — <span className="small">{l.summary || l.error || ""}</span></summary>{l.details && <pre className="out">{JSON.stringify(l.details, null, 2)}</pre>}{l.error && <p className="small" style={{ color: "var(--danger)" }}>{l.error}</p>}</details>
      ))}</div> : <p className="small muted">No runs yet.</p>}
    </>
  );
}
