import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Head } from "@/components/admin/ui";
import { fmtDate } from "@/lib/util";

export default async function Activity({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole(); const sp = await searchParams;
  let q = adminDb().from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (sp.q) q = q.ilike("action", `%${sp.q.replace(/[%,]/g, "")}%`);
  const { data } = await q;
  return (
    <>
      <Head title="Activity log" desc="Every change, approval, sign-in, AI generation, export and automation run — who and when." />
      <form className="row" style={{ marginBottom: 12 }}><input name="q" className="input" defaultValue={sp.q} placeholder="Filter by action (e.g. product., social., auth.)" style={{ maxWidth: 320 }} /><button className="btn btn-outline btn-sm">Filter</button></form>
      {data?.length ? <div className="table-wrap"><table className="t cards"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th><th>Details</th></tr></thead><tbody>
        {data.map((l) => <tr key={l.id}><td data-l="When" className="small">{fmtDate(l.created_at, true)}</td><td data-l="Who" className="small">{l.actor_email || "system"}</td><td data-l="Action"><code>{l.action}</code></td><td data-l="Item" className="xs">{l.entity_type} {l.entity_id?.slice(0, 8)}</td><td data-l="Details" className="xs" style={{ maxWidth: 320, wordBreak: "break-word" }}>{l.details ? JSON.stringify(l.details).slice(0, 200) : ""}</td></tr>)}
      </tbody></table></div> : <p className="small muted">No activity yet.</p>}
    </>
  );
}
