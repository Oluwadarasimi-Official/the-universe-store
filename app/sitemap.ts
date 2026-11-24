import type { MetadataRoute } from "next";
import { publicDb } from "@/lib/supabase/clients";
import { siteUrl, supabaseConfigured } from "@/lib/config";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed = ["", "/discover", "/categories", "/guides", "/deals", "/about", "/contact", "/affiliate-disclosure", "/privacy", "/terms"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const }));
  if (!supabaseConfigured()) return fixed;
  const db = publicDb();
  const [{ data: cats }, { data: prods }, { data: guides }] = await Promise.all([
    db.from("categories").select("slug,updated_at"),
    db.from("products").select("slug,updated_at,is_demo").eq("editorial_status", "published").eq("is_demo", false).limit(5000),
    db.from("guides").select("slug,updated_at,is_demo").eq("status", "published").eq("is_demo", false),
  ]);
  return [
    ...fixed,
    ...(cats || []).map((c) => ({ url: `${base}/categories/${c.slug}`, lastModified: c.updated_at })),
    ...(prods || []).map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updated_at })),
    ...(guides || []).map((g) => ({ url: `${base}/guides/${g.slug}`, lastModified: g.updated_at })),
  ];
}
