import Link from "next/link";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { generateDraft } from "../content-actions";
import { FORMATS, TONES } from "@/lib/ai/prompts";
import { PROVIDERS } from "@/lib/ai/providers";
import { fmtDate } from "@/lib/util";

export default async function ContentStudio({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const db = adminDb();
  const [{ data: drafts }, { data: products }] = await Promise.all([
    db.from("content_drafts").select("id,format,tone,title,status,ai_provider,ai_model,fallback_reason,created_at,product_ids").neq("status", "archived").order("created_at", { ascending: false }).limit(100),
    db.from("products").select("id,title,editorial_status,is_demo").in("editorial_status", ["approved", "published"]).order("title").limit(300),
  ]);
  return (
    <>
      <Head title="Content Studio" desc="Generate drafts from approved product data. Every draft lists the source facts used, what needs human verification and what is missing. Nothing here is published automatically." />
      <Flash sp={sp} />
      {canEdit(me.role) && (
        <form action={generateDraft} className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field"><label htmlFor="format">Format</label><select id="format" name="format" className="select">{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{k.replace(/_/g, " ")} — {v.slice(0, 50)}</option>)}</select></div>
            <div className="field"><label htmlFor="tone">Tone</label><select id="tone" name="tone" className="select">{TONES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field span2"><label htmlFor="pids">Products (approved/published only)</label>
              <select id="pids" name="product_ids" multiple className="select" style={{ minHeight: 140 }}>{(products || []).map((p) => <option key={p.id} value={p.id}>{p.is_demo ? "[Demo] " : ""}{p.title}</option>)}</select>
              <span className="hint">Hold Ctrl/⌘ (or long-press on mobile) to select several. {products?.length ? "" : "No approved products yet — approve products first."}</span></div>
            <div className="field span2"><label htmlFor="notes">Notes for the AI (optional)</label><input id="notes" name="notes" className="input" maxLength={500} placeholder="e.g. focus on students in Nigeria; keep it under 100 words" /></div>
            <div className="field"><label htmlFor="provider">Provider</label><select id="provider" name="provider" className="select"><option value="">Auto (priority + fallback)</option>{PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name} only</option>)}</select></div>
          </div>
          <Submit>Generate draft</Submit>
          <p className="xs muted" style={{ marginTop: 8 }}>The AI is instructed to use only the facts supplied, label assumptions and avoid hype, fake urgency, testimonials and medical/financial/safety claims.</p>
        </form>
      )}
      {drafts?.length ? <div className="table-wrap"><table className="t cards"><thead><tr><th>Draft</th><th>Format</th><th>Status</th><th>Provider</th><th>Created</th></tr></thead><tbody>
        {drafts.map((d) => <tr key={d.id}><td data-l="Draft"><Link href={A(`/content/${d.id}`)}>{d.title || "(untitled)"}</Link></td><td data-l="Format">{d.format.replace(/_/g, " ")} · {d.tone}</td><td data-l="Status"><Status s={d.status} /></td><td data-l="Provider" className="small">{d.ai_provider ? `${d.ai_provider} / ${d.ai_model}` : "manual"}{d.fallback_reason ? " (fallback)" : ""}</td><td data-l="Created" className="small">{fmtDate(d.created_at, true)}</td></tr>)}
      </tbody></table></div> : <Empty icon="✍️" title="No drafts yet" />}
    </>
  );
}
