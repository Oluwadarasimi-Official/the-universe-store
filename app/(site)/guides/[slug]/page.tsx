import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getGuide, getProducts, getSettings } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import Disclosure from "@/components/Disclosure";
import Tracker from "@/components/Tracker";
import { fmtDate } from "@/lib/util";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const g = await getGuide(slug);
  if (!g) return { title: "Guide not found" };
  return { title: g.title, description: g.excerpt || undefined, alternates: { canonical: `/guides/${g.slug}` }, robots: g.is_demo ? { index: false } : undefined };
}

function Body({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return <div className="prose">{blocks.map((b, i) => {
    if (b.startsWith("## ")) return <h2 key={i}>{b.slice(3)}</h2>;
    if (b.startsWith("### ")) return <h3 key={i}>{b.slice(4)}</h3>;
    if (/^[-*] /.test(b)) return <ul key={i}>{b.split("\n").map((l, j) => <li key={j}>{l.replace(/^[-*] /, "")}</li>)}</ul>;
    return <p key={i}>{b}</p>;
  })}</div>;
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const g = await getGuide(slug);
  if (!g) notFound();
  const [items, cats, s] = await Promise.all([getProducts({ ids: g.product_ids || [], limit: 24 }), getCategories(), getSettings()]);
  return (
    <article className="wrap section-sm">
      <Tracker type="guide_view" guideId={g.id} demo={g.is_demo} />
      <nav className="crumbs" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li><Link href="/guides">Guides</Link></li><li aria-current="page">{g.title}</li></ol></nav>
      {g.is_demo && <div className="notice notice-warn" style={{ marginTop: 12 }}><b>Demo guide.</b> Sample content for previewing the layout.</div>}
      <header style={{ margin: "16px 0" }}>
        <span className="badge">{g.kind === "collection" ? "Collection" : "Buying guide"}</span>
        <h1 style={{ marginTop: 10 }}>{g.title}</h1>
        {g.excerpt && <p className="muted prose" style={{ fontSize: "1.05rem" }}>{g.excerpt}</p>}
        <p className="xs muted">Updated {fmtDate(g.updated_at)}{g.ai_assisted ? " · Drafted with AI assistance and reviewed by a person before publishing" : ""}</p>
      </header>
      <Disclosure text={s.disclosure} />
      {g.selection_criteria && <section className="card card-pad" style={{ marginTop: 16 }}><h2 style={{ fontSize: "1.1rem" }}>How we selected these</h2><p className="small" style={{ margin: 0 }}>{g.selection_criteria}</p></section>}
      {g.body && <div style={{ marginTop: 20 }}><Body text={g.body} /></div>}
      {items.length > 0 && <section style={{ marginTop: 24 }}><h2>Products in this {g.kind === "collection" ? "collection" : "guide"}</h2><div className="grid g4">{items.map((p) => <ProductCard key={p.id} p={p} catSlug={cats.find((c) => c.id === p.category_id)?.slug} />)}</div></section>}
      {g.limitations && <section className="notice" style={{ marginTop: 24 }}><b>Limitations:</b> {g.limitations}</section>}
      <p className="xs muted" style={{ marginTop: 16 }}>We have not tested these products hands-on unless explicitly stated. Prices and availability are set by the retailer and may change.</p>
    </article>
  );
}
