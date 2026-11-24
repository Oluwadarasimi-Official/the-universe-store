import Link from "next/link";
import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Empty, Flash, Head, Status } from "@/components/admin/ui";
import { PRODUCT_STATUSES } from "@/lib/config";
import { fmtDate } from "@/lib/util";

export default async function Products({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole();
  const sp = await searchParams;
  let q = adminDb().from("products").select("id,title,slug,editorial_status,featured_flag,is_demo,updated_at,affiliate_url,outbound_ready,categories(name)").order("updated_at", { ascending: false }).limit(300);
  if (sp.status) q = q.eq("editorial_status", sp.status);
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%,]/g, "")}%`);
  if (sp.demo === "0") q = q.eq("is_demo", false);
  const { data: rows } = await q;
  return (
    <>
      <Head title="Products" desc="Create, review, publish and archive catalogue items. Nothing goes public without approval.">
        {canEdit(me.role) && <Link className="btn btn-primary" href={A("/products/new")}>New product</Link>}
      </Head>
      <Flash sp={sp} />
      <form className="row" style={{ marginBottom: 12 }}>
        <input className="input" name="q" defaultValue={sp.q} placeholder="Search title…" style={{ maxWidth: 260 }} />
        <select className="select" name="status" defaultValue={sp.status || ""} style={{ maxWidth: 200 }}>
          <option value="">All statuses</option>{PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="check"><input type="checkbox" name="demo" value="0" defaultChecked={sp.demo === "0"} /> Hide demo</label>
        <button className="btn btn-outline">Filter</button>
      </form>
      {rows?.length ? (
        <div className="table-wrap"><table className="t cards"><thead><tr><th>Product</th><th>Category</th><th>Status</th><th>Retailer link</th><th>Updated</th></tr></thead><tbody>
          {rows.map((r: any) => (
            <tr key={r.id}>
              <td data-l="Product"><Link href={A(`/products/${r.id}`)}><b>{r.title}</b></Link> {r.is_demo && <span className="badge badge-demo">Demo</span>} {r.featured_flag && <span className="badge">Featured</span>}</td>
              <td data-l="Category">{r.categories?.name || <span className="muted">—</span>}</td>
              <td data-l="Status"><Status s={r.editorial_status} /></td>
              <td data-l="Link">{r.outbound_ready ? <Status s="verified" /> : r.affiliate_url ? <Status s="unverified" /> : <span className="muted small">None</span>}</td>
              <td data-l="Updated" className="small">{fmtDate(r.updated_at, true)}</td>
            </tr>
          ))}
        </tbody></table></div>
      ) : <Empty title="No products match">{canEdit(me.role) && <Link className="btn btn-primary" href={A("/products/new")}>Add your first product</Link>}</Empty>}
    </>
  );
}
