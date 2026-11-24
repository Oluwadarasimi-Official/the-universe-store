import "server-only";
import { adminDb } from "@/lib/supabase/clients";
import { decrypt } from "@/lib/crypto";

export type ProviderId = "darax" | "gemini" | "groq" | "openrouter";
export const PROVIDERS: { id: ProviderId; name: string; envKey: string; defaultModel: string; note: string }[] = [
  { id: "darax", name: "DARAX API", envKey: "DARAX_API_KEY", defaultModel: "", note: "Owner's own OpenAI-compatible API. Needs DARAX_API_KEY + DARAX_API_BASE_URL (+ DARAX_MODEL)." },
  { id: "gemini", name: "Google Gemini", envKey: "GEMINI_API_KEY", defaultModel: "gemini-3.5-flash", note: "Google AI Studio free tier key." },
  { id: "groq", name: "Groq", envKey: "GROQ_API_KEY", defaultModel: "openai/gpt-oss-20b", note: "Groq free tier (rate limited per minute/day)." },
  { id: "openrouter", name: "OpenRouter", envKey: "OPENROUTER_API_KEY", defaultModel: "openrouter/free", note: "OpenRouter free models (:free / openrouter/free router)." },
];
export const DEFAULT_PRIORITY: ProviderId[] = ["darax", "gemini", "groq", "openrouter"];

export type ProviderCreds = { key: string; baseUrl?: string | null; model: string; source: "env" | "admin" };

export async function getCreds(id: ProviderId): Promise<ProviderCreds | null> {
  const meta = PROVIDERS.find((p) => p.id === id)!;
  const envKey = process.env[meta.envKey];
  const envModel = process.env[`${id.toUpperCase()}_MODEL`];
  const envBase = id === "darax" ? process.env.DARAX_API_BASE_URL : null;
  if (envKey) return { key: envKey, baseUrl: envBase, model: envModel || meta.defaultModel, source: "env" };
  try {
    const { data } = await adminDb().from("provider_secrets").select("ciphertext,base_url,model").eq("provider", id).maybeSingle();
    if (data?.ciphertext) return { key: decrypt(data.ciphertext), baseUrl: data.base_url, model: data.model || envModel || meta.defaultModel, source: "admin" };
  } catch { /* missing encryption key or table: treat as not configured */ }
  return null;
}

export class ProviderError extends Error {
  constructor(public kind: "rate_limited" | "error" | "not_configured", msg: string) { super(msg); }
}

type Msg = { role: "system" | "user"; content: string };

async function openAiCompatible(base: string, creds: ProviderCreds, messages: Msg[], maxTokens: number, extraHeaders: Record<string, string> = {}) {
  const extra = /gpt-oss/.test(creds.model) && base.includes("groq") ? { reasoning_effort: "low" } : {};
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.key}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ model: creds.model, messages, max_tokens: maxTokens, temperature: 0.4, ...extra }),
    signal: AbortSignal.timeout(45000),
  });
  if (res.status === 429) throw new ProviderError("rate_limited", "Rate limited (HTTP 429)");
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ProviderError("error", `HTTP ${res.status}: ${String(j?.error?.message || j?.message || "request failed").slice(0, 200)}`);
  const text = j?.choices?.[0]?.message?.content;
  if (!text) throw new ProviderError("error", "Empty response from model");
  return { text: String(text), model: String(j.model || creds.model) };
}

async function gemini(creds: ProviderCreds, messages: Msg[], maxTokens: number) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const user = messages.filter((m) => m.role === "user").map((m) => ({ role: "user", parts: [{ text: m.content }] }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(creds.model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": creds.key },
    body: JSON.stringify({ systemInstruction: sys ? { parts: [{ text: sys }] } : undefined, contents: user, generationConfig: { maxOutputTokens: Math.max(maxTokens * 3, 2048), temperature: 0.4, ...(/Respond( with)? JSON/i.test(messages.map((m) => m.content).join(" ")) ? { responseMimeType: "application/json" } : {}) } }),
    signal: AbortSignal.timeout(50000),
  });
  if (res.status === 429) throw new ProviderError("rate_limited", "Rate limited (HTTP 429)");
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ProviderError("error", `HTTP ${res.status}: ${String(j?.error?.message || "request failed").slice(0, 200)}`);
  const text = j?.candidates?.[0]?.content?.parts?.filter((p: any) => !p.thought).map((p: any) => p.text || "").join("") || "";
  if (!text) throw new ProviderError("error", "Empty response from model");
  return { text, model: creds.model };
}

