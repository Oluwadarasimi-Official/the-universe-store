"use server";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/supabase/clients";
import { assertRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { act } from "@/lib/admin";
import { optStr, str, slugify, parseCsv, isHttpUrl } from "@/lib/util";
import { generate, type ProviderId } from "@/lib/ai/providers";
import { GUARDRAILS, FORMATS, TONES, draftPrompt, researchPrompt, parseJsonLoose } from "@/lib/ai/prompts";
import { screenProduct } from "@/lib/safety";
import { siteUrl } from "@/lib/config";
import { productFacts } from "@/lib/facts";

const db = () => adminDb();
const PROVIDERS = ["darax", "gemini", "groq", "openrouter"];

/* ------------------------------------------------------------------ content studio */
export async function generateDraft(fd: FormData) {
  await act("/content", async () => {
    const me = await assertRole(["owner", "editor"]);
    const format = str(fd, "format"); const tone = str(fd, "tone") || "informative";
    if (!FORMATS[format]) throw new Error("Choose a content format.");
    if (!(TONES as readonly string[]).includes(tone)) throw new Error("Choose a tone.");
    const ids = fd.getAll("product_ids").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 8);
    const facts = await productFacts(ids);
    if (!facts.length && !["category_intro", "campaign_concept", "guide_outline"].includes(format)) throw new Error("Select at least one product to base the draft on.");
    const notApproved = facts.filter((f) => !["approved", "published"].includes(String(f.status)));
    if (notApproved.length) throw new Error(`Drafts are generated only from approved product data. Not yet approved: ${notApproved.map((f) => f.title).join(", ")}.`);
    const screen = screenProduct(JSON.stringify(facts));
    if (screen.blocked.length) throw new Error(`Blocked category (${screen.blocked.join(", ")}). No content generated.`);
    const provider = str(fd, "provider");
    const out = await generate({ system: GUARDRAILS, user: draftPrompt(format, tone, facts, optStr(fd, "notes") || undefined), purpose: `content:${format}`, userId: me.user_id, only: PROVIDERS.includes(provider) ? (provider as ProviderId) : undefined, maxTokens: 1800 });
    if (!out.ok) throw new Error(out.error);
    const j = parseJsonLoose(out.text);
    if (j?.blocked) throw new Error(`The AI declined: ${j.blocked_reason || "restricted content"}. Nothing was saved.`);
    const { data, error } = await db().from("content_drafts").insert({
      format, tone, title: j?.title || FORMATS[format].slice(0, 60), body: j?.body || out.text,
      product_ids: ids, source_facts: j?.source_facts_used || facts.map((f) => f.title),
      needs_verification: [...(j?.needs_human_verification || []), ...(j?.assumptions || []).map((a: string) => `Assumption: ${a}`)],
      missing_facts: j?.missing_facts || [], ai_provider: out.provider, ai_model: out.model, fallback_reason: out.fallbackReason, created_by: me.user_id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await audit(me, "content.generate", "content_draft", data.id, { provider: out.provider, model: out.model, fallback: out.fallbackReason });
    redirect(`/hq-autopilot-4x9/content/${data.id}?ok=${encodeURIComponent(`Draft created by ${out.provider} (${out.model})${out.fallbackReason ? " after fallback" : ""}. Review before use.`)}`);
  });
}

export async function draftAction(fd: FormData) {
  const id = str(fd, "id"); const to = str(fd, "to"); const note = optStr(fd, "note");
  await act(str(fd, "back") || `/content/${id}`, async () => {
    const me = await assertRole(["approve", "reject", "request_changes"].includes(to) ? ["owner"] : ["owner", "editor"]);
    const { data: d } = await db().from("content_drafts").select("*").eq("id", id).single();
    if (!d) throw new Error("Draft not found.");
    const decide = (status: string) => db().from("approval_items").update({ status, decided_by: me.user_id, decided_at: new Date().toISOString(), reviewer_notes: note }).eq("entity_type", "content_draft").eq("entity_id", id).eq("status", "pending");
    if (to === "save") await db().from("content_drafts").update({ title: optStr(fd, "title"), body: str(fd, "body") || d.body, status: d.status === "approved" ? "draft" : d.status }).eq("id", id);
    else if (to === "submit") { await db().from("content_drafts").update({ status: "needs_review" }).eq("id", id); await db().from("approval_items").insert({ entity_type: "content_draft", entity_id: id, title: d.title || d.format, snapshot: d, submitted_by: me.user_id }); }
    else if (to === "approve") { await decide("approved"); await db().from("content_drafts").update({ status: "approved" }).eq("id", id); }
    else if (to === "reject" || to === "request_changes") { await decide(to === "reject" ? "rejected" : "changes_requested"); await db().from("content_drafts").update({ status: "draft" }).eq("id", id); }
    else if (to === "archive") await db().from("content_drafts").update({ status: "archived" }).eq("id", id);
    else if (to === "delete") { await db().from("content_drafts").delete().eq("id", id); await audit(me, "content.delete", "content_draft", id); redirect("/hq-autopilot-4x9/content?ok=Draft+deleted."); }
    else if (to === "to_guide") {
      const { data: g, error } = await db().from("guides").insert({ title: d.title || "Untitled guide", slug: `${slugify(d.title || "guide")}-${Date.now().toString(36)}`, body: d.body, product_ids: d.product_ids, ai_assisted: true, ai_provider: d.ai_provider, created_by: me.user_id, limitations: (d.needs_verification || []).length ? `Needs verification: ${(d.needs_verification as string[]).join("; ")}` : null }).select("id").single();
      if (error) throw new Error(error.message);
      await audit(me, "content.to_guide", "guide", g.id, { from: id });
      redirect(`/hq-autopilot-4x9/guides/${g.id}?ok=Guide+draft+created+from+content.+Edit%2C+then+submit+for+review.`);
    }
    else if (to === "to_product_desc") {
      if (d.status !== "approved") throw new Error("Approve the draft first.");
      if (d.product_ids?.length !== 1) throw new Error("This draft must reference exactly one product.");
      const { data: p } = await db().from("products").select("editorial_status").eq("id", d.product_ids[0]).single();
      if (p?.editorial_status === "published" && me.role !== "owner") throw new Error("Only the Owner can change a published product.");
      await db().from("products").update({ full_description: d.body, updated_by: me.user_id }).eq("id", d.product_ids[0]);
      await audit(me, "product.description_from_draft", "product", d.product_ids[0], { draft: id });
    }
    else throw new Error("Unknown action.");
    await audit(me, `content.${to}`, "content_draft", id, { note });
    return "Draft updated.";
  });
}

/* ------------------------------------------------------------------ research inbox */
export async function addResearch(fd: FormData) {
  await act("/research", async () => {
    const me = await assertRole(["owner", "editor"]);
    const kind = str(fd, "kind");
    const raw = str(fd, "raw_input");
    if (!["url", "note", "csv", "image"].includes(kind)) throw new Error("Choose what you are adding.");
    if (raw.length < 3) throw new Error("Paste a URL, notes or CSV rows.");
    const source_url = optStr(fd, "source_url"); const image_url = optStr(fd, "image_url");
    if (source_url && !isHttpUrl(source_url)) throw new Error("Source URL is not a valid URL.");
    if (image_url && !isHttpUrl(image_url)) throw new Error("Image URL is not a valid URL.");
    if (kind === "csv") {
      const rows = parseCsv(raw);
      if (!rows.length) throw new Error("No CSV rows found. Include a header row.");
      await db().from("research_items").insert(rows.slice(0, 200).map((r) => ({ kind: "csv", raw_input: JSON.stringify(r), source_url: isHttpUrl(r.url || r.source_url) ? (r.url || r.source_url) : null, created_by: me.user_id })));
      await audit(me, "research.add_csv", "research_item", undefined, { rows: rows.length });
      return `${Math.min(rows.length, 200)} row(s) added to the inbox.`;
    }
    const url = kind === "url" ? (isHttpUrl(raw.split(/\s/)[0]) ? raw.split(/\s/)[0] : source_url) : source_url;
    await db().from("research_items").insert({ kind, raw_input: raw.slice(0, 8000), source_url: url, image_url, created_by: me.user_id });
    await audit(me, "research.add", "research_item");
    return "Added to the inbox.";
  });
}

export async function researchAction(fd: FormData) {
  const id = str(fd, "id"); const to = str(fd, "to");
  await act("/research", async () => {
    const me = await assertRole(["owner", "editor"]);
    const { data: r } = await db().from("research_items").select("*").eq("id", id).single();
    if (!r) throw new Error("Item not found.");
    if (to === "analyze") {
      const screen = screenProduct(r.raw_input);
      if (screen.blocked.length) { await db().from("research_items").update({ status: "dismissed", ai_result: { blocked: true, blocked_reason: `Prohibited: ${screen.blocked.join(", ")}` } }).eq("id", id); throw new Error(`Blocked: ${screen.blocked.join(", ")}. Item dismissed.`); }
      const { data: cats } = await db().from("categories").select("name");
      const material = `${r.raw_input}${r.source_url ? `\nSource URL (not visited): ${r.source_url}` : ""}${r.image_url ? `\nImage URL supplied (not viewed): ${r.image_url}` : ""}`;
      const out = await generate({ system: GUARDRAILS, user: researchPrompt(material, (cats || []).map((c) => c.name)), purpose: "research", userId: me.user_id, maxTokens: 1400 });
      if (!out.ok) throw new Error(out.error);
      const j = parseJsonLoose(out.text) || { summary: out.text };
      await db().from("research_items").update({ ai_result: { ...j, provider: out.provider, model: out.model, fallback: out.fallbackReason, note: "AI did not visit any URL; it only read the pasted text." }, ai_provider: out.provider, status: "processed" }).eq("id", id);
      await audit(me, "research.analyze", "research_item", id, { provider: out.provider });
      return `Analyzed by ${out.provider}. Review the suggestions before creating a product.`;
    }
    if (to === "dismiss") { await db().from("research_items").update({ status: "dismissed" }).eq("id", id); return "Dismissed."; }
    if (to === "delete") { await db().from("research_items").delete().eq("id", id); return "Deleted."; }
    if (to === "convert") {
      const ai = r.ai_result || {};
      let csv: Record<string, string> = {};
      if (r.kind === "csv") { try { csv = JSON.parse(r.raw_input); } catch {} }
      const title = (csv.title || ai.suggested_title || r.raw_input.split("\n")[0] || "Untitled product").slice(0, 150);
      if (title.length < 3) throw new Error("Could not find a title. Analyze first or edit the item.");
      let category_id: string | null = null;
      const catName = csv.category || ai.suggested_category;
      if (catName) { const { data: c } = await db().from("categories").select("id").ilike("name", catName).maybeSingle(); category_id = c?.id ?? null; }
      const slug = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`;
      const { data: p, error } = await db().from("products").insert({
        title, slug, category_id, brand: csv.brand || null, short_description: csv.short_description || null,
        full_description: ai.draft_description ? `${ai.draft_description}` : (csv.description || null),
        canonical_product_url: isHttpUrl(r.source_url) ? r.source_url : null,
        source_notes: `From research inbox (${r.kind}). ${ai.provider ? `AI draft by ${ai.provider} — verify every statement.` : ""}\nSourced facts: ${(ai.sourced_facts || []).join("; ") || "none"}\nMissing: ${(ai.missing_fields || []).join(", ") || "n/a"}`.slice(0, 3900),
        editorial_status: "draft", created_by: me.user_id,
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (isHttpUrl(r.image_url)) await db().from("product_images").insert({ product_id: p.id, url: r.image_url, alt_text: title });
      await db().from("research_items").update({ status: "converted", product_id: p.id }).eq("id", id);
      await audit(me, "research.convert", "product", p.id, { research: id });
      redirect(`/hq-autopilot-4x9/products/${p.id}?ok=${encodeURIComponent("Draft product created from research. Verify every field, add the affiliate URL, then submit for review.")}`);
    }
    throw new Error("Unknown action.");
  });
}

/* ------------------------------------------------------------------ social */
const CHANNEL_DISCLOSURE: Record<string, string> = {
  tiktok: "Affiliate link: I may earn a commission if you buy through my link, at no extra cost to you. #ad",
  instagram: "Affiliate link — I may earn a commission if you buy through it, at no extra cost to you.",
  facebook: "Disclosure: this post contains an affiliate link. The Universe Store may earn a commission if you buy through it, at no extra cost to you.",
};

export async function saveSocialPost(fd: FormData) {
  const id = optStr(fd, "id");
  await act(id ? `/social/${id}` : "/social", async () => {
    const me = await assertRole(["owner", "editor"]);
    const channel = str(fd, "channel");
    if (!["tiktok", "instagram", "facebook"].includes(channel)) throw new Error("Choose a channel.");
    const product_ids = fd.getAll("product_ids").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 5);
    let link_url = optStr(fd, "link_url");
    const campaign_id = optStr(fd, "campaign_id");
    if (!link_url && product_ids.length === 1) {
      const { data: p } = await db().from("products").select("slug").eq("id", product_ids[0]).single();
      const { data: c } = campaign_id ? await db().from("campaigns").select("utm_campaign").eq("id", campaign_id).single() : { data: null };
      if (p) link_url = `${siteUrl()}/p/${p.slug}?utm_source=${channel}&utm_medium=social${c?.utm_campaign ? `&utm_campaign=${encodeURIComponent(c.utm_campaign)}` : ""}`;
    }
    if (link_url && !isHttpUrl(link_url)) throw new Error("Link must be a valid URL.");
    const disclosure = str(fd, "disclosure") || ((link_url || product_ids.length) ? CHANNEL_DISCLOSURE[channel] : "");
    if ((link_url || product_ids.length) && disclosure.length < 15) throw new Error("Posts recommending products or containing links need a clear disclosure.");
    const caption = str(fd, "caption");
    if (/\b(guaranteed|100% original|best price ever|only \d+ left|selling out fast)\b/i.test(caption)) throw new Error("Remove unverifiable claims or fake-urgency phrases from the caption.");
    const sched = optStr(fd, "scheduled_for");
    const row: any = {
      channel, post_type: str(fd, "post_type") || "caption", caption, script: optStr(fd, "script"), hashtags: optStr(fd, "hashtags"),
      link_url, disclosure, media_notes: optStr(fd, "media_notes"), product_ids, campaign_id,
      scheduled_for: sched ? new Date(`${sched}:00+01:00`).toISOString() : null,
    };
    if (id) {
      const { data: cur } = await db().from("social_posts").select("status").eq("id", id).single();
      if (["published", "cancelled"].includes(cur?.status)) throw new Error("This post is closed and cannot be edited.");
      // any edit after approval sends it back for review: approval covers the exact final text only
      row.status = ["approved", "ready"].includes(cur?.status) ? "draft" : cur?.status;
      await db().from("social_posts").update(row).eq("id", id);
      await audit(me, "social.update", "social_post", id);
      return row.status === "draft" && ["approved", "ready"].includes(cur?.status) ? "Saved. Edited after approval, so it is back in Draft and needs re-approval." : "Saved.";
    }
    const { data, error } = await db().from("social_posts").insert({ ...row, created_by: me.user_id }).select("id").single();
    if (error) throw new Error(error.message);
    await audit(me, "social.create", "social_post", data.id);
    redirect(`/hq-autopilot-4x9/social/${data.id}?ok=Draft+post+created.`);
  });
}

export async function aiSocialPost(fd: FormData) {
  await act("/social", async () => {
    const me = await assertRole(["owner", "editor"]);
    const channel = str(fd, "channel"); const pid = str(fd, "product_id"); const kind = str(fd, "post_type") || "caption";
    if (!["tiktok", "instagram", "facebook"].includes(channel)) throw new Error("Choose a channel.");
    const facts = await productFacts([pid]);
    if (!facts.length) throw new Error("Choose a product.");
    if (!["approved", "published"].includes(String(facts[0].status))) throw new Error("Social copy can only be prepared from an approved product.");
    const out = await generate({
      system: GUARDRAILS, purpose: `social:${channel}:${kind}`, userId: me.user_id, maxTokens: 1200,
      user: `Prepare a ${channel} ${kind === "video_script" ? "30-45s short video script" : kind === "carousel" ? "carousel (5-7 slides)" : "post caption"} for this product. Channel style: ${channel === "tiktok" ? "short, spoken, hook first" : channel === "instagram" ? "visual, concise, line breaks" : "conversational, slightly longer"}. Never include prices unless supplied with a last-checked date, and then say "as last checked".
FACTS: ${JSON.stringify(facts[0])}
Respond JSON: {"caption": string, "script": string|null, "hashtags": string, "media_notes": string, "suggested_time_wat": string, "needs_human_verification": string[]}`,
    });
    if (!out.ok) throw new Error(out.error);
    const j = parseJsonLoose(out.text) || { caption: out.text };
    const { data: p } = await db().from("products").select("slug").eq("id", pid).single();
    const { data, error } = await db().from("social_posts").insert({
      channel, post_type: kind, caption: String(j.caption || "").slice(0, 2200), script: j.script || null, hashtags: j.hashtags || null,
      media_notes: [j.media_notes, j.suggested_time_wat && `Suggested time: ${j.suggested_time_wat}`, j.needs_human_verification?.length && `Verify: ${j.needs_human_verification.join("; ")}`].filter(Boolean).join("\n"),
      link_url: `${siteUrl()}/p/${p?.slug}?utm_source=${channel}&utm_medium=social`, disclosure: CHANNEL_DISCLOSURE[channel],
      product_ids: [pid], ai_provider: `${out.provider}/${out.model}`, created_by: me.user_id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await audit(me, "social.ai_draft", "social_post", data.id, { provider: out.provider, fallback: out.fallbackReason });
    redirect(`/hq-autopilot-4x9/social/${data.id}?ok=${encodeURIComponent(`Draft prepared by ${out.provider}. Nothing is posted automatically.`)}`);
  });
}

export async function socialTransition(fd: FormData) {
  const id = str(fd, "id"); const to = str(fd, "to"); const note = optStr(fd, "note");
  await act(str(fd, "back") || `/social/${id}`, async () => {
    const me = await assertRole(["approve", "reject", "request_changes", "ready", "published", "failed"].includes(to) ? ["owner"] : ["owner", "editor"]);
    const { data: s } = await db().from("social_posts").select("*").eq("id", id).single();
    if (!s) throw new Error("Post not found.");
    const set = (patch: any) => db().from("social_posts").update(patch).eq("id", id);
    const decide = (status: string) => db().from("approval_items").update({ status, decided_by: me.user_id, decided_at: new Date().toISOString(), reviewer_notes: note }).eq("entity_type", "social_post").eq("entity_id", id).eq("status", "pending");
    switch (to) {
      case "submit": if (s.status !== "draft") throw new Error("Only drafts can be submitted."); await set({ status: "needs_review" }); await db().from("approval_items").insert({ entity_type: "social_post", entity_id: id, title: `${s.channel}: ${s.caption.slice(0, 60)}`, snapshot: s, submitted_by: me.user_id }); break;
      case "approve": if (s.status !== "needs_review") throw new Error("Only posts in review can be approved."); if (fd.get("confirm") !== "on") throw new Error("Tick the box confirming you reviewed the exact text, link, disclosure and time."); await decide("approved"); await set({ status: "approved" }); break;
      case "reject": case "request_changes": if (s.status !== "needs_review") throw new Error("Only posts in review can be rejected."); await decide(to === "reject" ? "rejected" : "changes_requested"); await set({ status: "draft" }); break;
      case "ready": if (s.status !== "approved") throw new Error("Approve first."); await set({ status: "ready" }); break;
      case "published": if (!["approved", "ready"].includes(s.status)) throw new Error("Only approved posts can be marked published."); if (fd.get("confirm") !== "on") throw new Error("Confirm that you published it yourself on the platform."); await set({ status: "published", published_confirmed_at: new Date().toISOString(), published_confirmed_by: me.user_id, published_url: optStr(fd, "published_url") }); break;
      case "failed": await set({ status: "failed" }); break;
      case "cancel": await set({ status: "cancelled" }); break;
      case "reopen": if (!["failed", "cancelled"].includes(s.status)) throw new Error("Only failed/cancelled posts can be reopened."); await set({ status: "draft" }); break;
      case "delete": if (!["draft", "cancelled", "failed"].includes(s.status)) throw new Error("Cancel first."); await db().from("social_posts").delete().eq("id", id); await audit(me, "social.delete", "social_post", id); redirect("/hq-autopilot-4x9/social?ok=Post+deleted.");
      default: throw new Error("Unknown action.");
    }
    await audit(me, `social.${to}`, "social_post", id, { note });
    return to === "published" ? "Marked as Published (confirmed by you)." : "Updated.";
  });
}

export async function saveCampaign(fd: FormData) {
  await act("/social", async () => {
    const me = await assertRole(["owner", "editor"]);
    const name = str(fd, "name"); if (name.length < 2) throw new Error("Campaign name is required.");
    const row = { name, concept: optStr(fd, "concept"), utm_campaign: slugify(str(fd, "utm_campaign") || name), start_date: optStr(fd, "start_date"), end_date: optStr(fd, "end_date"), status: str(fd, "status") || "draft" };
    const id = optStr(fd, "id");
    const { error } = id ? await db().from("campaigns").update(row).eq("id", id) : await db().from("campaigns").insert({ ...row, created_by: me.user_id });
    if (error) throw new Error(error.message);
    await audit(me, id ? "campaign.update" : "campaign.create", "campaign", id || name);
    return "Campaign saved.";
  });
}

/* ------------------------------------------------------------------ approvals (generic entry) */
export async function decideApproval(fd: FormData) {
  const entity = str(fd, "entity_type");
  if (entity === "product") { const { productTransition } = await import("./catalog-actions"); return productTransition(fd); }
  if (entity === "guide") { const { guideTransition } = await import("./catalog-actions"); return guideTransition(fd); }
  if (entity === "content_draft") return draftAction(fd);
  if (entity === "social_post") return socialTransition(fd);
  await act("/approvals", async () => { throw new Error("Unknown item type."); });
}
