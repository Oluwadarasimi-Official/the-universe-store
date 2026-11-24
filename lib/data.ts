import "server-only";
import { cache } from "react";
import { publicDb } from "@/lib/supabase/clients";
import { supabaseConfigured } from "@/lib/config";

export const PRODUCT_PUBLIC_COLS =
  "id,slug,title,short_description,full_description,category_id,brand,retailer_name,displayed_price,currency,price_checked_at,price_source,availability_status,specifications,tags,featured_flag,is_deal,deal_note,deal_verified_at,deal_expires_at,is_demo,outbound_ready,outbound_host,published_at,created_at,updated_at";

export type Category = { id: string; slug: string; name: string; intro: string | null; icon: string | null; sort_order: number; is_demo: boolean };
export type Product = {
  id: string; slug: string; title: string; short_description: string | null; full_description: string | null; category_id: string | null;
  brand: string | null; retailer_name: string; displayed_price: number | null; currency: string | null; price_checked_at: string | null; price_source: string | null;
  availability_status: string; specifications: { key: string; value: string }[]; tags: string[]; featured_flag: boolean; is_deal: boolean; deal_note: string | null;
  deal_verified_at: string | null; deal_expires_at: string | null; is_demo: boolean; outbound_ready: boolean; outbound_host: string | null; published_at: string | null; created_at: string; updated_at: string;
  images?: { url: string; alt_text: string }[];
};
export type Guide = { id: string; slug: string; kind: string; title: string; excerpt: string | null; body: string | null; selection_criteria: string | null; limitations: string | null; product_ids: string[]; ai_assisted: boolean; is_demo: boolean; published_at: string | null; updated_at: string };

async function safe<T>(p: PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  if (!supabaseConfigured()) return fallback;
  try { const { data, error } = await p; if (error) { console.error("db", error.message); return fallback; } return (data ?? fallback) as T; }
  catch (e) { console.error("db", e); return fallback; }
}

async function withImages(products: Product[]): Promise<Product[]> {
  if (!products.length) return products;
  const imgs = await safe<any[]>(publicDb().from("product_images").select("product_id,url,alt_text,sort_order").in("product_id", products.map((p) => p.id)).order("sort_order"), []);
  return products.map((p) => ({ ...p, images: imgs.filter((i) => i.product_id === p.id) }));
}

export const getCategories = cache(async () =>
  safe<Category[]>(publicDb().from("categories").select("id,slug,name,intro,icon,sort_order,is_demo").order("sort_order").order("name"), []));

export const getSettings = cache(async () => {
  const rows = await safe<any[]>(publicDb().from("site_settings").select("key,value"), []);
  const m: Record<string, any> = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const social: Record<string, string | null> = (m.social_links as Record<string, string | null>) || {};
  /* The store's own Instagram (@theuniversestore). It shows in the footer
     until the Owner sets (or clears) it in Admin → Settings, which always
     wins. Facebook/TikTok have no default — their real URLs are unknown. */
  if (!social.instagram) social.instagram = "https://www.instagram.com/theuniversestore";
  return {
    disclosure: (m.affiliate_disclosure as string) || "The Universe Store may earn a commission when you buy through qualifying links on this site, at no extra cost to you. Prices, stock, shipping, returns and purchase terms are set by the retailer and can change.",
    contactEmail: (m.contact_email as string | null) || null,
    social,
    currency: (m.currency_display as string) || "NGN",
  };
});

export type ProductQuery = { q?: string; category?: string; sort?: string; limit?: number; featured?: boolean; deals?: boolean; ids?: string[]; excludeId?: string };

export async function getProducts(o: ProductQuery = {}): Promise<Product[]> {
  let q = publicDb().from("products").select(PRODUCT_PUBLIC_COLS).eq("editorial_status", "published");
  if (o.category) q = q.eq("category_id", o.category);
  if (o.featured) q = q.eq("featured_flag", true);
  if (o.deals) q = q.eq("is_deal", true).not("deal_verified_at", "is", null).gt("deal_expires_at", new Date().toISOString());
  if (o.ids) q = q.in("id", o.ids.length ? o.ids : ["00000000-0000-0000-0000-000000000000"]);
  if (o.excludeId) q = q.neq("id", o.excludeId);
  if (o.q) {
    const term = o.q.replace(/[%,()*]/g, " ").trim().slice(0, 80);
    if (term) q = q.or(`title.ilike.%${term}%,short_description.ilike.%${term}%,brand.ilike.%${term}%`);
  }
  if (o.sort === "price_asc") q = q.order("displayed_price", { ascending: true, nullsFirst: false });
  else if (o.sort === "price_desc") q = q.order("displayed_price", { ascending: false, nullsFirst: false });
  else if (o.sort === "az") q = q.order("title");
  else q = q.order("published_at", { ascending: false, nullsFirst: false });
  q = q.limit(o.limit ?? 48);
  return withImages(await safe<Product[]>(q as any, []));
}

export async function getProduct(slug: string): Promise<Product | null> {
  const p = await safe<Product | null>(publicDb().from("products").select(PRODUCT_PUBLIC_COLS).eq("slug", slug).eq("editorial_status", "published").maybeSingle() as any, null);
  if (!p) return null;
  return (await withImages([p]))[0];
}

export async function getGuides(kind?: string, limit = 24): Promise<Guide[]> {
  let q = publicDb().from("guides").select("id,slug,kind,title,excerpt,body,selection_criteria,limitations,product_ids,ai_assisted,is_demo,published_at,updated_at").eq("status", "published");
  if (kind) q = q.eq("kind", kind);
  return safe<Guide[]>(q.order("published_at", { ascending: false }).limit(limit) as any, []);
}

export async function getGuide(slug: string): Promise<Guide | null> {
  return safe<Guide | null>(publicDb().from("guides").select("id,slug,kind,title,excerpt,body,selection_criteria,limitations,product_ids,ai_assisted,is_demo,published_at,updated_at").eq("slug", slug).eq("status", "published").maybeSingle() as any, null);
}