export async function callProvider(id: ProviderId, messages: Msg[], maxTokens = 1200): Promise<{ text: string; model: string }> {
  const creds = await getCreds(id);
  if (!creds) throw new ProviderError("not_configured", "Not configured");
  switch (id) {
    case "groq": return openAiCompatible("https://api.groq.com/openai/v1", creds, messages, maxTokens);
    case "openrouter": return openAiCompatible("https://openrouter.ai/api/v1", creds, messages, maxTokens, { "X-Title": "The Universe Store" });
    case "gemini": return gemini(creds, messages, maxTokens);
    case "darax":
      if (!creds.baseUrl) throw new ProviderError("not_configured", "DARAX_API_BASE_URL is not set");
      if (!creds.model) throw new ProviderError("not_configured", "DARAX_MODEL is not set");
      return openAiCompatible(creds.baseUrl, creds, messages, maxTokens);
  }
}

export type ProviderStatus = { id: ProviderId; name: string; status: "Connected" | "Not configured" | "Error" | "Rate limited"; detail: string; model?: string; source?: string; latencyMs?: number };

/* Real connection test: a tiny completion request. */
export async function testProvider(id: ProviderId): Promise<ProviderStatus> {
  const meta = PROVIDERS.find((p) => p.id === id)!;
  const creds = await getCreds(id);
  if (!creds) return { id, name: meta.name, status: "Not configured", detail: `Set ${meta.envKey} on the server or paste a key below.` };
  const t = Date.now();
  try {
    await callProvider(id, [{ role: "user", content: "Reply with the single word OK." }], 200);
    return { id, name: meta.name, status: "Connected", detail: "Test request succeeded.", model: creds.model, source: creds.source, latencyMs: Date.now() - t };
  } catch (e: any) {
    const kind = e instanceof ProviderError ? e.kind : "error";
    return { id, name: meta.name, status: kind === "rate_limited" ? "Rate limited" : kind === "not_configured" ? "Not configured" : "Error", detail: String(e?.message || e).slice(0, 240), model: creds.model, source: creds.source };
  }
}

export async function getPriority(): Promise<ProviderId[]> {
  const { data } = await adminDb().from("site_settings").select("value").eq("key", "ai_provider_priority").maybeSingle();
  const v = Array.isArray(data?.value) ? (data!.value as string[]) : DEFAULT_PRIORITY;
  const valid = v.filter((x): x is ProviderId => DEFAULT_PRIORITY.includes(x as ProviderId));
  for (const p of DEFAULT_PRIORITY) if (!valid.includes(p)) valid.push(p);
  return valid;
}

/* Generate with fallback. Each provider is tried at most once (no retry loops).
   Every attempt is logged to ai_runs with the fallback reason. */
export async function generate(opts: { system: string; user: string; purpose: string; userId?: string; only?: ProviderId; maxTokens?: number }) {
  const order = opts.only ? [opts.only] : await getPriority();
  const reasons: string[] = [];
  const db = adminDb();
  for (const id of order) {
    const t = Date.now();
    try {
      const out = await callProvider(id, [{ role: "system", content: opts.system }, { role: "user", content: opts.user }], opts.maxTokens ?? 1400);
      await db.from("ai_runs").insert({ provider: id, model: out.model, purpose: opts.purpose, status: "success", fallback_reason: reasons.join(" | ") || null, latency_ms: Date.now() - t, created_by: opts.userId ?? null });
      return { ok: true as const, provider: id, model: out.model, text: out.text, fallbackReason: reasons.join(" | ") || null };
    } catch (e: any) {
      const kind = e instanceof ProviderError ? e.kind : "error";
      const msg = `${id}: ${kind === "not_configured" ? "not configured" : String(e?.message || e).slice(0, 160)}`;
      reasons.push(msg);
      if (kind !== "not_configured") {
        await db.from("ai_runs").insert({ provider: id, status: kind === "rate_limited" ? "rate_limited" : "error", purpose: opts.purpose, error: msg, latency_ms: Date.now() - t, created_by: opts.userId ?? null });
      }
    }
  }
  return { ok: false as const, error: `No AI provider produced a draft. ${reasons.join(" | ")}`, reasons };
}
