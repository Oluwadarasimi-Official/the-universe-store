"use server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase/clients";
import { assertRole, type Member } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { act, revalidatePublic } from "@/lib/admin";
import { isHttpUrl, slugify, str, optStr } from "@/lib/util";
import { screenProduct } from "@/lib/safety";

const db = () => adminDb();

/* ------------------------------------------------------------------ products */
const ProductSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(160),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug may use lower-case letters, numbers and single hyphens."),
  short_description: z.string().max(300, "Short description: max 300 characters.").nullable(),
  full_description: z.string().max(8000).nullable(),
  category_id: z.string().uuid("Choose a category.").nullable(),
  brand: z.string().max(80).nullable(),
  retailer_name: z.string().min(2).max(60),
  canonical_product_url: z.string().url("Canonical URL must be a valid URL.").nullable(),
  displayed_price: z.number().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code like NGN.").nullable(),
  price_checked_at: z.string().nullable(),
  price_source: z.string().max(120).nullable(),
  availability_status: z.enum(["unknown", "in_stock", "limited", "out_of_stock"]),
  tags: z.array(z.string().max(40)).max(20),
  source_notes: z.string().max(4000).nullable(),
  is_deal: z.boolean(),
  deal_note: z.string().max(140).nullable(),
  deal_expires_at: z.string().nullable(),
});

function parseSpecs(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":");
    return i > 0 ? { key: l.slice(0, i).trim().slice(0, 60), value: l.slice(i + 1).trim().slice(0, 200) } : null;
  }).filter((x): x is { key: string; value: string } => !!x && !!x.key && !!x.value);
}
function parseImages(text: string) {
  const out: { url: string; alt_text: string }[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [url, ...alt] = line.split("|");
    const u = url.trim(), a = alt.join("|").trim();
    if (!isHttpUrl(u) || !u.startsWith("https://")) throw new Error(`Image URL must be a valid https:// URL: ${u.slice(0, 60)}`);
    if (a.length < 3) throw new Error(`Each image needs alt text after a "|" (e.g. "https://… | Black wireless earbuds in case").`);
    out.push({ url: u, alt_text: a.slice(0, 200) });
  }
  return out.slice(0, 8);
}

