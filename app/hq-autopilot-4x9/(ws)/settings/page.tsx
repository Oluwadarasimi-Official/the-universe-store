import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { saveSettings, teamAction, demoAction } from "../system-actions";
import { fmtDate, ALIEXPRESS_TRACKING_ID_DEFAULT } from "@/lib/util";

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(["owner"]); const sp = await searchParams;
  const db = adminDb();
  const [{ data: rows }, { data: members }, { count: demoCount }] = await Promise.all([db.from("site_settings").select("key,value"), db.from("members").select("*").order("created_at"), db.from("products").select("id", { count: "exact", head: true }).eq("is_demo", true)]);
  const v: Record<string, any> = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
  return (
    <>
      <Head title="Settings" desc="Brand, public details, disclosure, regions, analytics retention, automations, team and demo data." />
      <Flash sp={sp} />
      <form action={saveSettings} className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1rem" }}>Site</h2>
        <div className="form-grid">
          <div className="field"><label>Site title</label><input name="site_title" className="input" defaultValue={v.site_title} /></div>
          <div className="field"><label>Tagline</label><input name="tagline" className="input" defaultValue={v.tagline} /></div>
          <div className="field span2"><label>Brand assets</label><div className="row"><img src="/brand/logo-192.png" alt="Logo" width={64} height={64} /><span className="small muted">Logo and icons are served from <code>/public/brand</code> and <code>app/icon.png</code>. Replace those files and redeploy to change them.</span></div></div>
          <div className="field"><label>Public contact email</label><input name="contact_email" type="email" className="input" defaultValue={v.contact_email || ""} placeholder="Not shown until set" /></div>
          <div className="field"><label>Currency display</label><input name="currency_display" className="input" maxLength={3} defaultValue={v.currency_display} /></div>
          <div className="field"><label>Supported regions</label><input name="supported_regions" className="input" defaultValue={(v.supported_regions || []).join(", ")} /></div>
          <div className="field"><label>Default locale</label><input name="default_locale" className="input" defaultValue={v.default_locale} /></div>
          {["tiktok", "instagram", "facebook"].map((k) => <div key={k} className="field"><label>{k} URL</label><input name={`social_${k}`} type="url" className="input" defaultValue={v.social_links?.[k] || ""} placeholder="Hidden until set" /></div>)}
          <div className="field"><label>AliExpress tracking ID</label><input name="aliexpress_tracking_id" className="input" defaultValue={v.aliexpress_tracking_id || ALIEXPRESS_TRACKING_ID_DEFAULT} /><span className="hint">Live value: “default” — the account&apos;s only tracking ID, verified in the AliExpress portal 24 Nov 2026. Used only to check that an AliExpress link you paste carries your tracking ID. Links are always generated inside the AliExpress portal — never typed or built by hand.</span></div>
          <div className="field span2"><label>Affiliate disclosure text</label><textarea name="affiliate_disclosure" className="textarea" defaultValue={v.affiliate_disclosure} /><span className="hint">Shown near products and retailer buttons. Only say “at no extra cost” if true under your programme terms. Never state a commission rate.</span></div>
          <div className="field"><label>Analytics retention (days)</label><input name="analytics_retention_days" type="number" min={30} max={730} className="input" defaultValue={v.analytics_retention_days} /></div>
          <label className="check"><input type="checkbox" name="automation_enabled" defaultChecked={v.automation_enabled === true} /> Automations master switch (daily scheduled runs)</label>
        </div>
        <Submit>Save settings</Submit>
      </form>

      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1rem" }}>Team & roles</h2>
        <p className="small muted">Owner/Admin: everything. Editor: products, content, social drafts, submit for review. Analyst: read-only. Invited people sign in with their own password; because login is shared with another app on this Supabase project, you must confirm each person&apos;s first sign-in request here before they get access.</p>
        <div className="table-wrap" style={{ marginBottom: 12 }}><table className="t cards"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {(members || []).map((m) => (
            <tr key={m.id}>
              <td data-l="Email">{m.email}{m.user_id === me.user_id && " (you)"}</td>
              <td data-l="Role"><form action={teamAction} className="row"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value="role" /><select name="role" className="select" defaultValue={m.role} style={{ minHeight: 36, maxWidth: 120 }}><option value="owner">owner</option><option value="editor">editor</option><option value="analyst">analyst</option></select><Submit className="btn btn-outline btn-sm">Set</Submit></form></td>
              <td data-l="Status">{!m.active ? <span className="badge badge-gray">Deactivated</span> : m.user_id ? <Status s="verified" /> : m.pending_user_id ? <span className="badge badge-demo">Requested {fmtDate(m.pending_requested_at, true)}</span> : <span className="badge badge-gray">Invited</span>}</td>
              <td data-l="Actions" className="row">
                {m.pending_user_id && <><form action={teamAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value="confirm" /><Submit className="btn btn-primary btn-sm" confirm={`Confirm ${m.email} just asked you for access?`}>Confirm access</Submit></form><form action={teamAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value="deny" /><Submit className="btn btn-outline btn-sm">Deny</Submit></form></>}
                {m.user_id !== me.user_id && <form action={teamAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value="toggle" /><Submit className="btn btn-outline btn-sm">{m.active ? "Deactivate" : "Reactivate"}</Submit></form>}
                {m.user_id !== me.user_id && <form action={teamAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value="remove" /><Submit className="btn btn-danger btn-sm" confirm="Remove this member?">Remove</Submit></form>}
              </td>
            </tr>
          ))}
        </tbody></table></div>
        <form action={teamAction} className="row"><input type="hidden" name="to" value="invite" /><input name="email" type="email" className="input" placeholder="colleague@email.com" style={{ maxWidth: 260 }} required /><select name="role" className="select" style={{ maxWidth: 140 }}><option value="editor">editor</option><option value="analyst">analyst</option><option value="owner">owner</option></select><Submit className="btn btn-outline btn-sm">Invite</Submit></form>
      </section>

      <section id="demo" className="card card-pad">
        <h2 style={{ fontSize: "1rem" }}>Demo data</h2>
        <p className="small muted">Demo products are labelled “Demo” everywhere, have no prices, links or ratings, are excluded from the sitemap and analytics, and are marked noindex. Currently: <b>{demoCount ?? 0}</b> demo product(s).</p>
        <div className="row">
          <form action={demoAction}><input type="hidden" name="to" value="remove" /><Submit className="btn btn-danger" confirm="Remove ALL demo products, demo guides and demo analytics? Real data is not touched.">Remove all demo data</Submit></form>
          <form action={demoAction}><input type="hidden" name="to" value="load" /><Submit className="btn btn-outline">Load demo data</Submit></form>
          <form action={demoAction}><input type="hidden" name="to" value="categories" /><Submit className="btn btn-outline">Ensure starter categories</Submit></form>
        </div>
      </section>
    </>
  );
}
