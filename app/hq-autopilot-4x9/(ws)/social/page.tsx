import Link from "next/link";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { aiSocialPost, saveCampaign } from "../content-actions";
import PostForm from "./PostForm";
import { fmtDate } from "@/lib/util";

export default async function Social({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const db = adminDb();
  let q = db.from("social_posts").select("id,channel,post_type,caption,status,scheduled_for,created_at").order("created_at", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  const [{ data: posts }, { data: products }, { data: campaigns }] = await Promise.all([q, db.from("products").select("id,title").in("editorial_status", ["approved", "published"]).order("title"), db.from("campaigns").select("*").order("created_at", { ascending: false })]);
  const edit = canEdit(me.role);
  return (
    <>
      <Head title="Social campaigns" desc="Draft TikTok, Instagram and Facebook content. No platform is connected for direct publishing, so approved posts are copied/exported and posted by you, then marked “Published (confirmed)”." />
      <Flash sp={sp} />
      {edit && <div className="split" style={{ marginBottom: 16 }}>
        <details className="box"><summary>Prepare a post with AI</summary>
          <form action={aiSocialPost} style={{ marginTop: 12 }}>
            <div className="field"><label>Approved product</label><select name="product_id" className="select" required>{(products || []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            <div className="form-grid"><div className="field"><label>Channel</label><select name="channel" className="select"><option value="tiktok">TikTok</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></div>
            <div className="field"><label>Type</label><select name="post_type" className="select"><option value="caption">Caption</option><option value="video_script">Video script</option><option value="carousel">Carousel</option></select></div></div>
            <Submit>Prepare draft</Submit>
          </form></details>
        <details className="box"><summary>Write a post manually</summary><div style={{ marginTop: 12 }}><PostForm products={products || []} campaigns={campaigns || []} /></div></details>
      </div>}
      <div className="chips" style={{ marginBottom: 12 }}>{["", "draft", "needs_review", "approved", "ready", "published", "failed", "cancelled"].map((s) => <Link key={s} className={`chip ${(sp.status || "") === s ? "on" : ""}`} href={A(`/social${s ? `?status=${s}` : ""}`)}>{s || "all"}</Link>)}</div>
      {posts?.length ? <div className="table-wrap"><table className="t cards"><thead><tr><th>Post</th><th>Channel</th><th>Status</th><th>Planned</th></tr></thead><tbody>
        {posts.map((p) => <tr key={p.id}><td data-l="Post"><Link href={A(`/social/${p.id}`)}>{p.caption.slice(0, 80) || "(empty)"}{p.caption.length > 80 ? "…" : ""}</Link></td><td data-l="Channel">{p.channel} · {p.post_type.replace("_", " ")}</td><td data-l="Status"><Status s={p.status} social /></td><td data-l="Planned" className="small">{p.scheduled_for ? fmtDate(p.scheduled_for, true) : "—"}</td></tr>)}
      </tbody></table></div> : <Empty icon="📣" title="No social posts yet" />}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: "1.1rem" }}>Campaigns</h2>
        {edit && <details className="box" style={{ marginBottom: 12 }}><summary>New campaign</summary>
          <form action={saveCampaign} className="form-grid" style={{ marginTop: 12 }}>
            <div className="field"><label>Name *</label><input name="name" className="input" required /></div>
            <div className="field"><label>UTM campaign tag</label><input name="utm_campaign" className="input" placeholder="auto from name" /></div>
            <div className="field span2"><label>Concept</label><textarea name="concept" className="textarea" style={{ minHeight: 60 }} /></div>
            <div className="field"><label>Start</label><input name="start_date" type="date" className="input" /></div><div className="field"><label>End</label><input name="end_date" type="date" className="input" /></div>
            <div className="span2"><Submit>Save campaign</Submit></div>
          </form></details>}
        {campaigns?.length ? <div className="grid g3">{campaigns.map((c) => <div key={c.id} className="card card-pad"><b>{c.name}</b> <Status s={c.status} /><p className="xs muted">utm_campaign={c.utm_campaign} · {c.start_date || "?"} → {c.end_date || "?"}</p>{c.concept && <p className="small">{c.concept}</p>}</div>)}</div> : <p className="small muted">No campaigns yet.</p>}
      </section>
    </>
  );
}