export async function saveProduct(fd: FormData) {
  const id = optStr(fd, "id");
  const path = id ? `/products/${id}` : "/products/new";
  await act(path, async () => {
    const me = await assertRole(["owner", "editor"]);
    const priceRaw = str(fd, "displayed_price");
    const input = {
      title: str(fd, "title"),
      slug: slugify(str(fd, "slug") || str(fd, "title")),
      short_description: optStr(fd, "short_description"),
      full_description: optStr(fd, "full_description"),
      category_id: optStr(fd, "category_id"),
      brand: optStr(fd, "brand"),
      retailer_name: str(fd, "retailer_name") || "Jumia",
      canonical_product_url: optStr(fd, "canonical_product_url"),
      displayed_price: priceRaw ? Number(priceRaw.replace(/,/g, "")) : null,
      currency: optStr(fd, "currency")?.toUpperCase() ?? null,
      price_checked_at: optStr(fd, "price_checked_at"),
      price_source: optStr(fd, "price_source"),
      availability_status: (str(fd, "availability_status") || "unknown") as any,
      tags: str(fd, "tags").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      source_notes: optStr(fd, "source_notes"),
      is_deal: fd.get("is_deal") === "on",
      deal_note: optStr(fd, "deal_note"),
      deal_expires_at: optStr(fd, "deal_expires_at"),
    };
    const parsed = ProductSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
    const v = parsed.data;
    if (v.displayed_price !== null && (!v.currency || !v.price_checked_at)) throw new Error("A price needs a currency and a 'last checked' date. Leave price empty if you have not checked it.");
    if (v.displayed_price !== null && Number.isNaN(v.displayed_price)) throw new Error("Price must be a number.");
    if (v.is_deal && (!v.deal_expires_at || !v.deal_note)) throw new Error("A deal needs a short verified note and an end date.");
    const specs = parseSpecs(str(fd, "specifications"));
    const images = parseImages(str(fd, "images"));
    const affiliate = optStr(fd, "affiliate_url");
    if (affiliate && !isHttpUrl(affiliate)) throw new Error("Affiliate URL must be a valid http(s) URL.");

    const screen = screenProduct(`${v.title} ${v.short_description || ""} ${v.full_description || ""} ${v.tags.join(" ")}`);
    if (screen.blocked.length) throw new Error(`Blocked: this looks like a prohibited category (${screen.blocked.join(", ")}). It cannot be listed.`);

    // duplicate detection
    const { data: dupSlug } = await db().from("products").select("id").eq("slug", v.slug).maybeSingle();
    if (dupSlug && dupSlug.id !== id) throw new Error(`Slug "${v.slug}" is already used by another product.`);
    const { data: dupTitle } = await db().from("products").select("id,slug").ilike("title", v.title).maybeSingle();
    if (dupTitle && dupTitle.id !== id && fd.get("allow_dup_title") !== "on") throw new Error(`A product with the same title already exists (/${dupTitle.slug}). Tick "allow duplicate title" if intended.`);
    if (affiliate) {
      const { data: dupLink } = await db().from("affiliate_links").select("product_id").eq("url", affiliate).neq("product_id", id ?? "00000000-0000-0000-0000-000000000000").limit(1);
      if (dupLink?.length) throw new Error("This affiliate URL is already attached to another product.");
    }

    const row: any = {
      ...v, specifications: specs, updated_by: me.user_id,
      deal_verified_at: v.is_deal ? new Date().toISOString() : null,
      review_note: screen.flagged ? "Flagged by safety screen for owner review (possible restricted item)." : undefined,
    };
    if (row.review_note === undefined) delete row.review_note;
    let pid = id;
    if (id) {
      const { data: cur } = await db().from("products").select("editorial_status").eq("id", id).single();
      if (cur?.editorial_status === "published" && me.role !== "owner") throw new Error("Published products can only be edited by the Owner. Ask the Owner to unpublish it first.");
      const { error } = await db().from("products").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db().from("products").insert({ ...row, editorial_status: "draft", created_by: me.user_id }).select("id").single();
      if (error) throw new Error(error.message);
      pid = data.id;
    }
    await db().from("product_images").delete().eq("product_id", pid!);
    if (images.length) await db().from("product_images").insert(images.map((im, i) => ({ ...im, product_id: pid, sort_order: i })));
    await setPrimaryLink(me, pid!, affiliate, v.retailer_name);
    await audit(me, id ? "product.update" : "product.create", "product", pid!, { title: v.title });
    revalidatePublic({ product: v.slug });
    if (!id) {
      const { redirect } = await import("next/navigation");
      redirect(`/hq-autopilot-4x9/products/${pid}?ok=${encodeURIComponent("Draft created. Preview it, then submit for review.")}`);
    }
    return screen.flagged ? "Saved — flagged for owner review (possible restricted item)." : "Product saved.";
  });
}

async function setPrimaryLink(me: Member, productId: string, url: string | null, retailer: string) {
  const { data: cur } = await db().from("affiliate_links").select("id,url").eq("product_id", productId).eq("is_primary", true).maybeSingle();
  if (!url) {
    if (cur) { await db().from("affiliate_links").delete().eq("id", cur.id); await audit(me, "link.remove", "product", productId); }
    return;
  }
  if (cur?.url === url) return;
  if (cur) {
    await db().from("affiliate_links").update({ url, status: "unverified", verified_at: null, verified_by: null, retailer }).eq("id", cur.id);
    await audit(me, "link.replace", "affiliate_link", cur.id, { previous: cur.url });
  } else {
    const { data } = await db().from("affiliate_links").insert({ product_id: productId, url, retailer, is_primary: true }).select("id").single();
    await audit(me, "link.add", "affiliate_link", data?.id);
  }
}

async function snapshotProduct(id: string) {
  const { data } = await db().from("products").select("*").eq("id", id).single();
  return data;
}

