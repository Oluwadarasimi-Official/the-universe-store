import "server-only";
import { adminDb } from "@/lib/supabase/clients";
import type { Member } from "@/lib/auth";

export async function audit(actor: Member | null, action: string, entityType?: string, entityId?: string, details?: unknown) {
  try {
    await adminDb().from("audit_logs").insert({
      actor_id: actor?.user_id ?? null,
      actor_email: actor?.email ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: details ?? null,
    });
  } catch {
    /* never block the user action on audit failure; error surfaces in logs */
  }
}
