import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SCHEMA } from "@/lib/config";

/* Anonymous, cookie-less client for public reads (RLS + column grants apply). */
let anonClient: SupabaseClient<any, any, any> | null = null;
export function publicDb() {
  if (!anonClient) {
    anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      db: { schema: SCHEMA },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}

/* Service-role client. SERVER ONLY. Use only after an explicit role check (see lib/auth.ts)
   or for narrow, validated public writes (click/page events, contact form). */
let svc: SupabaseClient<any, any, any> | null = null;
export function adminDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!svc) {
    svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: SCHEMA },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return svc;
}

/* Cookie-bound auth client (Supabase Auth session for the admin). */
export async function authClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !(process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("http://") }));
        } catch {
          /* called from a Server Component: middleware refreshes the session */
        }
      },
    },
  });
}
