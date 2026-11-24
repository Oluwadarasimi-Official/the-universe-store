import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/supabase/clients";
import { isHttpUrl, hostOf } from "@/lib/util";

export const dynamic = "force-dynamic";

/* Outbound affiliate redirect + first-party click logging.
   Only published products with an owner-verified, enabled primary link redirect. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const home = new URL("/", req.url);
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return NextResponse.redirect(home, 302);
  const db = adminDb();
  const { data: p } = await db.from("products").select("id,slug,is_demo,editorial_status").eq("slug", slug).maybeSingle();
  if (!p || p.editorial_status !== "published") return NextResponse.redirect(home, 302);
  const { data: link } = await db.from("affiliate_links").select("id,url,status").eq("product_id", p.id).eq("is_primary", true).maybeSingle();
  if (!link || link.status !== "verified" || !isHttpUrl(link.url)) return NextResponse.redirect(new URL(`/p/${p.slug}`, req.url), 302);
  const ref = req.headers.get("referer");
  let path: string | null = null, utm: Record<string, string | null> = {};
  try { if (ref) { const r = new URL(ref); if (r.host === req.nextUrl.host) { path = r.pathname; utm = { utm_source: r.searchParams.get("utm_source"), utm_medium: r.searchParams.get("utm_medium"), utm_campaign: r.searchParams.get("utm_campaign") }; } } } catch {}
  const sp = req.nextUrl.searchParams;
  // bots and prefetchers are not counted as clicks
  const ua = req.headers.get("user-agent") || "";
  const isBot = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slurp/i.test(ua) || req.headers.get("purpose") === "prefetch";
  if (!isBot) {
    await db.from("click_events").insert({
      product_id: p.id, link_id: link.id, page_path: path || `/p/${p.slug}`,
      referrer_host: ref ? hostOf(ref) : null,
      utm_source: (sp.get("utm_source") || utm.utm_source || null)?.slice(0, 80) ?? null,
      utm_medium: (sp.get("utm_medium") || utm.utm_medium || null)?.slice(0, 80) ?? null,
      utm_campaign: (sp.get("utm_campaign") || utm.utm_campaign || null)?.slice(0, 80) ?? null,
      is_demo: p.is_demo,
    });
  }
  const res = NextResponse.redirect(link.url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
