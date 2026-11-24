export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

export function isHttpUrl(u?: string | null): boolean {
  if (!u) return false;
  try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:"; } catch { return false; }
}

export function hostOf(u?: string | null): string | null {
  try { return u ? new URL(u).hostname.replace(/^www\./, "") : null; } catch { return null; }
}

/* The store's AliExpress affiliate tracking ID — the account's only ID,
   verified live in the AliExpress Affiliate portal (Account → Tracking ID)
   on 24 Nov 2026: named "default", created 2026/11/24, marked Default.
   Used as the fallback wherever the site_settings value is missing; the
   Owner can override it in Admin → Settings, which always wins. */
export const ALIEXPRESS_TRACKING_ID_DEFAULT = "default";

export function isAliExpressHost(u?: string | null): boolean {
  const h = hostOf(u);
  return !!h && /(^|\.)aliexpress\.com$/.test(h);
}

/* The store's affiliate retailer, detected from a link's host. */
export function retailerOfHost(h?: string | null): "AliExpress" | null {
  if (!h) return null;
  if (/(^|\.)aliexpress\.com$/.test(h)) return "AliExpress";
  return null;
}

export function formatPrice(amount?: number | string | null, currency?: string | null): string | null {
  if (amount === null || amount === undefined || amount === "" || !currency) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  try { return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
  catch { return `${currency} ${n.toLocaleString()}`; }
}

export function fmtDate(d?: string | null, withTime = false): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }) + (withTime ? " WAT" : "");
}

export function daysAgo(d?: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export function str(fd: FormData, k: string): string { return String(fd.get(k) ?? "").trim(); }
export function optStr(fd: FormData, k: string): string | null { const v = str(fd, k); return v ? v : null; }

export function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  return [cols.join(","), ...rows.map((r) => cols.map((c) => escapeCsv(r[c])).join(","))].join("\n");
}

/* Minimal RFC4180 CSV parser. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = ""; if (row.some((c) => c !== "")) rows.push(row); row = [];
    } else cur += ch;
  }
  row.push(cur); if (row.some((c) => c !== "")) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}
