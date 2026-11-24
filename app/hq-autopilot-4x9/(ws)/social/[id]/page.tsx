import { notFound } from "next/navigation";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Flash, Head, Status } from "@/components/admin/ui";
import { Submit, CopyButton, DownloadButton } from "@/components/admin/client";
import { socialTransition } from "../../content-actions";
import PostForm from "../PostForm";
import { fmtDate } from "@/lib/util";

export default async function SocialPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = adminDb();
  const { data: s } = await db.from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: products }, { data: campaigns }, { data: acct }] = await Promise.all([db.from("products").select("id,title").in("editorial_status", ["approved", "published"]).order("title"), db.from("campaigns").select("id,name"), db.from("social_accounts").select("*").eq("channel", s.channel).maybeSingle()]);
  const finalText = [s.caption, s.script && `\n${s.script}`, s.disclosure && `\n${s.disclosure}`, s.link_url && `\n${s.link_url}`, s.hashtags && `\n${s.hashtags}`].filter(Boolean).join("\n");
  const owner = me.role === "owner", edit = canEdit(me.role);
  const T = ({ to, label, cls = "btn btn-outline btn-sm", confirm, children }: { to: string; label: string; cls?: string; confirm?: string; children?: React.ReactNode }) => (
    <form action={socialTransition} className="row"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />{children}<Submit className={cls} confirm={confirm}>{label}</Submit></form>
  );
  return (
    <>
      <Head title={`${s.channel[0].toUpperCase() + s.channel.slice(1)} ${s.post_type.replace("_", " ")}`} desc={`Created ${fmtDate(s.created_at, true)}${s.ai_provider ? ` · AI: ${s.ai_provider}` : ""}`}><Status s={s.status} social /></Head>
      <Flash sp={sp} />
      <div className="split">
        <section className="card card-pad stack">
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Approval view — exactly what will be posted</h2>
          <dl className="kv"><dt>Destination</dt><dd>{s.channel} {acct?.handle ? `· @${acct.handle.replace(/^@/, "")}` : "· (account handle not set in Integrations)"}</dd><dt>Planned time</dt><dd>{s.scheduled_for ? fmtDate(s.scheduled_for, true) : "Not set"}</dd><dt>Link</dt><dd style={{ wordBreak: "break-all" }}>{s.link_url || "None"}</dd><dt>Disclosure</dt><dd>{s.disclosure || <span style={{ color: "var(--danger)" }}>None</span>}</dd><dt>Published</dt><dd>{s.published_confirmed_at ? `Confirmed ${fmtDate(s.published_confirmed_at, true)}${s.published_url ? ` · ${s.published_url}` : ""}` : "Not confirmed"}</dd></dl>
          <pre className="out">{finalText}</pre>
          {s.media_notes && <p className="small"><b>Media notes:</b> {s.media_notes}</p>}
          <div className="row"><CopyButton text={s.caption + (s.disclosure ? `\n\n${s.disclosure}` : "") + (s.hashtags ? `\n\n${s.hashtags}` : "")} label="Copy caption + disclosure" />{s.link_url && <CopyButton text={s.link_url} label="Copy link" />}<DownloadButton text={finalText} filename={`${s.channel}-post-${id.slice(0, 8)}.txt`} label="Export .txt" /></div>
          <div className="notice small">Direct publishing is not connected. After approval, post it yourself on {s.channel}, then mark it “Published (confirmed)”.</div>
          <div className="row">
            {edit && s.status === "draft" && <T to="submit" label="Submit for review" cls="btn btn-primary btn-sm" />}
            {owner && s.status === "needs_review" && <T to="approve" label="Approve" cls="btn btn-primary btn-sm"><label className="check xs"><input type="checkbox" name="confirm" required /> I reviewed the exact text, link, disclosure and time</label></T>}
            {owner && s.status === "needs_review" && <T to="request_changes" label="Request changes"><input className="input" name="note" placeholder="Note" style={{ maxWidth: 180, minHeight: 36 }} /></T>}
            {owner && s.status === "needs_review" && <T to="reject" label="Reject" cls="btn btn-danger btn-sm" />}
            {owner && s.status === "approved" && <T to="ready" label="Mark Ready to Publish" />}
            {owner && ["approved", "ready"].includes(s.status) && <T to="published" label="Mark Published (confirmed)" cls="btn btn-primary btn-sm"><input className="input" name="published_url" type="url" placeholder="Post URL (optional)" style={{ maxWidth: 220, minHeight: 36 }} /><label className="check xs"><input type="checkbox" name="confirm" required /> I posted it myself</label></T>}
            {owner && ["approved", "ready"].includes(s.status) && <T to="failed" label="Mark failed" />}
            {edit && !["published", "cancelled"].includes(s.status) && <T to="cancel" label="Cancel" confirm="Cancel this post?" />}
            {edit && ["failed", "cancelled"].includes(s.status) && <T to="reopen" label="Reopen as draft" />}
            {edit && ["draft", "cancelled", "failed"].includes(s.status) && <T to="delete" label="Delete" cls="btn btn-danger btn-sm" confirm="Delete this post?" />}
          </div>
        </section>
        <div><PostForm s={s} products={products || []} campaigns={campaigns || []} disabled={!edit || ["published", "cancelled"].includes(s.status)} /><p className="xs muted" style={{ marginTop: 8 }}>Editing an approved post sends it back to Draft for re-approval.</p></div>
      </div>
    </>
  );
}
