import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { toCsv } from "@/lib/util";
import { parseRange, summary } from "@/lib/analytics";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
const PRODUCT_COLS = ["id", "slug", "title", "short_description", "full_description", "category_slug", "brand", "retailer_name", "affiliate_url", "affiliate_status", "canonical_product_url", "displayed_price", "currency", "price_checked_at", "price_source", "availability_status", "specifications", "tags", "editorial_status", "featured_flag", "is_demo", "source_notes", "created_at", "updated_at"];

export async function GET(req: NextRequest) {
  const s = await getMember();
  if (!s?.member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams; const type = sp.get("type"); const fmt = sp.get("format") === "json" ? "json" : "csv";
  const db = adminDb(); const stamp = new Date().toISOString().slice(0, 10);
  let rows: any[] = [], cols: string[] = [], name = type || "export";
  if (type === "products") {
    if (s.member.role === "analyst") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { data } = await db.from("products").select("*, categories(slug), affiliate_links(url,status,is_primary)").order("created_at");
    rows = (data || []).map((p: any) => { const l = (p.affiliate_links || []).find((x: any) => x.is_primary); return { ...p, category_slug: p.categories?.slug ?? null, affiliate_url: l?.url ?? null, affiliate_status: l?.status ?? null, categories: undefined, affiliate_links: undefined }; });
    cols = PRODUCT_COLS;
  } else if (type === "categories") {
    const { data } = await db.from("categories").select("*").order("sort_order"); rows = data || []; cols = ["id", "slug", "name", "intro", "icon", "sort_order", "visible", "is_demo"];
  } else if (type === "content") {
    const { data } = await db.from("content_drafts").select("*").order("created_at"); rows = data || []; cols = ["id", "format", "tone", "title", "body", "product_ids", "source_facts", "needs_verification", "missing_facts", "ai_provider", "ai_model", "status", "created_at"];
  } else if (type === "guides") {
    const { data } = await db.from("guides").select("*").order("created_at"); rows = data || []; cols = ["id", "slug", "kind", "title", "excerpt", "body", "selection_criteria", "limitations", "product_ids", "status", "is_demo"];
  } else if (type === "analytics") {
    const r = parseRange({ from: sp.get("from") || undefined, to: sp.get("to") || undefined });
    const sum = await summary(r);
    const lines = [
      `# The Universe Store analytics export, generated ${new Date().toISOString()} (UTC). Range ${r.from} to ${r.to} WAT. Demo data excluded.`,
      `# Definitions: page_events = public page loads; product_views = /p/ loads; outbound_clicks = /go/ redirects to verified retailer links; ctr = outbound_clicks / product_views. Purchases and commissions are NOT available here (controlled by the affiliate programme).`,
      toCsv([{ metric: "page_events", value: sum.pageViews }, { metric: "product_views", value: sum.productViews }, { metric: "outbound_clicks", value: sum.outboundClicks }, { metric: "ctr", value: sum.ctr }, { metric: "purchases", value: "Not available" }, { metric: "commission", value: "Not available" }], ["metric", "value"]),
      "", toCsv(sum.topProducts, ["id", "title", "views", "clicks", "ctr"]), "", toCsv(sum.campaigns, ["campaign", "views", "clicks"]), "", toCsv(sum.topPages, ["path", "views"]),
    ];
    await audit(s.member, "export.analytics");
    return new NextResponse(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="universe-analytics-${r.from}-to-${r.to}.csv"`, "Cache-Control": "no-store" } });
  } else return NextResponse.json({ error: "unknown type" }, { status: 400 });
  await audit(s.member, `export.${type}`, undefined, undefined, { format: fmt, rows: rows.length });
  if (fmt === "json") return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), type, rows }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="universe-${name}-${stamp}.json"`, "Cache-Control": "no-store" } });
  return new NextResponse(toCsv(rows, cols), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="universe-${name}-${stamp}.csv"`, "Cache-Control": "no-store" } });
}
