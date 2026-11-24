import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminDb, authClient } from "@/lib/supabase/clients";
import { ADMIN_PATH, type Role } from "@/lib/config";

export type Member = { id: string; user_id: string; email: string; role: Role };

/* Returns the signed-in Supabase user and their universe_store membership (or null).
   Membership is the ONLY thing that grants store-admin rights: other apps sharing the
   same Supabase Auth get nothing here. */
export const getMember = cache(async (): Promise<{ userId: string; email: string; member: Member | null } | null> => {
  const sb = await authClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  const email = (data.user.email || "").toLowerCase();
  const db = adminDb();
  // Only an Owner-confirmed link (members.user_id) grants access. Matching emails never auto-link.
  const { data: m } = await db.from("members").select("id,user_id,email,role,active").eq("user_id", data.user.id).maybeSingle();
  const member = m && m.active ? ({ id: m.id, user_id: data.user.id, email: m.email, role: m.role } as Member) : null;
  return { userId: data.user.id, email, member };
});

export async function requireRole(roles: Role[] = ["owner", "editor", "analyst"]): Promise<Member> {
  const s = await getMember();
  if (!s) redirect(`${ADMIN_PATH}/login`);
  if (!s.member) redirect(`${ADMIN_PATH}/login?e=no_access`);
  if (!roles.includes(s.member.role)) redirect(`${ADMIN_PATH}?e=forbidden`);
  return s.member;
}

/* For server actions: throws instead of redirecting so the action fails closed. */
export async function assertRole(roles: Role[]): Promise<Member> {
  const s = await getMember();
  if (!s?.member) throw new Error("Not signed in or no store access.");
  if (!roles.includes(s.member.role)) throw new Error("Your role does not allow this action.");
  return s.member;
}

export const canEdit = (r: Role) => r === "owner" || r === "editor";
export const isOwner = (r: Role) => r === "owner";
