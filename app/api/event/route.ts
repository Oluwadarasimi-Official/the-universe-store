import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/supabase/clients";
import { hashIp } from "@/lib/crypto";

export const dynamic = "force-dynamic";
const TYPES = new Set(["page_view", "product_view", "category_view", "guide_view", "search"]);
const UUID = /^[0-9a-f-]{36}$/i;
const clip = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (/bot|crawl|spider|headless/i.test(ua)) return new NextResponse(null, { status: 204 });
    const b = await req.json().catch(() => null);
    if (!b || !TYPES.has(b.type)) return new NextResponse(null, { status: 204 });
    const db = adminDb();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const { data: ok } = await db.rpc("hit_rate_limit", { p_key: `ev:${hashIp(ip)}`, p_limit: 120, p_window_seconds: 300 });
    if (ok === false) return new NextResponse(null, { status: 204 });
    const path = clip(b.path, 300);
    if (path && path.startsWith("/hq-")) return new NextResponse(null, { status: 204 });
    await db.from("page_events").insert({
      event_type: b.type, path,
      product_id: UUID.test(b.productId || "") ? b.productId : null,
      category_id: UUID.test(b.categoryId || "") ? b.categoryId : null,
      guide_id: UUID.test(b.guideId || "") ? b.guideId : null,
      search_term: b.type === "search" ? clip(String(b.search || "").toLowerCase().trim(), 80) : null,
      referrer_host: clip(b.ref, 120), utm_source: clip(b.utm_source, 80), utm_medium: clip(b.utm_medium, 80), utm_campaign: clip(b.utm_campaign, 80),
      is_demo: !!b.demo,
    });
  } catch { /* analytics must never break the page */ }
  return new NextResponse(null, { status: 204 });
}
