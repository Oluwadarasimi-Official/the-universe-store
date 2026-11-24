import Link from "next/link";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { saveGuide } from "../catalog-actions";
import { fmtDate } from "@/lib/util";

export default async function Guides({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const { data: guides } = await adminDb().from("guides").select("id,title,slug,kind,status,is_demo,ai_assisted,updated_at").order("updated_at", { ascending: false });
  return (
    <>
      <Head title="Guides & collections" desc="Neutral buying guides and curated collections. Every guide needs approval before it goes public." />
      <Flash sp={sp} />
      {canEdit(me.role) && <details className="box" style={{ marginBottom: 16 }}><summary>New guide or collection</summary>
        <form action={saveGuide} className="form-grid" style={{ marginTop: 12 }}>
          <div className="field"><label htmlFor="t">Title *</label><input id="t" name="title" className="input" required /></div>
          <div className="field"><label htmlFor="k">Type</label><select id="k" name="kind" className="select"><option value="guide">Buying guide</option><option value="collection">Collection</option></select></div>
          <div className="span2"><Submit>Create draft</Submit></div>
        </form></details>}
      {guides?.length ? <div className="table-wrap"><table className="t cards"><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Updated</th></tr></thead><tbody>
        {guides.map((g) => <tr key={g.id}><td data-l="Title"><Link href={A(`/guides/${g.id}`)}>{g.title}</Link> {g.is_demo && <span className="badge badge-demo">Demo</span>} {g.ai_assisted && <span className="badge badge-gray">AI-assisted</span>}</td><td data-l="Type">{g.kind}</td><td data-l="Status"><Status s={g.status} /></td><td data-l="Updated" className="small">{fmtDate(g.updated_at, true)}</td></tr>)}
      </tbody></table></div> : <Empty icon="📘" title="No guides yet" />}
    </>
  );
}
