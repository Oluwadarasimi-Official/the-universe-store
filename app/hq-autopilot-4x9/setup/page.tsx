import { redirect } from "next/navigation";
import { claimOwner } from "../auth-actions";
import { adminDb } from "@/lib/supabase/clients";
import { ADMIN_PATH } from "@/lib/config";
import { Flash } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";

export default async function Setup({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { count } = await adminDb().from("members").select("id", { count: "exact", head: true }).eq("role", "owner");
  if ((count ?? 0) > 0) redirect(`${ADMIN_PATH}/login`);
  const tokenSet = (process.env.ADMIN_SETUP_TOKEN || "").length >= 24;
  return (
    <div className="auth-wrap">
      <div className="auth-card card card-pad">
        <h1 style={{ fontSize: "1.3rem" }}>First-time setup</h1>
        <p className="small muted">Create the first Owner account for Universe Autopilot. This page works only once, and only with the setup token stored on the server (ADMIN_SETUP_TOKEN).</p>
        <Flash sp={sp} />
        {!tokenSet ? <div className="notice notice-err">ADMIN_SETUP_TOKEN is not set on the server (min 24 chars). Add it in Vercel → Settings → Environment Variables, redeploy, then return here.</div> : (
          <form action={claimOwner}>
            <div className="field"><label htmlFor="token">Setup token</label><input id="token" name="token" type="password" className="input" required autoComplete="off" /></div>
            <div className="field"><label htmlFor="email">Owner email</label><input id="email" name="email" type="email" className="input" required autoComplete="username" /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" required minLength={12} autoComplete="new-password" /><span className="hint">At least 12 characters with upper-case, lower-case and a number.</span></div>
            <div className="field"><label htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" className="input" required minLength={12} autoComplete="new-password" /></div>
            <Submit className="btn btn-primary btn-block">Create owner account</Submit>
          </form>
        )}
      </div>
    </div>
  );
}
