import type { Metadata } from "next";
import Link from "next/link";
import { getGuides } from "@/lib/data";
import Tracker from "@/components/Tracker";

export const revalidate = 300;
export const metadata: Metadata = { title: "Buying guides & collections", description: "Neutral, useful buying guides and curated collections.", alternates: { canonical: "/guides" } };

export default async function Guides() {
  const guides = await getGuides(undefined, 60);
  return (
    <div className="wrap section-sm">
      <Tracker />
      <h1>Buying guides &amp; collections</h1>
      <p className="muted prose">Neutral comparisons and curated picks. We explain how items were selected and what we could not verify. We do not claim hands-on testing unless stated with evidence.</p>
      {guides.length ? (
        <div className="grid g3" style={{ marginTop: 16 }}>{guides.map((g) => (
          <Link key={g.id} href={`/guides/${g.slug}`} className="card card-pad" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="badge">{g.kind === "collection" ? "Collection" : "Buying guide"}</span>{g.is_demo && <> <span className="badge badge-demo">Demo</span></>}
            <h3 style={{ marginTop: 10 }}>{g.title}</h3>{g.excerpt && <p className="small muted" style={{ margin: 0 }}>{g.excerpt}</p>}
          </Link>
        ))}</div>
      ) : <div className="empty" style={{ marginTop: 16 }}><div className="big">📘</div><h3>Guides are being written</h3><p className="muted">Every guide is reviewed by a person before it goes live.</p></div>}
    </div>
  );
}
