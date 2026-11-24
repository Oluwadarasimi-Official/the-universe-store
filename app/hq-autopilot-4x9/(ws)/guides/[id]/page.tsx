import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { saveGuide, guideTransition } from "../../catalog-actions";

export default async function GuideEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = adminDb();
  const { data: g } = await db.from("guides").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();
  const { data: products } = await db.from("products").select("id,title,editorial_status").in("editorial_status", ["approved", "published"]).order("title");
  const owner = me.role === "owner", edit = canEdit(me.role) && (g.status !== "published" || owner);
  const T = ({ to, label, cls = "btn btn-outline btn-sm", confirm, note }: { to: string; label: string; cls?: string; confirm?: string; note?: boolean }) => (
    <form action={guideTransition} className="row"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />{note && <input className="input" name="note" placeholder="Note" style={{ maxWidth: 200, minHeight: 36 }} />}<Submit className={cls} confirm={confirm}>{label}</Submit></form>
  );
  const s = g.status;
  return (
    <>
      <Head title={g.title} desc={`/guides/${g.slug}`}><Status s={s} />{s === "published" && <Link className="btn btn-outline btn-sm" href={`/guides/${g.slug}`} target="_blank">View live ↗</Link>}</Head>
      <Flash sp={sp} />
      <div className="row" style={{ marginBottom: 16 }}>
        {canEdit(me.role) && ["draft", "rejected"].includes(s) && <T to="submit" label="Submit for review" cls="btn btn-primary btn-sm" />}
        {owner && s === "pending" && <><T to="approve_publish" label="Approve & publish" cls="btn btn-primary btn-sm" confirm="Publish this guide?" /><T to="approve" label="Approve only" /><T to="request_changes" label="Request changes" note /><T to="reject" label="Reject" cls="btn btn-danger btn-sm" note /></>}
        {owner && s === "approved" && <T to="publish" label="Publish" cls="btn btn-primary btn-sm" />}
        {owner && s === "published" && <T to="unpublish" label="Unpublish" />}
        {canEdit(me.role) && s !== "archived" && s !== "published" && <T to="archive" label="Archive" />}
        {canEdit(me.role) && s === "archived" && <T to="restore" label="Restore" />}
        {owner && ["draft", "rejected", "archived"].includes(s) && <T to="delete" label="Delete" cls="btn btn-danger btn-sm" confirm="Delete this guide permanently?" />}
      </div>
      <form action={saveGuide} className="card card-pad">
        <input type="hidden" name="id" value={id} />
        <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="field"><label>Title</label><input name="title" className="input" defaultValue={g.title} required /></div>
            <div className="field"><label>Slug</label><input name="slug" className="input" defaultValue={g.slug} /></div>
            <div className="field"><label>Type</label><select name="kind" className="select" defaultValue={g.kind}><option value="guide">Buying guide</option><option value="collection">Collection</option></select></div>
            <div className="field span2"><label>Excerpt</label><textarea name="excerpt" className="textarea" style={{ minHeight: 60 }} defaultValue={g.excerpt || ""} /></div>
            <div className="field span2"><label>Selection criteria *</label><textarea name="selection_criteria" className="textarea" style={{ minHeight: 70 }} defaultValue={g.selection_criteria || ""} /><span className="hint">Explain how items were chosen.</span></div>
            <div className="field span2"><label>Body</label><textarea name="body" className="textarea" style={{ minHeight: 300 }} defaultValue={g.body || ""} /><span className="hint">Use “## Heading”, blank lines between paragraphs, and “- ” for bullet lists.</span></div>
            <div className="field span2"><label>Limitations / disclosures</label><textarea name="limitations" className="textarea" style={{ minHeight: 60 }} defaultValue={g.limitations || ""} /></div>
            <div className="field span2"><label>Products</label><select name="product_ids" multiple className="select" style={{ minHeight: 140 }} defaultValue={g.product_ids}>{(products || []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            <label className="check span2"><input type="checkbox" name="evidence" /> I have evidence for any hands-on testing claims</label>
          </div>
          {edit && <Submit>Save</Submit>}
        </fieldset>
      </form>
    </>
  );
}
