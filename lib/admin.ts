import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ADMIN_PATH } from "@/lib/config";

export const A = (p = "") => `${ADMIN_PATH}${p}`;

export function back(path: string, kind: "ok" | "err", msg: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${A(path)}${sep}${kind}=${encodeURIComponent(msg.slice(0, 300))}`);
}

/* Wrap a server-action body: errors become a flash message; redirects pass through. */
export async function act(path: string, fn: () => Promise<string | void>): Promise<never> {
  let msg: string | void;
  try {
    msg = await fn();
  } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    back(path, "err", String(e?.message || "Something went wrong."));
  }
  back(path, "ok", msg || "Saved.");
}

export function revalidatePublic(slugs: { product?: string; category?: string; guide?: string } = {}) {
  revalidatePath("/", "layout");
  if (slugs.product) revalidatePath(`/p/${slugs.product}`);
  if (slugs.category) revalidatePath(`/categories/${slugs.category}`);
  if (slugs.guide) revalidatePath(`/guides/${slugs.guide}`);
}
