import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { providerAction, playground, socialAccountAction } from "../system-actions";
import { PROVIDERS, getPriority } from "@/lib/ai/providers";
import { fmtDate } from "@/lib/util";

export default async function Integrations({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const db = adminDb(); const owner = me.role === "owner";
  const [priority, { data: stored }, { data: runs }, { data: accounts }] = await Promise.all([
    getPriority(), db.from("provider_secrets").select("provider,last4,model,base_url,updated_at"),
    db.from("ai_runs").select("*").order("created_at", { ascending: false }).limit(60), db.from("social_accounts").select("*").order("channel"),
  ]);
  const lastTest = (id: string) => runs?.find((r) => r.provider === id && (r.purpose === "connection_test" || r.status !== "skipped"));
  const statusOf = (id: string, envKey: string) => {
    const configured = !!process.env[envKey] || !!stored?.find((s) => s.provider === id);
    if (!configured) return "Not configured";
    const t = lastTest(id);
    if (!t) return "Configured — not tested";
    return t.status === "success" ? "Connected" : t.status === "rate_limited" ? "Rate limited" : t.status === "skipped" ? "Not configured" : "Error";
  };
  const encOk = !!process.env.APP_ENCRYPTION_KEY;
  return (
    <>
      <Head title="Integrations" desc="Real connection status only. Status comes from the latest actual test request; keys never leave the server." />
      <Flash sp={sp} />
      <h2 style={{ fontSize: "1.1rem" }}>AI providers</h2>
      <p className="small muted">Fallback order: <b>{priority.join(" → ")}</b>. Each configured provider is tried once per request; every attempt and fallback reason is logged below.</p>
      <div className="grid g2" style={{ marginBottom: 16 }}>
        {PROVIDERS.map((p) => {
          const st = statusOf(p.id, p.envKey); const s = stored?.find((x) => x.provider === p.id); const t = lastTest(p.id);
          return (
            <div key={p.id} className="card card-pad stack">
              <div className="row between"><b>{p.name}</b><Status s={st} /></div>
              <p className="xs muted" style={{ margin: 0 }}>{p.note}</p>
              <p className="xs" style={{ margin: 0 }}>Key source: {process.env[p.envKey] ? `server env ${p.envKey}` : s ? `stored in admin (…${s.last4})` : "none"} · model: {process.env[`${p.id.toUpperCase()}_MODEL`] || s?.model || p.defaultModel || "not set"}</p>
              {t && <p className="xs muted" style={{ margin: 0 }}>Last result {fmtDate(t.created_at, true)}: {t.status}{t.error ? ` — ${t.error}` : ""}{t.latency_ms ? ` (${t.latency_ms} ms)` : ""}</p>}
              <div className="row">
                {me.role !== "analyst" && <form action={providerAction}><input type="hidden" name="to" value="test" /><input type="hidden" name="provider" value={p.id} /><Submit className="btn btn-outline btn-sm">Test connection</Submit></form>}
                {owner && s && <form action={providerAction}><input type="hidden" name="to" value="remove_key" /><input type="hidden" name="provider" value={p.id} /><Submit className="btn btn-danger btn-sm" confirm="Remove the stored key?">Remove stored key</Submit></form>}
              </div>
              {owner && (encOk ? <details><summary className="small">Paste an API key (stored encrypted)</summary>
                <form action={providerAction} className="stack" style={{ marginTop: 8 }}>
                  <input type="hidden" name="to" value="save_key" /><input type="hidden" name="provider" value={p.id} />
                  <input className="input" name="key" type="password" placeholder="API key" autoComplete="off" required />
                  {p.id === "darax" && <input className="input" name="base_url" type="url" placeholder="Base URL (OpenAI-compatible), e.g. https://api.example.com/v1" />}
                  <input className="input" name="model" placeholder={`Model (default ${p.defaultModel || "required"})`} />
                  <Submit className="btn btn-primary btn-sm">Save & test</Submit>
                </form></details> : <p className="xs muted">Set APP_ENCRYPTION_KEY on the server to paste keys here; or set {p.envKey} in Vercel.</p>)}
            </div>
          );
        })}
      </div>
      {owner && <form action={providerAction} className="card card-pad row" style={{ marginBottom: 16 }}>
        <input type="hidden" name="to" value="priority" />
        <label htmlFor="order" className="small"><b>Provider priority</b> (comma-separated)</label>
        <input id="order" name="order" className="input" defaultValue={priority.join(", ")} style={{ maxWidth: 360 }} />
        <Submit className="btn btn-outline btn-sm">Save priority</Submit>
      </form>}
      {me.role !== "analyst" && <form action={playground} className="card card-pad" style={{ marginBottom: 16 }}>
        <b className="small">Generate with a selected provider (troubleshooting)</b>
        <div className="row" style={{ marginTop: 8 }}>
          <select name="provider" className="select" style={{ maxWidth: 220 }}><option value="">Auto (with fallback)</option>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input name="prompt" className="input" placeholder="Say hello in one sentence" style={{ maxWidth: 420 }} required />
          <Submit className="btn btn-outline btn-sm">Run</Submit>
        </div>
      </form>}
      <h2 style={{ fontSize: "1.1rem" }}>Other connections</h2>
      <div className="table-wrap" style={{ marginBottom: 16 }}><table className="t cards"><thead><tr><th>Service</th><th>Status</th><th>Notes</th></tr></thead><tbody>
        <tr><td data-l="Service">Supabase (database & auth)</td><td data-l="Status"><Status s="Connected" /></td><td data-l="Notes" className="small">Free tier. Schema <code>universe_store</code>.</td></tr>
        <tr><td data-l="Service">Jumia affiliate (JForce)</td><td data-l="Status"><span className="badge badge-gray">Manual</span></td><td data-l="Notes" className="small">No API/feed connected. Paste issued tracking links per product; verify them yourself. No scraping.</td></tr>
        <tr><td data-l="Service">Daily automations (Vercel Cron)</td><td data-l="Status"><span className={`badge ${process.env.CRON_SECRET ? "badge-green" : "badge-gray"}`}>{process.env.CRON_SECRET ? "Configured (daily)" : "Not configured"}</span></td><td data-l="Notes" className="small">Hobby plan allows one run per day. Use “Run now” in Automations any time.</td></tr>
        <tr><td data-l="Service">Email sending</td><td data-l="Status"><span className="badge badge-gray">Not configured</span></td><td data-l="Notes" className="small">Contact messages are stored in the Messages inbox instead.</td></tr>
      </tbody></table></div>
      <h2 style={{ fontSize: "1.1rem" }}>Social accounts</h2>
      <p className="small muted">Direct publishing is not connected for any platform (it requires approved developer apps and account authorization). Posting is manual via copy/export.</p>
      <div className="grid g3" style={{ marginBottom: 16 }}>{(accounts || []).map((a) => (
        <form key={a.channel} action={socialAccountAction} className="card card-pad stack">
          <div className="row between"><b>{a.channel}</b><span className="badge badge-gray">Manual publishing</span></div>
          <input type="hidden" name="channel" value={a.channel} />
          <input className="input" name="handle" defaultValue={a.handle || ""} placeholder="@handle" disabled={!owner} />
          <input className="input" name="profile_url" type="url" defaultValue={a.profile_url || ""} placeholder="Profile URL" disabled={!owner} />
          <input className="input" name="notes" defaultValue={a.notes || ""} placeholder="Notes" disabled={!owner} />
          {owner && <Submit className="btn btn-outline btn-sm">Save</Submit>}
        </form>
      ))}</div>
      <h2 style={{ fontSize: "1.1rem" }}>AI run log</h2>
      {runs?.length ? <div className="table-wrap"><table className="t cards"><thead><tr><th>Time</th><th>Provider</th><th>Purpose</th><th>Result</th><th>Fallback / error</th></tr></thead><tbody>
        {runs.map((r) => <tr key={r.id}><td data-l="Time" className="small">{fmtDate(r.created_at, true)}</td><td data-l="Provider">{r.provider}{r.model ? ` / ${r.model}` : ""}</td><td data-l="Purpose" className="small">{r.purpose}</td><td data-l="Result"><Status s={r.status} /></td><td data-l="Detail" className="xs">{r.fallback_reason || r.error || "—"}</td></tr>)}
      </tbody></table></div> : <p className="small muted">No AI requests yet.</p>}
    </>
  );
}
