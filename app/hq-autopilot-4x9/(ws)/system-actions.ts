"use server";
import { adminDb } from "@/lib/supabase/clients";
import { assertRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { act, revalidatePublic } from "@/lib/admin";
import { optStr, str, isHttpUrl, parseCsv, slugify } from "@/lib/util";
import { encrypt } from "@/lib/crypto";
import { testProvider, generate, DEFAULT_PRIORITY, type ProviderId } from "@/lib/ai/providers";
import { loadDemo, removeDemo, ensureStarterCategories } from "@/lib/demo";
import { runJob } from "@/lib/automations";
import { screenProduct } from "@/lib/safety";

const db = () => adminDb();
/* Upsert so a setting saves even if its row was never seeded (e.g. a key
   added after the first migration run). Only value/updated_by are touched. */
const setSetting = (key: string, value: unknown, uid: string) => db().from("site_settings").upsert({ key, value, updated_by: uid }, { onConflict: "key" });

export async function saveSettings(fd: FormData) {
  await act("/settings", async () => {
    const me = await assertRole(["owner"]);
    const email = optStr(fd, "contact_email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Contact email is not valid.");
    const social: Record<string, string | null> = {};
    for (const k of ["tiktok", "instagram", "facebook"]) {
      const v = optStr(fd, `social_${k}`);
      if (v && !isHttpUrl(v)) throw new Error(`${k} link must be a full URL.`);
      social[k] = v;
    }
    const disclosure = str(fd, "affiliate_disclosure");
    if (disclosure.length < 40) throw new Error("The affiliate disclosure must be a clear sentence (40+ characters).");
    const cur = str(fd, "currency_display").toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) throw new Error("Currency must be a 3-letter code.");
    const retention = Number(str(fd, "analytics_retention_days"));
    if (!(retention >= 30 && retention <= 730)) throw new Error("Retention must be between 30 and 730 days.");
    const aliId = optStr(fd, "aliexpress_tracking_id");
    if (aliId && !/^[A-Za-z0-9_-]{3,64}$/.test(aliId)) throw new Error("AliExpress tracking ID looks wrong — paste the ID exactly as the AliExpress portal shows it.");
    await Promise.all([
      setSetting("site_title", str(fd, "site_title") || "THE UNIVERSE STORE", me.user_id),
      setSetting("tagline", str(fd, "tagline") || "Everything Worth Discovering.", me.user_id),
      setSetting("contact_email", email, me.user_id),
      setSetting("social_links", social, me.user_id),
      setSetting("affiliate_disclosure", disclosure, me.user_id),
      setSetting("currency_display", cur, me.user_id),
      setSetting("supported_regions", str(fd, "supported_regions").split(",").map((x) => x.trim()).filter(Boolean), me.user_id),
      setSetting("default_locale", str(fd, "default_locale") || "en-NG", me.user_id),
      setSetting("analytics_retention_days", retention, me.user_id),
      setSetting("automation_enabled", fd.get("automation_enabled") === "on", me.user_id),
      setSetting("aliexpress_tracking_id", aliId || null, me.user_id),
    ]);
    await audit(me, "settings.update", "site_settings");
    revalidatePublic();
    return "Settings saved.";
  });
}

export async function teamAction(fd: FormData) {
  await act("/settings", async () => {
    const me = await assertRole(["owner"]);
    const to = str(fd, "to");
    if (to === "invite") {
      const email = str(fd, "email").toLowerCase(); const role = str(fd, "role");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
      if (!["owner", "editor", "analyst"].includes(role)) throw new Error("Choose a role.");
      const { error } = await db().from("members").insert({ email, role });
      if (error) throw new Error(error.message.includes("duplicate") ? "That email is already a member." : error.message);
      await audit(me, "team.invite", "member", email, { role });
      return `Invited ${email} as ${role}. They sign in at the admin login with their own password (or create one at sign-up), then you confirm their request here.`;
    }
    const id = str(fd, "id");
    const { data: m } = await db().from("members").select("*").eq("id", id).single();
    if (!m) throw new Error("Member not found.");
    if (m.user_id === me.user_id && to !== "role") throw new Error("You cannot deactivate yourself.");
    if (to === "confirm") { if (!m.pending_user_id) throw new Error("No pending request."); await db().from("members").update({ user_id: m.pending_user_id, pending_user_id: null }).eq("id", id); }
    else if (to === "deny") await db().from("members").update({ pending_user_id: null, pending_requested_at: null }).eq("id", id);
    else if (to === "role") {
      const role = str(fd, "role");
      if (m.role === "owner" && role !== "owner") { const { count } = await db().from("members").select("id", { count: "exact", head: true }).eq("role", "owner").eq("active", true); if ((count ?? 0) <= 1) throw new Error("There must be at least one active Owner."); }
      await db().from("members").update({ role }).eq("id", id);
    }
    else if (to === "toggle") await db().from("members").update({ active: !m.active }).eq("id", id);
    else if (to === "remove") await db().from("members").delete().eq("id", id);
    else throw new Error("Unknown action.");
    await audit(me, `team.${to}`, "member", m.email);
    return "Team updated.";
  });
}

