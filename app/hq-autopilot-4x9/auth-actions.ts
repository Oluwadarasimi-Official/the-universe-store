"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual, createHash } from "crypto";
import { adminDb, authClient } from "@/lib/supabase/clients";
import { hashIp } from "@/lib/crypto";
import { ADMIN_PATH } from "@/lib/config";
import { audit } from "@/lib/audit";

async function limited(key: string, limit: number, windowSec: number) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data } = await adminDb().rpc("hit_rate_limit", { p_key: `${key}:${hashIp(ip)}`, p_limit: limit, p_window_seconds: windowSec });
  return data === false;
}
const fail = (path: string, msg: string): never => redirect(`${ADMIN_PATH}/${path}?err=${encodeURIComponent(msg)}`);

export async function signIn(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  if (!email || !password) fail("login", "Enter your email and password.");
  if (await limited("login", 8, 900)) fail("login", "Too many sign-in attempts. Wait 15 minutes and try again.");
  const sb = await authClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail("login", "Email or password is incorrect.");
  const db = adminDb();
  const { data: m } = await db.from("members").select("id,role,active,user_id").eq("user_id", data.user!.id).maybeSingle();
  if (!m || !m.active) {
    await sb.auth.signOut();
    const { data: inv } = await db.from("members").select("id").eq("email", email).is("user_id", null).eq("active", true).maybeSingle();
    if (inv) {
      await db.from("members").update({ pending_user_id: data.user!.id, pending_requested_at: new Date().toISOString() }).eq("id", inv.id);
      fail("login", "Access request sent. Ask the Owner to confirm it in Settings → Team, then sign in again.");
    }
    fail("login", "This account does not have access to Universe Autopilot. Ask the Owner to invite you.");
  }
  await audit({ id: m!.id, user_id: data.user!.id, email, role: m!.role }, "auth.sign_in");
  redirect(ADMIN_PATH);
}

export async function signOut() {
  const sb = await authClient();
  await sb.auth.signOut();
  redirect(`${ADMIN_PATH}/login?ok=${encodeURIComponent("You have been signed out.")}`);
}

function tokenOk(given: string) {
  const want = process.env.ADMIN_SETUP_TOKEN || "";
  if (want.length < 24) return false;
  const a = createHash("sha256").update(given).digest(), b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

/* One-time first-owner setup. Requires ADMIN_SETUP_TOKEN (server env) and only works while
   no owner exists. No default password anywhere. */
export async function claimOwner(fd: FormData) {
  const token = String(fd.get("token") || "");
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const confirm = String(fd.get("confirm") || "");
  if (await limited("setup", 5, 3600)) fail("setup", "Too many attempts. Try again in an hour.");
  const db = adminDb();
  const { count } = await db.from("members").select("id", { count: "exact", head: true }).eq("role", "owner");
  if ((count ?? 0) > 0) fail("login", "Setup is already complete. Sign in instead.");
  if (!tokenOk(token)) fail("setup", "The setup token is incorrect.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("setup", "Enter a valid email address.");
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) fail("setup", "Use at least 12 characters with upper-case, lower-case and a number.");
  if (password !== confirm) fail("setup", "Passwords do not match.");

  const sb = await authClient();
  // The Supabase project's Auth may be shared with another app. If this email already has an
  // account there, the person must sign in with that account's existing password.
  let userId: string | null = null;
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { app: "universe_store" } });
  if (created.data?.user) userId = created.data.user.id;
  const { data: si, error: siErr } = await sb.auth.signInWithPassword({ email, password });
  if (siErr || !si.user) {
    fail("setup", created.error ? "An account with this email already exists in the shared login system. Enter that account's existing password." : "Account created but sign-in failed. Try signing in.");
  }
  userId = si.user!.id;
  const { error } = await db.from("members").insert({ user_id: userId, email, role: "owner" });
  if (error) fail("setup", "Could not create the owner membership.");
  await audit({ id: "", user_id: userId!, email, role: "owner" }, "setup.owner_claimed");
  redirect(`${ADMIN_PATH}?ok=${encodeURIComponent("Welcome! You are the Owner. Remove ADMIN_SETUP_TOKEN from Vercel when convenient.")}`);
}
