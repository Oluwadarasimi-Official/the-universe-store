import "server-only";
import { adminDb } from "@/lib/supabase/clients";
const db = () => adminDb();

export async function productFacts(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await db().from("products").select("id,title,brand,short_description,full_description,retailer_name,displayed_price,currency,price_checked_at,availability_status,specifications,tags,editorial_status,categories(name)").in("id", ids);
  return (data || []).map((p: any) => ({
    id: p.id, title: p.title, brand: p.brand || "Not provided", category: p.categories?.name || "Not provided", retailer: p.retailer_name,
    short_description: p.short_description || "Not provided", full_description: p.full_description || "Not provided",
    price: p.displayed_price != null ? `${p.currency} ${p.displayed_price} (last checked ${p.price_checked_at?.slice(0, 10) || "unknown"}, not live)` : "Not provided",
    availability: p.availability_status === "unknown" ? "Not provided" : p.availability_status,
    specifications: p.specifications?.length ? p.specifications : "Not provided", tags: p.tags, status: p.editorial_status,
  }));
}

