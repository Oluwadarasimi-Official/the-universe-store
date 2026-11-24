import "server-only";
import { adminDb } from "@/lib/supabase/clients";

export type Range = { from: string; to: string };

export function parseRange(sp: Record<string, string | undefined>): Range {
  const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  const days = Number(sp.days) || 30;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : today;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : new Date(new Date(`${to}T00:00:00Z`).getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

async function fetchAll(table: string, cols: string, r: Range) {
  const db = adminDb();
  const fromIso = new Date(`${r.from}T00:00:00+01:00`).toISOString(), toIso = new Date(new Date(`${r.to}T00:00:00+01:00`).getTime() + 86400000).toISOString();
  const out: any[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db.from(table).select(cols).eq("is_demo", false).gte("occurred_at", fromIso).lt("occurred_at", toIso).order("id").range(page * 1000, page * 1000 + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const top = (m: Map<string, number>, n = 10) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = (m: Map<string, number>, k: string | null | undefined) => { if (k) m.set(k, (m.get(k) || 0) + 1); };

export async function summary(r: Range) {
  const [events, clicks] = await Promise.all([
    fetchAll("page_events", "event_type,path,product_id,category_id,search_term,referrer_host,utm_campaign", r),
    fetchAll("click_events", "product_id,utm_campaign,referrer_host", r),
  ]);
  const pageViews = events.length;
  const productViews = events.filter((e) => e.event_type === "product_view");
  const pv = new Map<string, number>(), cl = new Map<string, number>(), cat = new Map<string, number>(), pages = new Map<string, number>(), search = new Map<string, number>(), refs = new Map<string, number>(), campV = new Map<string, number>(), campC = new Map<string, number>();
  events.forEach((e) => { inc(pages, e.path); inc(refs, e.referrer_host); inc(campV, e.utm_campaign); if (e.event_type === "product_view") inc(pv, e.product_id); if (e.event_type === "category_view") inc(cat, e.category_id); if (e.event_type === "search") inc(search, e.search_term); });
  clicks.forEach((c) => { inc(cl, c.product_id); inc(campC, c.utm_campaign); });
  const db = adminDb();
  const ids = [...new Set([...top(pv, 15).map((x) => x[0]), ...top(cl, 15).map((x) => x[0])])];
  const { data: prods } = ids.length ? await db.from("products").select("id,title").in("id", ids) : { data: [] as any[] };
  const { data: cats } = await db.from("categories").select("id,name");
  const name = (id: string) => prods?.find((p: any) => p.id === id)?.title || "(deleted)";
  const topProducts = ids.map((id) => ({ id, title: name(id), views: pv.get(id) || 0, clicks: cl.get(id) || 0, ctr: pv.get(id) ? ((cl.get(id) || 0) / pv.get(id)! * 100).toFixed(1) + "%" : "—" })).sort((a, b) => b.clicks - a.clicks || b.views - a.views);
  const campaigns = [...new Set([...campV.keys(), ...campC.keys()])].map((c) => ({ campaign: c, views: campV.get(c) || 0, clicks: campC.get(c) || 0 }));
  return {
    range: r, pageViews, productViews: productViews.length, outboundClicks: clicks.length,
    ctr: productViews.length ? (clicks.length / productViews.length * 100).toFixed(1) + "%" : "—",
    topProducts, topCategories: top(cat).map(([id, n]) => ({ name: cats?.find((c) => c.id === id)?.name || id, views: n })),
    topPages: top(pages, 15).map(([path, n]) => ({ path, views: n })), searches: top(search, 15).map(([term, n]) => ({ term, count: n })),
    referrers: top(refs).map(([host, n]) => ({ host, views: n })), campaigns,
  };
}
