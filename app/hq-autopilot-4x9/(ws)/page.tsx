import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Flash, Head } from "@/components/admin/ui";
import { fmtDate } from "@/lib/util";

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole();
  const sp = await searchParams;
  const db = adminDb();
  const c = async (t: string, f: (q: any) => any) => (await f(db.from(t).select("id", { count: "exact", head: true }))).count ?? 0;
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const [draft, pending, published, linksAwait, drafts, campaignsAwait, scheduled, clicks7, demo] = await Promise.all([
    c("products", (q) => q.eq("editorial_status", "draft")), c("products", (q) => q.eq("editorial_status", "pending")),
    c("products", (q) => q.eq("editorial_status", "published").eq("is_demo", false)), c("affiliate_links", (q) => q.eq("status", "unverified")),
    c("content_drafts", (q) => q.in("status", ["draft", "needs_review"])), c("social_posts", (q) => q.eq("status", "needs_review")),
    c("social_posts", (q) => q.in("status", ["approved", "ready"]).not("scheduled_for", "is", null)), c("click_events", (q) => q.gte("occurred_at", since7).eq("is_demo", false)),
    c("products", (q) => q.eq("is_demo", true)),
  ]);
  const { data: recentClicks } = await db.from("click_events").select("occurred_at,products(title,slug)").eq("is_demo", false).order("occurred_at", { ascending: false }).limit(8);
  const { data: views } = await db.from("page_events").select("product_id").eq("event_type", "product_view").eq("is_demo", false).gte("occurred_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(20000);
  const counts = new Map<string, number>(); (views || []).forEach((v) => v.product_id && counts.set(v.product_id, (counts.get(v.product_id) || 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: topP } = top.length ? await db.from("products").select("id,title").in("id", top.map((t) => t[0])) : { data: [] as any[] };
  const stats: [string, number, string][] = [
    ["Products in draft", draft, "/products?status=draft"], ["Pending approval", pending, "/approvals"], ["Published (real)", published, "/products?status=published"],
    ["Links awaiting verification", linksAwait, "/links"], ["Content drafts", drafts, "/content"], ["Social posts awaiting approval", campaignsAwait, "/approvals"],
    ["Scheduled posts (manual)", scheduled, "/calendar"], ["Outbound clicks (7 days)", clicks7, "/analytics"],
  ];
  return (
    <>
      <Head title="Overview" desc="Live counts from the database. Nothing here is estimated." />
      <Flash sp={sp} />
      {demo > 0 && <div className="notice notice-warn" style={{ marginBottom: 16 }}>{demo} demo product(s) are live on the store. Remove them before launch in <Link href={A("/settings#demo")}>Settings → Demo data</Link>.</div>}
      <div className="grid g4" style={{ marginBottom: 20 }}>
        {stats.map(([l, n, h]) => <Link key={l} href={A(h)} className="card stat" style={{ textDecoration: "none", color: "inherit" }}><b>{n}</b><span>{l}</span></Link>)}
      </div>
      <div className="split">
        <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Recent outbound clicks</h2>
          {recentClicks?.length ? <ul className="small" style={{ paddingLeft: 18 }}>{recentClicks.map((r: any, i) => <li key={i}>{r.products?.title || "(deleted product)"} — {fmtDate(r.occurred_at, true)}</li>)}</ul> : <p className="small muted">No outbound clicks recorded yet. Clicks appear once published products have verified retailer links.</p>}
        </section>
        <section className="card card-pad"><h2 style={{ fontSize: "1.05rem" }}>Top product pages (30 days)</h2>
          {top.length ? <ol className="small" style={{ paddingLeft: 18 }}>{top.map(([id, n]) => <li key={id}>{topP?.find((p: any) => p.id === id)?.title || id} — {n} views</li>)}</ol> : <p className="small muted">No product views recorded yet.</p>}
        </section>
      </div>
      <section className="card card-pad" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Launch checklist</h2>
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Get your Jumia affiliate (JForce) account approved, then paste the tracking links it issues into each product.</li>
          <li>Open each link, confirm it in your affiliate dashboard, then mark it “Verified by owner” in Affiliate Links.</li>
          <li>Add real products, submit for review, approve and publish.</li>
          <li>Set your public contact email and social links in Settings.</li>
          <li>Remove demo data.</li>
        </ul>
      </section>
    </>
  );
}
