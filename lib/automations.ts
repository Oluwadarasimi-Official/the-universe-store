import "server-only";
import { adminDb } from "@/lib/supabase/clients";

type Result = { summary: string; details?: unknown };

const JOBS: Record<string, () => Promise<Result>> = {
  async missing_fields() {
    const db = adminDb();
    const { data: ps } = await db.from("products").select("id,title,short_description,full_description,affiliate_url,category_id,editorial_status,is_demo").neq("editorial_status", "archived").eq("is_demo", false).limit(2000);
    const { data: imgs } = await db.from("product_images").select("product_id");
    const withImg = new Set((imgs || []).map((i) => i.product_id));
    const issues = (ps || []).map((p) => ({ id: p.id, title: p.title, missing: [!withImg.has(p.id) && "image", !p.short_description && "short description", !p.full_description && "full description", !p.affiliate_url && "affiliate URL", !p.category_id && "category"].filter(Boolean) })).filter((x) => x.missing.length);
    return { summary: `${issues.length} product(s) with missing fields.`, details: issues.slice(0, 200) };
  },
  async stale_prices() {
    const db = adminDb();
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: stale } = await db.from("products").select("id,title,price_checked_at").not("displayed_price", "is", null).lt("price_checked_at", cutoff).eq("is_demo", false);
    const { data: links } = await db.from("affiliate_links").select("id,product_id,status,url").in("status", ["unverified", "broken"]);
    const { data: expiredDeals } = await db.from("products").select("id,title").eq("is_deal", true).lt("deal_expires_at", new Date().toISOString());
    return { summary: `${stale?.length ?? 0} stale price(s), ${links?.length ?? 0} link(s) unverified/broken, ${expiredDeals?.length ?? 0} expired deal flag(s).`, details: { stale, links, expiredDeals } };
  },
  async review_reminder() {
    const db = adminDb();
    const { count: pending } = await db.from("approval_items").select("id", { count: "exact", head: true }).eq("status", "pending");
    const old = new Date(Date.now() - 3 * 86400000).toISOString();
    const { count: oldDrafts } = await db.from("products").select("id", { count: "exact", head: true }).eq("editorial_status", "draft").lt("updated_at", old);
    return { summary: `${pending ?? 0} item(s) waiting for approval; ${oldDrafts ?? 0} product draft(s) untouched for 3+ days.` };
  },
  async weekly_summary() {
    const db = adminDb();
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: views } = await db.from("page_events").select("id", { count: "exact", head: true }).gte("occurred_at", since).eq("is_demo", false);
    const { count: pviews } = await db.from("page_events").select("id", { count: "exact", head: true }).gte("occurred_at", since).eq("event_type", "product_view").eq("is_demo", false);
    const { count: clicks } = await db.from("click_events").select("id", { count: "exact", head: true }).gte("occurred_at", since).eq("is_demo", false);
    const ctr = pviews ? ((clicks ?? 0) / pviews * 100).toFixed(1) + "%" : "n/a";
    return { summary: `Last 7 days: ${views ?? 0} page events, ${pviews ?? 0} product views, ${clicks ?? 0} outbound clicks (CTR ${ctr}). Purchases/commissions: not available in this dashboard.` };
  },
  async related_suggestions() {
    const db = adminDb();
    const { data: ps } = await db.from("products").select("id,title,category_id,tags").eq("editorial_status", "published").eq("is_demo", false).limit(500);
    const sugg = (ps || []).map((p) => ({ id: p.id, title: p.title, related: (ps || []).filter((o) => o.id !== p.id && (o.category_id === p.category_id || (o.tags || []).some((t: string) => (p.tags || []).includes(t)))).slice(0, 4).map((o) => o.title) })).filter((x) => x.related.length);
    return { summary: `Suggestions generated for ${sugg.length} product(s). Product pages already show same-category items automatically.`, details: sugg.slice(0, 100) };
  },
};

export async function runJob(key: string, triggeredBy: string | null) {
  const db = adminDb();
  const fn = JOBS[key];
  if (!fn) throw new Error("Unknown automation.");
  // idempotency guard: skip if the same job is already running (started < 10 min ago)
  const { data: running } = await db.from("automation_logs").select("id").eq("job_key", key).eq("status", "running").gte("started_at", new Date(Date.now() - 600000).toISOString()).limit(1);
  if (running?.length) return { status: "skipped", summary: "Already running." };
  const { data: log } = await db.from("automation_logs").insert({ job_key: key, status: "running", triggered_by: triggeredBy }).select("id").single();
  try {
    const r = await fn();
    await db.from("automation_logs").update({ status: "success", summary: r.summary, details: r.details ?? null, finished_at: new Date().toISOString() }).eq("id", log!.id);
    await db.from("automation_jobs").update({ last_run_at: new Date().toISOString(), last_status: "success" }).eq("key", key);
    return { status: "success", summary: r.summary };
  } catch (e: any) {
    await db.from("automation_logs").update({ status: "error", error: String(e?.message || e).slice(0, 500), finished_at: new Date().toISOString() }).eq("id", log!.id);
    await db.from("automation_jobs").update({ last_run_at: new Date().toISOString(), last_status: "error" }).eq("key", key);
    return { status: "error", summary: String(e?.message || e) };
  }
}