export async function productTransition(fd: FormData) {
  const id = str(fd, "id");
  const to = str(fd, "to");
  const note = optStr(fd, "note");
  const back = str(fd, "back") || `/products/${id}`;
  await act(back, async () => {
    const ownerOnly = ["approve", "reject", "request_changes", "publish", "unpublish", "approve_publish", "delete", "feature", "unfeature"];
    const me = await assertRole(ownerOnly.includes(to) ? ["owner"] : ["owner", "editor"]);
    const p = await snapshotProduct(id);
    if (!p) throw new Error("Product not found.");
    const set = async (patch: any) => { const { error } = await db().from("products").update({ ...patch, updated_by: me.user_id }).eq("id", id); if (error) throw new Error(error.message); };
    const decide = async (status: string) => {
      await db().from("approval_items").update({ status, decided_by: me.user_id, decided_at: new Date().toISOString(), reviewer_notes: note }).eq("entity_type", "product").eq("entity_id", id).eq("status", "pending");
    };
    switch (to) {
      case "submit": {
        if (!["draft", "rejected"].includes(p.editorial_status)) throw new Error("Only drafts can be submitted.");
        const missing = [!p.category_id && "category", !p.short_description && "short description"].filter(Boolean);
        if (missing.length) throw new Error(`Add ${missing.join(" and ")} before submitting.`);
        await set({ editorial_status: "pending" });
        await db().from("approval_items").insert({ entity_type: "product", entity_id: id, title: p.title, snapshot: p, submitted_by: me.user_id });
        break;
      }
      case "approve": case "approve_publish": {
        if (p.editorial_status !== "pending") throw new Error("Only pending products can be approved.");
        const screen = screenProduct(`${p.title} ${p.short_description || ""} ${p.full_description || ""}`);
        if (screen.blocked.length) throw new Error(`Cannot approve: prohibited category (${screen.blocked.join(", ")}).`);
        await decide("approved");
        if (to === "approve_publish") await set({ editorial_status: "published", published_at: p.published_at || new Date().toISOString(), review_note: null });
        else await set({ editorial_status: "approved", review_note: null });
        break;
      }
      case "reject": case "request_changes": {
        if (p.editorial_status !== "pending") throw new Error("Only pending products can be rejected.");
        await decide(to === "reject" ? "rejected" : "changes_requested");
        await set({ editorial_status: "rejected", review_note: note || (to === "reject" ? "Rejected" : "Changes requested") });
        break;
      }
      case "publish": {
        if (p.editorial_status !== "approved") throw new Error("Approve the product before publishing.");
        await set({ editorial_status: "published", published_at: p.published_at || new Date().toISOString() });
        break;
      }
      case "unpublish": if (p.editorial_status !== "published") throw new Error("Not published."); await set({ editorial_status: "approved" }); break;
      case "archive": if (me.role !== "owner" && p.editorial_status === "published") throw new Error("Only the Owner can archive a published product."); await set({ editorial_status: "archived", featured_flag: false }); break;
      case "restore": if (p.editorial_status !== "archived") throw new Error("Not archived."); await set({ editorial_status: "draft" }); break;
      case "feature": await set({ featured_flag: true }); break;
      case "unfeature": await set({ featured_flag: false }); break;
      case "delete": {
        if (!["draft", "rejected", "archived"].includes(p.editorial_status)) throw new Error("Archive the product before deleting it.");
        await db().from("approval_items").delete().eq("entity_type", "product").eq("entity_id", id);
        const { error } = await db().from("products").delete().eq("id", id); if (error) throw new Error(error.message);
        await audit(me, "product.delete", "product", id, { title: p.title });
        revalidatePublic({ product: p.slug });
        const { redirect } = await import("next/navigation");
        redirect(`/hq-autopilot-4x9/products?ok=${encodeURIComponent("Product deleted.")}`);
      }
      default: throw new Error("Unknown action.");
    }
    await audit(me, `product.${to}`, "product", id, { title: p.title, note });
    revalidatePublic({ product: p.slug });
    return `Done: ${to.replace("_", " ")}.`;
  });
}

