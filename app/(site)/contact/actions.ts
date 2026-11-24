"use server";
import { headers } from "next/headers";
import { adminDb } from "@/lib/supabase/clients";
import { hashIp } from "@/lib/crypto";

export type ContactState = { ok?: boolean; error?: string; fields?: Record<string, string> };

export async function submitContact(_: ContactState, fd: FormData): Promise<ContactState> {
  const kind = String(fd.get("kind") || "contact");
  const name = String(fd.get("name") || "").trim().slice(0, 120);
  const email = String(fd.get("email") || "").trim().slice(0, 200);
  const message = String(fd.get("message") || "").trim();
  const productSlug = String(fd.get("product") || "").trim().slice(0, 120);
  const fields = { kind, name, email, message, product: productSlug };
  if (String(fd.get("website") || "")) return { ok: true }; // honeypot: silently accept bots
  const started = Number(fd.get("t") || 0);
  if (started && Date.now() - started < 2500) return { error: "That was very fast — please try again.", fields };
  if (!["contact", "broken_link", "incorrect_info"].includes(kind)) return { error: "Choose a message type.", fields };
  if (message.length < 5) return { error: "Please write a message (at least 5 characters).", fields };
  if (message.length > 4000) return { error: "Message is too long (max 4,000 characters).", fields };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email address doesn't look right.", fields };
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const db = adminDb();
    const { data: allowed } = await db.rpc("hit_rate_limit", { p_key: `contact:${hashIp(ip)}`, p_limit: 5, p_window_seconds: 3600 });
    if (allowed === false) return { error: "Too many messages from your connection. Please try again later.", fields };
    let product_id: string | null = null;
    if (productSlug) { const { data } = await db.from("products").select("id").eq("slug", productSlug).maybeSingle(); product_id = data?.id ?? null; }
    const { error } = await db.from("contact_messages").insert({ kind, name: name || null, email: email || null, message, product_id });
    if (error) throw error;
    return { ok: true };
  } catch {
    return { error: "We couldn't send your message right now. Please try again in a moment.", fields };
  }
}
