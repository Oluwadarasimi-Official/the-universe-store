import { STATUS_LABEL, SOCIAL_STATUS_LABEL } from "@/lib/config";

const TONE: Record<string, string> = {
  published: "badge-green", approved: "badge-blue", verified: "badge-green", ready: "badge-blue", success: "badge-green", Connected: "badge-green",
  pending: "badge-demo", needs_review: "badge-demo", unverified: "badge-demo", "Rate limited": "badge-demo", running: "badge-demo", changes_requested: "badge-demo",
  rejected: "badge-red", failed: "badge-red", broken: "badge-red", error: "badge-red", Error: "badge-red",
};
export function Status({ s, social = false }: { s: string; social?: boolean }) {
  const label = (social ? SOCIAL_STATUS_LABEL[s] : undefined) || STATUS_LABEL[s] || s;
  return <span className={`badge ${TONE[s] || "badge-gray"}`}>{label}</span>;
}

export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  if (sp.ok) return <div className="notice notice-ok" role="status" style={{ marginBottom: 16 }}>{sp.ok}</div>;
  if (sp.err) return <div className="notice notice-err" role="alert" style={{ marginBottom: 16 }}>{sp.err}</div>;
  if (sp.e === "forbidden") return <div className="notice notice-err" role="alert" style={{ marginBottom: 16 }}>Your role does not have access to that section.</div>;
  return null;
}

export function Head({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{desc && <p className="small muted" style={{ margin: "4px 0 0", maxWidth: 680 }}>{desc}</p>}</div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Empty({ icon = "✦", title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return <div className="empty"><div className="big" aria-hidden="true">{icon}</div><h3>{title}</h3>{children}</div>;
}
