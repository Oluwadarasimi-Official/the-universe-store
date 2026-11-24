import "server-only";
import { adminDb } from "@/lib/supabase/clients";

export const STARTER_CATEGORIES = [
  ["electronics", "Electronics", "Phones, audio, chargers and everyday tech accessories.", 10],
  ["home-and-kitchen", "Home & Kitchen", "Practical tools and small appliances for cooking, cleaning and living.", 20],
  ["fashion", "Fashion", "Clothing, footwear and bags for everyday wear.", 30],
  ["beauty-and-personal-care", "Beauty & Personal Care", "Grooming, skincare and personal-care essentials.", 40],
  ["lifestyle", "Lifestyle", "Fitness, travel and hobby finds.", 50],
  ["accessories", "Accessories", "Watches, wallets, phone cases and finishing touches.", 60],
  ["books-and-learning", "Books & Learning", "Books, stationery and learning tools.", 70],
  ["everyday-essentials", "Everyday Essentials", "Household basics worth keeping in stock.", 80],
] as const;

// Clearly-labelled sample products: no prices, no stock, no ratings, no links, no images.
const DEMO_PRODUCTS: [string, string, string][] = [
  ["electronics", "Demo: Wireless Earbuds (sample listing)", "Sample product used to preview the layout. Not a real offer."],
  ["electronics", "Demo: 20,000mAh Power Bank (sample listing)", "Sample product used to preview the layout. Not a real offer."],
  ["home-and-kitchen", "Demo: Electric Kettle 1.7L (sample listing)", "Sample product used to preview the layout. Not a real offer."],
  ["home-and-kitchen", "Demo: Non-stick Frying Pan (sample listing)", "Sample product used to preview the layout. Not a real offer."],
  ["fashion", "Demo: Everyday Canvas Sneakers (sample listing)", "Sample product used to preview the layout. Not a real offer."],
  ["beauty-and-personal-care", "Demo: Rechargeable Hair Clipper (sample listing)", "Sample product used to preview the layout. Not a real offer."],
  ["books-and-learning", "Demo: A5 Ruled Notebook Set (sample listing)", "Sample product used to preview the layout. Not a real offer."],
  ["accessories", "Demo: Slim Card Wallet (sample listing)", "Sample product used to preview the layout. Not a real offer."],
];

export async function ensureStarterCategories() {
  const db = adminDb();
  await db.from("categories").upsert(STARTER_CATEGORIES.map(([slug, name, intro, sort_order]) => ({ slug, name, intro, sort_order, visible: true })), { onConflict: "slug", ignoreDuplicates: true });
}

export async function loadDemo(userId: string | null) {
  const db = adminDb();
  await ensureStarterCategories();
  const { data: cats } = await db.from("categories").select("id,slug");
  const id = (s: string) => cats?.find((c) => c.slug === s)?.id ?? null;
  const now = new Date().toISOString();
  const rows = DEMO_PRODUCTS.map(([cat, title, short], i) => ({
    slug: `demo-${title.toLowerCase().replace(/^demo: /, "").replace(/\(sample listing\)/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    title, short_description: short, category_id: id(cat), retailer_name: "AliExpress", is_demo: true, editorial_status: "published", featured_flag: i < 4,
    full_description: "This is demo content. It shows how a product page will look once real, owner-verified products are added. It has no price, stock information or retailer link on purpose.",
    source_notes: "DEMO DATA — remove before launch (Settings → Demo data).", published_at: now, created_by: userId,
  }));
  await db.from("products").upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
  const { data: demo } = await db.from("products").select("id").eq("is_demo", true).limit(4);
  await db.from("guides").upsert([{
    slug: "demo-how-we-choose-products", kind: "guide", is_demo: true, status: "published", published_at: now, created_by: userId,
    title: "Demo guide: How we choose products", excerpt: "Sample guide showing the guide layout. Replace with your own reviewed guides.",
    body: "## What we look for\n\n- Clear, verifiable product information from the retailer listing\n- Useful features for everyday buyers in Nigeria and abroad\n- Retailers with clear pricing, delivery and returns information\n\n## What we don't do\n\nWe don't invent ratings, reviews, prices or discounts, and we don't claim to have tested products unless we say so with evidence.",
    selection_criteria: "Demo: products are chosen for usefulness and the quality of the information available about them.",
    limitations: "Demo content. No products here have been tested hands-on.", product_ids: (demo || []).map((d) => d.id),
  }], { onConflict: "slug", ignoreDuplicates: true });
}

export async function removeDemo() {
  const db = adminDb();
  const { data: ids } = await db.from("products").select("id").eq("is_demo", true);
  const pids = (ids || []).map((x) => x.id);
  if (pids.length) await db.from("approval_items").delete().eq("entity_type", "product").in("entity_id", pids);
  const p = await db.from("products").delete().eq("is_demo", true).select("id");
  const g = await db.from("guides").delete().eq("is_demo", true).select("id");
  await db.from("click_events").delete().eq("is_demo", true);
  await db.from("page_events").delete().eq("is_demo", true);
  await db.from("categories").delete().eq("is_demo", true);
  return { products: p.data?.length ?? 0, guides: g.data?.length ?? 0 };
}
