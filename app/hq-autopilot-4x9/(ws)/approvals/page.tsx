import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { decideApproval } from "../content-actions";
import { fmtDate } from "@/lib/util";

const HREF: Record<string, string> = { product: "/products/", guide: "/guides/", content_draft: "/content/", social_post: "/social/" };
const SHOW: Record<string, string[]> = {
  product: ["title", "short_description", "full_description", "brand", "retailer_name", "displayed_price", "currency", "price_checked_at", "availability_status", "specifications", "tags", "source_notes"],
  guide: ["title", "excerpt", "selection_criteria", "body", "limitations"],
  content_draft: ["format", "tone", "title", "body", "source_facts", "needs_verification", "missing_facts", "ai_provider", "ai_model", "fallback_reason"],
  social_post: ["channel", "post_type", "caption", "script", "hashtags", "link_url", "disclosure", "scheduled_for", "ai_provider"],
};

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const db = adminDb();
  const status = sp.status || "pending";
  const { data: items } = await db.from("approval_items").select("*").eq("status", status).order("submitted_at", { ascending: status !== "pending" }).limit(100);
  const current: Record<string, any> = {};
  for (const [t, table] of [["product", "products"], ["guide", "guides"], ["content_draft", "content_drafts"], ["social_post", "social_posts"]] as const) {
    const ids = (items || []).filter((i) => i.entity_type === t).map((i) => i.entity_id);
    if (ids.length) { const { data } = await db.from(table).select("*").in("id", ids); (data || []).forEach((r) => (current[r.id] = r)); }
  }
  const owner = me.role === "owner";
  const fmt = (v: any) => v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v, null, 1) : String(v);
  return (
    <>
      <Head title="Approval queue" desc="Side-by-side: what was submitted (source facts) and the current content. Approving is a deliberate action; rejection sends the item back to drafts with your note." />
      <Flash sp={sp} />
      <div className="chips" style={{ marginBottom: 12 }}>{["pending", "approved", "changes_requested", "rejected"].map((s) => <Link key={s} className={`chip ${status === s ? "on" : ""}`} href={A(`/approvals?status=${s}`)}>{s.replace("_", " ")}</Link>)}</div>
      {!owner && status === "pending" && <div className="notice" style={{ marginBottom: 12 }}>Only the Owner can approve or reject. You can view the queue.</div>}
      {items?.length ? <div className="stack">{items.map((it) => {
        const cur = current[it.entity_id]; const snap = it.snapshot || {};
        return (
          <article key={it.id} className="card card-pad">
            <div className="row between"><div><span className="badge badge-gray">{it.entity_type.replace("_", " ")}</span> <Link href={A(`${HREF[it.entity_type]}${it.entity_id}`)}><b>{it.title}</b></Link></div><Status s={it.status} /></div>
            <p className="xs muted">Submitted {fmtDate(it.submitted_at, true)}{it.decided_at ? ` · decided ${fmtDate(it.decided_at, true)}` : ""}{it.reviewer_notes ? ` · note: “${it.reviewer_notes}”` : ""}</p>
            {!cur ? <p className="small muted">The item no longer exists.</p> : (
              <div className="table-wrap"><table className="t"><thead><tr><th>Field</th><th>As submitted</th><th>Current</th></tr></thead><tbody>
                {SHOW[it.entity_type].map((f) => <tr key={f}><td className="small">{f}</td><td><pre className="out" style={{ margin: 0, maxHeight: 160 }}>{fmt(snap[f])}</pre></td><td><pre className="out" style={{ margin: 0, maxHeight: 160, borderColor: fmt(snap[f]) !== fmt(cur[f]) ? "var(--lime)" : undefined }}>{fmt(cur[f])}</pre></td></tr>)}
              </tbody></table></div>
            )}
            {owner && it.status === "pending" && cur && (
              <form action={decideApproval} className="stack" style={{ marginTop: 12 }}>
                <input type="hidden" name="entity_type" value={it.entity_type} /><input type="hidden" name="id" value={it.entity_id} /><input type="hidden" name="back" value="/approvals" />
                <textarea name="note" className="textarea" style={{ minHeight: 60 }} placeholder="Reviewer notes (saved to the audit trail)" />
                {it.entity_type === "social_post" && <label className="check xs"><input type="checkbox" name="confirm" /> I reviewed the exact text, link, disclosure and time (required to approve)</label>}
                <div className="row">
                  {(it.entity_type === "product" || it.entity_type === "guide") && <Submit name="to" value="approve_publish" className="btn btn-primary btn-sm" confirm="Approve and publish publicly?">Approve & publish</Submit>}
                  <Submit name="to" value="approve" className={it.entity_type === "product" || it.entity_type === "guide" ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"}>Approve</Submit>
                  <Submit name="to" value="request_changes" className="btn btn-outline btn-sm">Request changes</Submit>
                  <Submit name="to" value="reject" className="btn btn-danger btn-sm" confirm="Reject? The item returns to drafts.">Reject</Submit>
                </div>
              </form>
            )}
          </article>
        );
      })}</div> : <Empty icon="✅" title={status === "pending" ? "Nothing waiting for approval" : "Nothing here"} />}
    </>
  );
}
