import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { messageAction } from "../system-actions";
import { fmtDate } from "@/lib/util";

export default async function Messages({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(["owner", "editor"]); const sp = await searchParams;
  const { data } = await adminDb().from("contact_messages").select("*, products(title,slug)").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <Head title="Messages & reports" desc="Contact form messages and broken-link / incorrect-info reports from visitors." />
      <Flash sp={sp} />
      {data?.length ? <div className="stack">{data.map((m: any) => (
        <div key={m.id} className="card card-pad">
          <div className="row between"><span className="small"><span className="badge badge-gray">{m.kind.replace("_", " ")}</span> {fmtDate(m.created_at, true)} {m.products && <>· product: <a href={`/p/${m.products.slug}`} target="_blank">{m.products.title}</a></>}</span><Status s={m.status === "new" ? "pending" : m.status === "resolved" ? "approved" : "draft"} /></div>
          <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{m.message}</p>
          <p className="xs muted">{m.name || "Anonymous"}{m.email ? ` · ${m.email}` : ""}</p>
          {me.role !== "analyst" && <div className="row">{["read", "resolved", "delete"].map((to) => <form key={to} action={messageAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="to" value={to} /><Submit className={to === "delete" ? "btn btn-danger btn-sm" : "btn btn-outline btn-sm"} confirm={to === "delete" ? "Delete this message?" : undefined}>{to === "read" ? "Mark read" : to === "resolved" ? "Resolve" : "Delete"}</Submit></form>)}</div>}
        </div>
      ))}</div> : <Empty icon="✉️" title="No messages yet" />}
    </>
  );
}
