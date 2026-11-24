import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { A } from "@/lib/admin";
import { Head } from "@/components/admin/ui";
import { parseRange, summary } from "@/lib/analytics";

const Tbl = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => rows.length ? (
  <div className="table-wrap"><table className="t"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
) : <p className="small muted">No data in this range.</p>;

export default async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole(); const sp = await searchParams;
  const r = parseRange(sp);
  const s = await summary(r);
  return (
    <>
      <Head title="Analytics" desc="First-party, cookie-less events from this site. Demo data is excluded. Clicks are not purchases.">
        <Link className="btn btn-outline btn-sm" href={A(`/export?type=analytics&from=${r.from}&to=${r.to}`)}>Export CSV</Link>
      </Head>
      <form className="row" style={{ marginBottom: 16 }}>
        {[7, 30, 90].map((d) => <Link key={d} className="chip" href={A(`/analytics?days=${d}`)}>Last {d} days</Link>)}
        <input type="date" name="from" className="input" defaultValue={r.from} style={{ maxWidth: 170 }} /><input type="date" name="to" className="input" defaultValue={r.to} style={{ maxWidth: 170 }} /><button className="btn btn-outline btn-sm">Apply</button>
      </form>
      <p className="small muted">{r.from} → {r.to} (WAT)</p>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat"><b>{s.pageViews}</b><span>Page events (all views)</span></div>
        <div className="card stat"><b>{s.productViews}</b><span>Product detail views</span></div>
        <div className="card stat"><b>{s.outboundClicks}</b><span>Outbound retailer clicks</span></div>
        <div className="card stat"><b>{s.ctr}</b><span>Click-through rate (clicks ÷ product views)</span></div>
      </div>
      <div className="notice" style={{ marginBottom: 16 }}><b>Purchases & commissions: Not available in this dashboard.</b> Conversions, attribution windows, returns and commission approval are controlled by your affiliate programme — check your AliExpress affiliate dashboard. Visits/unique visitors are not tracked (no cookies), so “page events” counts every view.</div>
      <div className="split">
        <section><h2 style={{ fontSize: "1rem" }}>Top products</h2><Tbl head={["Product", "Views", "Clicks", "CTR"]} rows={s.topProducts.map((p) => [p.title, p.views, p.clicks, p.ctr])} /></section>
        <section><h2 style={{ fontSize: "1rem" }}>Top content pages</h2><Tbl head={["Path", "Views"]} rows={s.topPages.map((p) => [p.path, p.views])} /></section>
        <section><h2 style={{ fontSize: "1rem" }}>Top categories</h2><Tbl head={["Category", "Views"]} rows={s.topCategories.map((c) => [c.name, c.views])} /></section>
        <section><h2 style={{ fontSize: "1rem" }}>Campaigns (utm_campaign)</h2><Tbl head={["Campaign", "Views", "Clicks"]} rows={s.campaigns.map((c) => [c.campaign, c.views, c.clicks])} /></section>
        <section><h2 style={{ fontSize: "1rem" }}>Searches</h2><Tbl head={["Term", "Count"]} rows={s.searches.map((x) => [x.term, x.count])} /></section>
        <section><h2 style={{ fontSize: "1rem" }}>Referrers</h2><Tbl head={["Source", "Views"]} rows={s.referrers.map((x) => [x.host, x.views])} /></section>
      </div>
      <details className="box" style={{ marginTop: 16 }}><summary>Metric definitions</summary><ul className="small"><li><b>Page events</b>: one per page load of a public page (bots excluded where detectable).</li><li><b>Product detail views</b>: loads of /p/… pages.</li><li><b>Outbound clicks</b>: redirects through /go/… to a verified retailer link.</li><li><b>CTR</b>: outbound clicks ÷ product detail views in the range.</li><li>All times in WAT (UTC+1). Demo products&apos; events are stored separately and never included.</li></ul></details>
    </>
  );
}
