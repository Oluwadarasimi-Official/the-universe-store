import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ADMIN_PATH } from "@/lib/config";
import { signOut } from "../auth-actions";
import { adminDb } from "@/lib/supabase/clients";

const NAV: [string, string, string, string[]?][] = [
  ["Workspace", "", "Overview"], ["", "/products", "Products"], ["", "/categories", "Categories"], ["", "/research", "Research Inbox"],
  ["Content", "/content", "Content Studio"], ["", "/guides", "Guides & Collections"], ["", "/social", "Social Campaigns"], ["", "/approvals", "Approval Queue"], ["", "/calendar", "Publishing Calendar"],
  ["Performance", "/links", "Affiliate Links"], ["", "/analytics", "Analytics"],
  ["System", "/automations", "Automations"], ["", "/integrations", "Integrations"], ["", "/data", "Import / Export"], ["", "/settings", "Settings", ["owner"]], ["", "/activity", "Activity Log"], ["", "/messages", "Messages"],
];

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole();
  const { count } = await adminDb().from("approval_items").select("id", { count: "exact", head: true }).eq("status", "pending");
  return (
    <div className="admin">
      <aside className="aside">
        <Link href={ADMIN_PATH} className="brand" style={{ marginBottom: 12 }}>
          <img src="/brand/mark-96.png" alt="" width={36} height={36} />
          <span className="brand-text"><b>Universe <span>Autopilot</span></b><small>THE UNIVERSE STORE</small></span>
        </Link>
        <nav aria-label="Workspace">
          {NAV.filter(([, , , roles]) => !roles || roles.includes(me.role)).map(([grp, href, label]) => (
            <span key={label} style={{ display: "contents" }}>
              {grp && <div className="grp">{grp}</div>}
              <Link href={`${ADMIN_PATH}${href}`}>{label}{label === "Approval Queue" && (count ?? 0) > 0 && <span className="badge badge-demo" style={{ marginLeft: "auto" }}>{count}</span>}</Link>
            </span>
          ))}
        </nav>
        <div style={{ marginTop: 16, padding: "0 10px" }} className="xs muted">
          Signed in as <b>{me.email}</b> ({me.role})
          <form action={signOut} style={{ marginTop: 8 }}><button className="btn btn-outline btn-sm">Sign out</button></form>
          <p style={{ marginTop: 8 }}><Link href="/" target="_blank">View store ↗</Link></p>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
