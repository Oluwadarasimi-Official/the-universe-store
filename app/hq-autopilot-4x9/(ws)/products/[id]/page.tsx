import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import ProductForm from "../ProductForm";
import ProductCard from "@/components/ProductCard";
import { productTransition } from "../../catalog-actions";
import { fmtDate, formatPrice } from "@/lib/util";
import { screenProduct } from "@/lib/safety";

function T({ id, to, label, cls = "btn btn-outline btn-sm", confirm, note }: { id: string; to: string; label: string; cls?: string; confirm?: string; note?: boolean }) {
  return (
    <form action={productTransition} className="row" style={{ display: "inline-flex" }}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />
      {note && <input className="input" name="note" placeholder="Reviewer note" style={{ maxWidth: 220, minHeight: 36 }} />}
      <Submit className={cls} confirm={confirm}>{label}</Submit>
    </form>
  );
}

export default async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole();
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = adminDb();
  const { data: p } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: cats }, { data: images }, { data: link }, { data: log }, { data: approvals }] = await Promise.all([
    db.from("categories").select("id,name,slug").order("sort_order"),
    db.from("product_images").select("url,alt_text").eq("product_id", id).order("sort_order"),
    db.from("affiliate_links").select("id,url,status,verified_at").eq("product_id", id).eq("is_primary", true).maybeSingle(),
    db.from("audit_logs").select("action,actor_email,created_at,details").eq("entity_id", id).order("created_at", { ascending: false }).limit(30),
    db.from("approval_items").select("status,reviewer_notes,decided_at,submitted_at").eq("entity_type", "product").eq("entity_id", id).order("submitted_at", { ascending: false }).limit(5),
  ]);
  const owner = me.role === "owner"; const edit = canEdit(me.role);
  const s = p.editorial_status;
  const screen = screenProduct(`${p.title} ${p.short_description || ""} ${p.full_description || ""}`);
  const warnings = [
    !p.category_id && "No category.", !p.short_description && "No short description.", !(images || []).length && "No image (a neutral placeholder will show).",
    !link && "No affiliate URL — the store will show “Retailer link coming soon”.", link && link.status !== "verified" && "Affiliate link is not verified by owner — no retailer button will show until verified.",
    p.displayed_price != null && !p.price_checked_at && "Price has no last-checked date.", screen.flagged && "Safety screen flagged this item for review.", p.review_note && `Review note: ${p.review_note}`,
  ].filter(Boolean) as string[];
  const cat = cats?.find((c) => c.id === p.category_id);
  return (
    <>
      <Head title={p.title} desc={`/p/${p.slug}`}>
        <Status s={s} /> {p.is_demo && <span className="badge badge-demo">Demo</span>}
        {s === "published" && <Link className="btn btn-outline btn-sm" href={`/p/${p.slug}`} target="_blank">View live ↗</Link>}
      </Head>
      <Flash sp={sp} />
      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1rem" }}>Workflow</h2>
        <p className="small muted">draft → pending review → approved → published. Rejection returns it to drafts with a note. Only the Owner approves and publishes.</p>
        <div className="row">
          {edit && ["draft", "rejected"].includes(s) && <T id={id} to="submit" label="Submit for review" cls="btn btn-primary btn-sm" />}
          {owner && s === "pending" && <><T id={id} to="approve_publish" label="Approve & publish" cls="btn btn-primary btn-sm" /><T id={id} to="approve" label="Approve only" /><T id={id} to="request_changes" label="Request changes" note /><T id={id} to="reject" label="Reject" cls="btn btn-danger btn-sm" note /></>}
          {owner && s === "approved" && <T id={id} to="publish" label="Publish" cls="btn btn-primary btn-sm" />}
          {owner && s === "published" && <T id={id} to="unpublish" label="Unpublish" confirm="Remove from the public store?" />}
          {owner && s === "published" && <T id={id} to={p.featured_flag ? "unfeature" : "feature"} label={p.featured_flag ? "Remove from featured" : "Feature on home"} />}
          {edit && s !== "archived" && (owner || s !== "published") && <T id={id} to="archive" label="Archive" confirm="Archive this product? It will be hidden from the store." />}
          {edit && s === "archived" && <T id={id} to="restore" label="Restore to draft" />}
          {owner && ["draft", "rejected", "archived"].includes(s) && <T id={id} to="delete" label="Delete permanently" cls="btn btn-danger btn-sm" confirm="Permanently delete this product? This cannot be undone." />}
        </div>
        {warnings.length > 0 && <ul className="small" style={{ margin: "12px 0 0", paddingLeft: 18, color: "#5c4100" }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      </section>
      <div className="split">
        <div>
          {s === "published" && !owner && <div className="notice" style={{ marginBottom: 12 }}>Published products can only be edited by the Owner.</div>}
          <ProductForm p={p} cats={cats || []} images={images || []} link={link?.url} readOnly={!edit || (s === "published" && !owner)} />
        </div>
        <div className="stack">
          <section className="card card-pad"><h2 style={{ fontSize: "1rem" }}>Preview</h2>
            <div style={{ maxWidth: 240 }}><ProductCard p={{ ...p, images: images || [] }} catSlug={cat?.slug} /></div>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Price</dt><dd>{formatPrice(p.displayed_price, p.currency) ? `${formatPrice(p.displayed_price, p.currency)} (checked ${fmtDate(p.price_checked_at)})` : "Not provided"}</dd>
              <dt>Retailer button</dt><dd>{link?.status === "verified" ? `Shown → ${link.url.slice(0, 50)}…` : "Hidden (link missing or unverified)"}</dd>
              <dt>Specifications</dt><dd>{(p.specifications || []).length || "Not provided"}</dd>
            </dl>
            {link && <p className="small" style={{ marginTop: 8 }}><Link href={A(`/links?q=${encodeURIComponent(p.title)}`)}>Manage this link →</Link></p>}
          </section>
          <section className="card card-pad"><h2 style={{ fontSize: "1rem" }}>Review history</h2>
            {approvals?.length ? <ul className="small" style={{ paddingLeft: 18 }}>{approvals.map((a, i) => <li key={i}><Status s={a.status} /> submitted {fmtDate(a.submitted_at, true)}{a.reviewer_notes ? ` — “${a.reviewer_notes}”` : ""}</li>)}</ul> : <p className="small muted">Not submitted yet.</p>}
          </section>
          <section className="card card-pad"><h2 style={{ fontSize: "1rem" }}>Audit trail</h2>
            {log?.length ? <ul className="small" style={{ paddingLeft: 18 }}>{log.map((l, i) => <li key={i}><b>{l.action}</b> by {l.actor_email || "system"} · {fmtDate(l.created_at, true)}</li>)}</ul> : <p className="small muted">No changes recorded.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