/* ------------------------------------------------------------------ affiliate links */
export async function linkAction(fd: FormData) {
  const id = str(fd, "id"); const to = str(fd, "to");
  await act(str(fd, "back") || "/links", async () => {
    const me = await assertRole(to === "verify" || to === "replace" ? ["owner"] : ["owner", "editor"]);
    const { data: l } = await db().from("affiliate_links").select("*, products(slug)").eq("id", id).single();
    if (!l) throw new Error("Link not found.");
    let patch: any = {};
    if (to === "verify") {
      if (fd.get("confirm") !== "on") throw new Error("Tick the confirmation box: you opened the link and confirmed it is your issued affiliate link.");
      if (!isHttpUrl(l.url)) throw new Error("Invalid URL format.");
      patch = { status: "verified", verified_at: new Date().toISOString(), verified_by: me.user_id };
    } else if (to === "unverify") patch = { status: "unverified", verified_at: null, verified_by: null };
    else if (to === "disable") patch = { status: "disabled" };
    else if (to === "broken") patch = { status: "broken" };
    else if (to === "label") patch = { label: str(fd, "label").slice(0, 60) || "Primary", notes: optStr(fd, "notes") };
    else if (to === "replace") {
      const url = str(fd, "url");
      if (!isHttpUrl(url)) throw new Error("New URL must be a valid http(s) URL.");
      patch = { url, status: "unverified", verified_at: null, verified_by: null };
    } else throw new Error("Unknown action.");
    const { error } = await db().from("affiliate_links").update(patch).eq("id", id);
    if (error) throw new Error(error.message.includes("duplicate") ? "That URL is already used by another product." : error.message);
    await audit(me, `link.${to}`, "affiliate_link", id, to === "replace" ? { previous: l.url } : undefined);
    revalidatePublic({ product: (l as any).products?.slug });
    return to === "verify" ? "Marked as verified by owner." : "Link updated.";
  });
}

/* ------------------------------------------------------------------ categories */
export async function saveCategory(fd: FormData) {
  await act("/categories", async () => {
    const me = await assertRole(["owner", "editor"]);
    const id = optStr(fd, "id");
    const name = str(fd, "name");
    if (name.length < 2) throw new Error("Category name is required.");
    const slug = slugify(str(fd, "slug") || name);
    const screen = screenProduct(name);
    if (screen.blocked.length) throw new Error("That category is not allowed (age-restricted or unsafe).");
    const row = { name: name.slice(0, 80), slug, intro: optStr(fd, "intro"), icon: optStr(fd, "icon")?.slice(0, 4) ?? null, sort_order: Number(str(fd, "sort_order") || 100), visible: fd.get("visible") === "on" };
    const q = id ? db().from("categories").update(row).eq("id", id) : db().from("categories").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message.includes("duplicate") ? `Slug "${slug}" already exists.` : error.message);
    await audit(me, id ? "category.update" : "category.create", "category", id || slug, row);
    revalidatePublic({ category: slug });
    return "Category saved.";
  });
}

export async function categoryAction(fd: FormData) {
  await act("/categories", async () => {
    const me = await assertRole(["owner"]);
    const id = str(fd, "id"); const to = str(fd, "to");
    const { data: c } = await db().from("categories").select("*").eq("id", id).single();
    if (!c) throw new Error("Category not found.");
    if (to === "delete") {
      const { count } = await db().from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
      if ((count ?? 0) > 0 && fd.get("force") !== "1") throw new Error(`${count} product(s) use this category. Move them first, or hide the category instead.`);
      await db().from("categories").delete().eq("id", id);
    } else if (to === "up" || to === "down") {
      await db().from("categories").update({ sort_order: c.sort_order + (to === "up" ? -15 : 15) }).eq("id", id);
    } else if (to === "toggle") {
      await db().from("categories").update({ visible: !c.visible }).eq("id", id);
    }
    await audit(me, `category.${to}`, "category", id, { name: c.name });
    revalidatePublic({ category: c.slug });
    return "Category updated.";
  });
}

