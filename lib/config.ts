export const ADMIN_PATH = "/hq-autopilot-4x9";
export const SCHEMA = "universe_store";
export const SITE_NAME = "THE UNIVERSE STORE";
export const TAGLINE = "Everything Worth Discovering.";

export function siteUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return u.replace(/\/$/, "");
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export const PRODUCT_STATUSES = ["draft", "pending", "approved", "published", "rejected", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", pending: "Pending review", approved: "Approved", published: "Published",
  rejected: "Rejected (back in drafts)", archived: "Archived", needs_review: "Needs review",
  ready: "Ready to publish", failed: "Failed", cancelled: "Cancelled", changes_requested: "Changes requested",
  unverified: "Awaiting verification", verified: "Verified by owner", disabled: "Disabled", broken: "Reported broken",
};
export const SOCIAL_STATUS_LABEL: Record<string, string> = {
  draft: "Draft", needs_review: "Needs Review", approved: "Approved", ready: "Ready to Publish",
  published: "Published (confirmed)", failed: "Failed", cancelled: "Cancelled",
};
export type Role = "owner" | "editor" | "analyst";
