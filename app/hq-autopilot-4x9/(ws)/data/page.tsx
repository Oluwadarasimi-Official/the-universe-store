import { requireRole } from "@/lib/auth";
import { A } from "@/lib/admin";
import { Flash, Head } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { importProducts } from "../system-actions";

export default async function DataPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const ex = (type: string, fmt: string) => <a className="btn btn-outline btn-sm" href={A(`/export?type=${type}&format=${fmt}`)}>{fmt.toUpperCase()}</a>;
  return (
    <>
      <Head title="Import / Export" desc="Your data is portable: export any time as CSV or JSON; import products from CSV/JSON as drafts." />
      <Flash sp={sp} />
      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "1rem" }}>Export</h2>
        <div className="table-wrap"><table className="t"><tbody>
          {me.role !== "analyst" && <tr><td>Product catalogue (incl. affiliate URLs & status)</td><td className="row">{ex("products", "csv")}{ex("products", "json")}</td></tr>}
          <tr><td>Categories</td><td className="row">{ex("categories", "csv")}{ex("categories", "json")}</td></tr>
          <tr><td>Content drafts</td><td className="row">{ex("content", "csv")}{ex("content", "json")}</td></tr>
          <tr><td>Guides & collections</td><td className="row">{ex("guides", "csv")}{ex("guides", "json")}</td></tr>
          <tr><td>Analytics summary (last 30 days)</td><td className="row"><a className="btn btn-outline btn-sm" href={A("/export?type=analytics")}>CSV</a></td></tr>
        </tbody></table></div>
      </section>
      {me.role !== "analyst" && <section className="card card-pad">
        <h2 style={{ fontSize: "1rem" }}>Import products</h2>
        <p className="small muted">Columns: <code>title</code> (required), short_description, full_description, category (slug or name), brand, retailer_name, affiliate_url, canonical_product_url, displayed_price, currency, price_checked_at (YYYY-MM-DD), tags, source_notes. Every row becomes a <b>draft</b>; links are <b>unverified</b>; prices without currency + date are dropped. Duplicates and prohibited items are skipped. Max 500 rows / 1 MB.</p>
        <form action={importProducts} className="stack">
          <input type="file" name="file" accept=".csv,.json,text/csv,application/json" className="input" />
          <textarea name="csv" className="textarea" placeholder="…or paste CSV here" />
          <Submit>Import as drafts</Submit>
        </form>
      </section>}
      <details className="box" style={{ marginTop: 16 }}><summary>Restore / migrate</summary>
        <ol className="small"><li>Export products as JSON or CSV (keeps slugs, statuses, links).</li><li>On a new deployment, run the SQL migrations in <code>supabase/migrations</code>, then import the CSV here. Imported products arrive as drafts so they are re-approved before going public.</li><li>For a full database copy use Supabase&apos;s <code>pg_dump</code> of the <code>universe_store</code> schema (see docs/MAINTENANCE.md).</li></ol></details>
    </>
  );
}
