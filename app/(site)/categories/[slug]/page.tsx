import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getProducts, getSettings } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import Disclosure from "@/components/Disclosure";
import Tracker from "@/components/Tracker";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCategories()).find((x) => x.slug === slug);
  if (!c) return { title: "Category not found" };
  return { title: c.name, description: c.intro || `Browse ${c.name} on The Universe Store.`, alternates: { canonical: `/categories/${c.slug}` } };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> }) {
  const { slug } = await params; const { sort } = await searchParams;
  const c = (await getCategories()).find((x) => x.slug === slug);
  if (!c) notFound();
  const [items, s] = await Promise.all([getProducts({ category: c.id, sort, limit: 60 }), getSettings()]);
  return (
    <div className="wrap section-sm">
      <Tracker type="category_view" categoryId={c.id} demo={c.is_demo} />
      <nav className="crumbs" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li><Link href="/categories">Categories</Link></li><li aria-current="page">{c.name}</li></ol></nav>
      <h1 style={{ marginTop: 12 }}>{c.name}</h1>
      {c.intro && <p className="muted prose">{c.intro}</p>}
      <div className="row between" style={{ margin: "12px 0 16px" }}>
        <span className="small muted">{items.length} product{items.length === 1 ? "" : "s"}</span>
        <div className="chips" style={{ marginTop: 0 }}>{[["new", "Newest"], ["az", "A–Z"], ...(items.some((p) => p.displayed_price != null) ? [["price_asc", "Price ↑"], ["price_desc", "Price ↓"]] : [])].map(([k, l]) => <Link key={k} className={`chip ${(sort || "new") === k ? "on" : ""}`} href={`/categories/${c.slug}?sort=${k}`}>{l}</Link>)}</div>
      </div>
      {items.length ? (<><div style={{ marginBottom: 16 }}><Disclosure text={s.disclosure} compact /></div><div className="grid g4">{items.map((p) => <ProductCard key={p.id} p={p} catSlug={c.slug} />)}</div></>)
        : <div className="empty"><div className="big">✦</div><h3>Nothing here yet</h3><p className="muted">We&apos;re still reviewing products for {c.name}.</p><Link className="btn btn-outline" href="/discover">Discover other products</Link></div>}
    </div>
  );
}