export async function demoAction(fd: FormData) {
  await act("/settings", async () => {
    const me = await assertRole(["owner"]);
    const to = str(fd, "to");
    if (to === "remove") { const r = await removeDemo(); await audit(me, "demo.remove", "demo", undefined, r); revalidatePublic(); return `Removed ${r.products} demo product(s) and ${r.guides} demo guide(s), plus demo analytics.`; }
    if (to === "load") { await loadDemo(me.user_id); await audit(me, "demo.load", "demo"); revalidatePublic(); return "Demo products loaded (clearly labelled “Demo”, no prices or links)."; }
    if (to === "categories") { await ensureStarterCategories(); revalidatePublic(); return "Starter categories ensured."; }
    throw new Error("Unknown action.");
  });
}

/* ------------------------------------------------------------------ AI integrations */
export async function providerAction(fd: FormData) {
  await act("/integrations", async () => {
    const to = str(fd, "to"); const provider = str(fd, "provider") as ProviderId;
    if (!DEFAULT_PRIORITY.includes(provider) && to !== "priority") throw new Error("Unknown provider.");
    if (to === "test") {
      const me = await assertRole(["owner", "editor"]);
      const r = await testProvider(provider);
      await db().from("ai_runs").insert({ provider, model: r.model ?? null, purpose: "connection_test", status: r.status === "Connected" ? "success" : r.status === "Rate limited" ? "rate_limited" : r.status === "Not configured" ? "skipped" : "error", error: r.status === "Connected" ? null : r.detail, latency_ms: r.latencyMs ?? null, created_by: me.user_id });
      return `${r.name}: ${r.status}. ${r.detail}${r.latencyMs ? ` (${r.latencyMs} ms)` : ""}`;
    }
    const me = await assertRole(["owner"]);
    if (to === "save_key") {
      const key = str(fd, "key");
      if (key.length < 12) throw new Error("Paste the full API key.");
      const base_url = optStr(fd, "base_url");
      if (base_url && !(isHttpUrl(base_url) && base_url.startsWith("https://"))) throw new Error("Base URL must be https://");
      const { error } = await db().from("provider_secrets").upsert({ provider, ciphertext: encrypt(key), base_url, model: optStr(fd, "model"), last4: key.slice(-4), updated_by: me.user_id });
      if (error) throw new Error(error.message);
      await audit(me, "ai.key_saved", "provider", provider);
      const r = await testProvider(provider);
      return `Key saved (encrypted). Connection test: ${r.status}. ${r.detail}`;
    }
    if (to === "remove_key") { await db().from("provider_secrets").delete().eq("provider", provider); await audit(me, "ai.key_removed", "provider", provider); return "Stored key removed. (Keys set as server environment variables are not affected.)"; }
    if (to === "priority") {
      const order = str(fd, "order").split(",").map((x) => x.trim()).filter((x): x is ProviderId => DEFAULT_PRIORITY.includes(x as ProviderId));
      const uniq = [...new Set(order)];
      if (uniq.length !== DEFAULT_PRIORITY.length) throw new Error(`List every provider once: ${DEFAULT_PRIORITY.join(", ")}`);
      await setSetting("ai_provider_priority", uniq, me.user_id);
      await audit(me, "ai.priority", "settings", undefined, uniq);
      return `Priority saved: ${uniq.join(" → ")}`;
    }
    throw new Error("Unknown action.");
  });
}

export async function playground(fd: FormData) {
  await act("/integrations", async () => {
    const me = await assertRole(["owner", "editor"]);
    const prompt = str(fd, "prompt").slice(0, 1000);
    if (prompt.length < 3) throw new Error("Type a short prompt.");
    const provider = str(fd, "provider");
    const out = await generate({ system: "You are a concise assistant for an affiliate product site. Never invent product facts.", user: prompt, purpose: "playground", userId: me.user_id, only: DEFAULT_PRIORITY.includes(provider as ProviderId) ? (provider as ProviderId) : undefined, maxTokens: 400 });
    if (!out.ok) throw new Error(out.error);
    return `[${out.provider} / ${out.model}${out.fallbackReason ? ` — fallback: ${out.fallbackReason}` : ""}] ${out.text.slice(0, 700)}`;
  });
}

export async function socialAccountAction(fd: FormData) {
  await act("/integrations", async () => {
    const me = await assertRole(["owner"]);
    const channel = str(fd, "channel");
    const profile_url = optStr(fd, "profile_url");
    if (profile_url && !isHttpUrl(profile_url)) throw new Error("Profile URL must be a full URL.");
    await db().from("social_accounts").update({ handle: optStr(fd, "handle"), profile_url, notes: optStr(fd, "notes") }).eq("channel", channel);
    await audit(me, "social_account.update", "social_account", channel);
    return "Saved. Publishing stays manual (copy/export) — no platform access is connected.";
  });
}

