import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "../auth-actions";
import { getMember } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { ADMIN_PATH } from "@/lib/config";
import { Flash } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await getMember();
  if (s?.member) redirect(ADMIN_PATH);
  const { count } = await adminDb().from("members").select("id", { count: "exact", head: true }).eq("role", "owner");
  const needsSetup = (count ?? 0) === 0;
  return (
    <div className="auth-wrap">
      <div className="auth-card card card-pad">
        <div className="center" style={{ marginBottom: 12 }}>
          <img src="/brand/logo-192.png" alt="The Universe Store logo" width={96} height={96} style={{ margin: "0 auto" }} />
          <h1 style={{ fontSize: "1.3rem", marginTop: 8 }}>Universe Autopilot</h1>
          <p className="small muted">Owner workspace · THE UNIVERSE STORE</p>
        </div>
        <Flash sp={sp} />
        {sp.e === "no_access" && <div className="notice notice-err" style={{ marginBottom: 12 }}>This account has no store access.</div>}
        {needsSetup && <div className="notice notice-warn" style={{ marginBottom: 12 }}>No owner exists yet. <Link href={`${ADMIN_PATH}/setup`}>Run first-time setup</Link>.</div>}
        <form action={signIn}>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="username" /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required autoComplete="current-password" /></div>
          <Submit className="btn btn-primary btn-block">Sign in</Submit>
        </form>
        <p className="xs muted" style={{ marginTop: 12 }}>Sessions expire automatically; sign out on shared devices. <Link href="/">Back to store</Link></p>
      </div>
    </div>
  );
}