/* ------------------------------------------------------------------ guides */
export async function saveGuide(fd: FormData) {
  const id = optStr(fd, "id");
  await act(id ? `/guides/${id}` : "/guides", async () => {
    const me = await assertRole(["owner", "editor"]);
    const title = str(fd, "title");
    if (title.length < 3) throw new Error("Title is required.");
    const slug = slugify(str(fd, "slug") || title);
    const row = {
      title, slug, kind: str(fd, "kind") === "collection" ? "collection" : "guide",
      excerpt: optStr(fd, "excerpt"), body: optStr(fd, "body"), selection_criteria: optStr(fd, "selection_criteria"), limitations: optStr(fd, "limitations"),
      product_ids: fd.getAll("product_ids").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x)), updated_by: me.user_id,
    };
    if (/\b(we tested|hands-on|i tested|our testing|expert certified)\b/i.test(`${row.body} ${row.excerpt}`) && fd.get("evidence") !== "on")
      throw new Error("The guide claims hands-on testing or certification. Remove that claim, or tick 'I have evidence for testing claims'.");
    if (id) {
      const { data: cur } = await db().from("guides").select("status").eq("id", id).single();
      if (cur?.status === "published" && me.role !== "owner") throw new Error("Only the Owner can edit a published guide.");
      const { error } = await db().from("guides").update(row).eq("id", id); if (error) throw new Error(error.message.includes("duplicate") ? "Slug already used." : error.message);
    } else {
      const { data, error } = await db().from("guides").insert({ ...row, created_by: me.user_id, ai_assisted: fd.get("ai_assisted") === "1" }).select("id").single();
      if (error) throw new Error(error.message.includes("duplicate") ? "Slug already used." : error.message);
      await audit(me, "guide.create", "guide", data.id);
      const { redirect } = await import("next/navigation");
      redirect(`/hq-autopilot-4x9/guides/${data.id}?ok=Guide+draft+created.`);
    }
    await audit(me, "guide.update", "guide", id!);
    revalidatePublic({ guide: slug });
    return "Guide saved.";
  });
}

export async function guideTransition(fd: FormData) {
  const id = str(fd, "id"); const to = str(fd, "to"); const note = optStr(fd, "note");
  await act(str(fd, "back") || `/guides/${id}`, async () => {
    const me = await assertRole(["submit", "archive", "restore"].includes(to) ? ["owner", "editor"] : ["owner"]);
    const { data: g } = await db().from("guides").select("*").eq("id", id).single();
    if (!g) throw new Error("Guide not found.");
    const set = async (patch: any) => { await db().from("guides").update(patch).eq("id", id); };
    const decide = (status: string) => db().from("approval_items").update({ status, decided_by: me.user_id, decided_at: new Date().toISOString(), reviewer_notes: note }).eq("entity_type", "guide").eq("entity_id", id).eq("status", "pending");
    if (to === "submit") { if (!["draft", "rejected"].includes(g.status)) throw new Error("Only drafts can be submitted."); await set({ status: "pending" }); await db().from("approval_items").insert({ entity_type: "guide", entity_id: id, title: g.title, snapshot: g, submitted_by: me.user_id }); }
    else if (to === "approve" || to === "approve_publish") { if (g.status !== "pending") throw new Error("Only pending guides can be approved."); await decide("approved"); await set(to === "approve_publish" ? { status: "published", published_at: g.published_at || new Date().toISOString() } : { status: "approved" }); }
    else if (to === "reject" || to === "request_changes") { if (g.status !== "pending") throw new Error("Only pending guides can be rejected."); await decide(to === "reject" ? "rejected" : "changes_requested"); await set({ status: "rejected" }); }
    else if (to === "publish") { if (g.status !== "approved") throw new Error("Approve before publishing."); await set({ status: "published", published_at: g.published_at || new Date().toISOString() }); }
    else if (to === "unpublish") await set({ status: "approved" });
    else if (to === "archive") await set({ status: "archived" });
    else if (to === "restore") await set({ status: "draft" });
    else if (to === "delete") { if (!["draft", "rejected", "archived"].includes(g.status)) throw new Error("Archive first."); await db().from("guides").delete().eq("id", id); }
    else throw new Error("Unknown action.");
    await audit(me, `guide.${to}`, "guide", id, { note });
    revalidatePublic({ guide: g.slug });
    if (to === "delete") { const { redirect } = await import("next/navigation"); redirect("/hq-autopilot-4x9/guides?ok=Guide+deleted."); }
    return `Done: ${to.replace("_", " ")}.`;
  });
}