/* ------------------------------------------------------------------ automations */
export async function automationAction(fd: FormData) {
  await act("/automations", async () => {
    const to = str(fd, "to"); const key = str(fd, "key");
    if (to === "run") { const me = await assertRole(["owner", "editor"]); const r = await runJob(key, me.user_id); await audit(me, "automation.run", "automation", key, r); return `${key}: ${r.status} — ${r.summary}`; }
    const me = await assertRole(["owner"]);
    if (to === "toggle") { const { data: j } = await db().from("automation_jobs").select("enabled").eq("key", key).single(); await db().from("automation_jobs").update({ enabled: !j?.enabled }).eq("key", key); await audit(me, "automation.toggle", "automation", key, { enabled: !j?.enabled }); return "Automation updated."; }
    if (to === "cancel") { await db().from("automation_logs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("job_key", key).eq("status", "running"); return "Running entries cancelled."; }
    throw new Error("Unknown action.");
  });
}

/* ------------------------------------------------------------------ import */
export async function importProducts(fd: FormData) {
  await act("/data", async () => {
    const me = await assertRole(["owner", "editor"]);
    const file = fd.get("file");
    let text = str(fd, "csv");
    if (file && typeof file === "object" && "text" in file && (file as File).size > 0) {
      if ((file as File).size > 1_000_000) throw new Error("File too large (max 1 MB).");
      text = await (file as File).text();
    }
    if (!text) throw new Error("Choose a CSV file or paste CSV text.");
    let rows: Record<string, string>[] = [];
    if (text.trim().startsWith("[")) { try { rows = JSON.parse(text); } catch { throw new Error("Invalid JSON."); } }
    else rows = parseCsv(text);
    if (!rows.length) throw new Error("No rows found. The first line must be a header (title, short_description, category, brand, retailer_name, affiliate_url, …).");
    const { data: cats } = await db().from("categories").select("id,name,slug");
    let created = 0; const skipped: string[] = [];
    for (const [i, r] of rows.slice(0, 500).entries()) {
      const title = String(r.title || "").trim();
      if (title.length < 3) { skipped.push(`row ${i + 2}: missing title`); continue; }
      if (screenProduct(`${title} ${r.short_description || ""}`).blocked.length) { skipped.push(`row ${i + 2}: prohibited category`); continue; }
      const slug = slugify(r.slug || title);
      const { data: dup } = await db().from("products").select("id").or(`slug.eq.${slug}`).maybeSingle();
      if (dup) { skipped.push(`row ${i + 2}: duplicate slug ${slug}`); continue; }
      const cat = cats?.find((c) => c.slug === r.category || c.name.toLowerCase() === String(r.category || "").toLowerCase());
      const price = r.displayed_price ? Number(String(r.displayed_price).replace(/,/g, "")) : null;
      const priceOk = price !== null && Number.isFinite(price) && /^[A-Z]{3}$/.test(String(r.currency || "")) && !!r.price_checked_at;
      const { data: p, error } = await db().from("products").insert({
        title: title.slice(0, 160), slug, short_description: r.short_description || null, full_description: r.full_description || null, category_id: cat?.id ?? null,
        brand: r.brand || null, retailer_name: r.retailer_name || "AliExpress", canonical_product_url: isHttpUrl(r.canonical_product_url) ? r.canonical_product_url : null,
        displayed_price: priceOk ? price : null, currency: priceOk ? r.currency : null, price_checked_at: priceOk ? r.price_checked_at : null,
        tags: String(r.tags || "").split(/[,;|]/).map((t) => t.trim().toLowerCase()).filter(Boolean), source_notes: `Imported ${new Date().toISOString().slice(0, 10)}. ${r.source_notes || ""}`.trim(),
        editorial_status: "draft", created_by: me.user_id,
      }).select("id").single();
      if (error) { skipped.push(`row ${i + 2}: ${error.message}`); continue; }
      if (isHttpUrl(r.affiliate_url)) {
        const { error: le } = await db().from("affiliate_links").insert({ product_id: p.id, url: r.affiliate_url, retailer: r.retailer_name || "AliExpress" });
        if (le) skipped.push(`row ${i + 2}: link not attached (${le.message.includes("duplicate") ? "duplicate URL" : le.message})`);
      }
      created++;
    }
    await audit(me, "import.products", "product", undefined, { created, skipped: skipped.length });
    return `Imported ${created} product(s) as drafts (links unverified).${skipped.length ? ` Skipped/notes: ${skipped.slice(0, 8).join("; ")}${skipped.length > 8 ? "…" : ""}` : ""}`;
  });
}

export async function messageAction(fd: FormData) {
  await act("/messages", async () => {
    const me = await assertRole(["owner", "editor"]);
    const id = str(fd, "id"); const to = str(fd, "to");
    if (to === "delete") await db().from("contact_messages").delete().eq("id", id);
    else await db().from("contact_messages").update({ status: to === "resolved" ? "resolved" : "read" }).eq("id", id);
    await audit(me, `message.${to}`, "contact_message", id);
    return "Updated.";
  });
}
