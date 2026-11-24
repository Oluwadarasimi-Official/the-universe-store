import Link from "next/link";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { addResearch, researchAction } from "../content-actions";
import { fmtDate } from "@/lib/util";

const L = ({ items }: { items?: string[] }) => items?.length ? <ul className="small" style={{ paddingLeft: 18, margin: "4px 0" }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="small muted" style={{ margin: "4px 0" }}>None</p>;

export default async function Research({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const status = sp.status || "open";
  let q = adminDb().from("research_items").select("*").order("created_at", { ascending: false }).limit(100);
  q = status === "open" ? q.in("status", ["new", "processed"]) : q.eq("status", status);
  const { data: items } = await q;
  const edit = canEdit(me.role);
  return (
    <>
      <Head title="Product research inbox" desc="Paste product URLs, notes, image URLs or CSV rows. AI can summarise what you pasted — it does not visit retailer pages and separates sourced facts from suggestions." />
      <Flash sp={sp} />
      {edit && <details className="box" open={!items?.length} style={{ marginBottom: 16 }}><summary>Add to inbox</summary>
        <form action={addResearch} style={{ marginTop: 12 }}>
          <div className="field"><label htmlFor="kind">Type</label><select id="kind" name="kind" className="select"><option value="url">Product URL + notes</option><option value="note">Notes</option><option value="image">Image URL + notes</option><option value="csv">CSV rows (with header)</option></select></div>
          <div className="field"><label htmlFor="raw">Content *</label><textarea id="raw" name="raw_input" className="textarea" required placeholder={"Paste a product URL followed by what you know about it, e.g. name, brand, key features copied from the listing.\nFor CSV: title,brand,category,short_description,url"} /></div>
          <div className="form-grid"><div className="field"><label htmlFor="su">Source URL (optional)</label><input id="su" name="source_url" type="url" className="input" /></div><div className="field"><label htmlFor="iu">Image URL (optional, must be permitted)</label><input id="iu" name="image_url" type="url" className="input" /></div></div>
          <Submit>Add</Submit>
        </form></details>}
      <div className="chips" style={{ marginBottom: 12 }}>{["open", "converted", "dismissed"].map((s) => <Link key={s} className={`chip ${status === s ? "on" : ""}`} href={A(`/research?status=${s}`)}>{s}</Link>)}</div>
      {items?.length ? <div className="stack">{items.map((r) => {
        const ai = r.ai_result || null;
        return (
          <div key={r.id} className="card card-pad">
            <div className="row between"><span className="small"><span className="badge badge-gray">{r.kind}</span> added {fmtDate(r.created_at, true)}</span><Status s={r.status} /></div>
            <pre className="out" style={{ marginTop: 8, maxHeight: 160 }}>{r.raw_input}</pre>
            {r.source_url && <p className="xs" style={{ wordBreak: "break-all" }}>Source: {r.source_url} <span className="muted">(not visited)</span></p>}
            {ai && (ai.blocked ? <div className="notice notice-err small">{ai.blocked_reason}</div> : (
              <div className="split" style={{ marginTop: 8 }}>
                <div><b className="small">Summary</b><p className="small">{ai.summary}</p><b className="small">Sourced facts (from your paste)</b><L items={ai.sourced_facts} /></div>
                <div><b className="small">Suggestions (not facts)</b><L items={[ai.suggested_title && `Title: ${ai.suggested_title}`, ai.suggested_category && `Category: ${ai.suggested_category}`, ai.guide_angle && `Guide angle: ${ai.guide_angle}`, ...(ai.suggestions || [])].filter(Boolean)} />
                  <b className="small">Missing fields</b><L items={ai.missing_fields} /><p className="xs muted">By {ai.provider}/{ai.model}{ai.fallback ? ` · fallback: ${ai.fallback}` : ""}. {ai.note}</p></div>
              </div>
            ))}
            {r.product_id && <p className="small"><Link href={A(`/products/${r.product_id}`)}>Open created draft →</Link></p>}
            {edit && r.status !== "converted" && <div className="row" style={{ marginTop: 8 }}>
              {["analyze", "convert", "dismiss", "delete"].map((to) => <form key={to} action={researchAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value={to} /><Submit className={to === "convert" ? "btn btn-primary btn-sm" : to === "delete" ? "btn btn-danger btn-sm" : "btn btn-outline btn-sm"} confirm={to === "delete" ? "Delete this item?" : undefined}>{to === "analyze" ? (ai ? "Re-analyze with AI" : "Analyze with AI") : to === "convert" ? "Create product draft" : to[0].toUpperCase() + to.slice(1)}</Submit></form>)}
            </div>}
          </div>
        );
      })}</div> : <Empty icon="📥" title="Inbox is empty" />}
    </>
  );
}
