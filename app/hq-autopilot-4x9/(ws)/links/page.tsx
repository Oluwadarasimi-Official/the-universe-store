import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { Submit, LinkFormatTester } from "@/components/admin/client";
import { linkAction } from "../catalog-actions";
import { fmtDate, hostOf, ALIEXPRESS_TRACKING_ID_DEFAULT } from "@/lib/util";

export default async function Links({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  let q = adminDb().from("affiliate_links").select("*, products!inner(id,title,slug,editorial_status)").order("updated_at", { ascending: false }).limit(300);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) q = q.ilike("products.title", `%${sp.q.replace(/[%,]/g, "")}%`);
  const { data: links } = await q;
  const { data: aliRow } = await adminDb().from("site_settings").select("value").eq("key", "aliexpress_tracking_id").maybeSingle();
  const aliTrackingId = typeof aliRow?.value === "string" && aliRow.value ? aliRow.value : ALIEXPRESS_TRACKING_ID_DEFAULT;
  const { data: clicks } = await adminDb().from("click_events").select("link_id").eq("is_demo", false).limit(50000);
  const cc = new Map<string, number>(); (clicks || []).forEach((c) => c.link_id && cc.set(c.link_id, (cc.get(c.link_id) || 0) + 1));
  const owner = me.role === "owner";
  return (
    <>
      <Head title="Affiliate links" desc="Paste only links issued by your affiliate programme. A link is shown on the store only after you mark it “Verified by owner”. URL format checks never count as verification." />
      <Flash sp={sp} />
      <div className="card card-pad" style={{ marginBottom: 16 }}><LinkFormatTester trackingId={aliTrackingId} /></div>
      <form className="row" style={{ marginBottom: 12 }}>
        <input className="input" name="q" defaultValue={sp.q} placeholder="Product title…" style={{ maxWidth: 240 }} />
        <select className="select" name="status" defaultValue={sp.status || ""} style={{ maxWidth: 220 }}><option value="">All</option><option value="unverified">Awaiting verification</option><option value="verified">Verified</option><option value="broken">Reported broken</option><option value="disabled">Disabled</option></select>
        <button className="btn btn-outline">Filter</button>
      </form>
      {links?.length ? <div className="stack">{links.map((l: any) => (
        <div key={l.id} className="card card-pad">
          <div className="row between"><div><Link href={A(`/products/${l.products.id}`)}><b>{l.products.title}</b></Link> <Status s={l.products.editorial_status} /></div><Status s={l.status} /></div>
          <p className="small" style={{ wordBreak: "break-all", margin: "8px 0" }}><span className="muted">{l.label} · {hostOf(l.url)} ·</span> <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.url}</a></p>
          <p className="xs muted">{l.verified_at ? `Verified ${fmtDate(l.verified_at, true)}` : "Never verified"} · {cc.get(l.id) || 0} outbound click(s) · updated {fmtDate(l.updated_at, true)}</p>
          <div className="row">
            {owner && l.status !== "verified" && (
              <form action={linkAction} className="row"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="to" value="verify" />
                <label className="check xs"><input type="checkbox" name="confirm" required /> I opened this link and confirmed it is my issued affiliate link</label>
                <Submit className="btn btn-primary btn-sm">Mark verified</Submit></form>
            )}
            {owner && l.status === "verified" && <form action={linkAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="to" value="unverify" /><Submit className="btn btn-outline btn-sm">Unverify</Submit></form>}
            {me.role !== "analyst" && l.status !== "disabled" && <form action={linkAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="to" value="disable" /><Submit className="btn btn-outline btn-sm" confirm="Disable this link? The retailer button will be hidden.">Disable</Submit></form>}
            {me.role !== "analyst" && <form action={linkAction}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="to" value="broken" /><Submit className="btn btn-outline btn-sm">Mark broken</Submit></form>}
          </div>
          {me.role !== "analyst" && <details style={{ marginTop: 8 }}><summary className="small">Label / replace URL</summary>
            <form action={linkAction} className="row" style={{ marginTop: 8 }}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="to" value="label" /><input className="input" name="label" defaultValue={l.label} style={{ maxWidth: 160 }} /><input className="input" name="notes" defaultValue={l.notes || ""} placeholder="Notes" style={{ maxWidth: 260 }} /><Submit className="btn btn-outline btn-sm">Save label</Submit></form>
            {owner && <form action={linkAction} className="row" style={{ marginTop: 8 }}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="to" value="replace" /><input className="input" name="url" type="url" placeholder="New issued tracking URL" style={{ maxWidth: 420 }} required /><Submit className="btn btn-outline btn-sm" confirm="Replace the URL? It will need verifying again.">Replace</Submit></form>}
          </details>}
        </div>
      ))}</div> : <Empty icon="🔗" title="No affiliate links yet"><p className="small muted">Add a tracking URL on a product&apos;s edit page once your affiliate account is approved.</p></Empty>}
    </>
  );
}
