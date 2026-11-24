import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProducts, getSettings } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import Disclosure from "@/components/Disclosure";
import Tracker from "@/components/Tracker";

export const metadata: Metadata = { title: "Discover products", description: "Search and browse products across every category on The Universe Store.", alternates: { canonical: "/discover" } };

const SORTS = [["new", "Newest"], ["az", "A–Z"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"]];

export default async function Discover({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q || "").slice(0, 80);
  const cats = await getCategories();
  const cat = cats.find((c) => c.slug === sp.category);
  const [items, s] = await Promise.all([getProducts({ q, category: cat?.id, sort: sp.sort, limit: 60 }), getSettings()]);
  const qs = (o: Record<string, string | undefined>) => { const u = new URLSearchParams(); Object.entries({ q, category: sp.category, sort: sp.sort, ...o }).forEach(([k, v]) => v && u.set(k, v)); const t = u.toString(); return t ? `?${t}` : ""; };
  return (
    <div className="wrap section-sm">
      <Tracker type={q ? "search" : "page_view"} search={q || undefined} />
      <h1>{q ? <>Results for “{q}”</> : "Discover products"}</h1>
      <form className="search-form" role="search" action="/discover" style={{ maxWidth: 560 }}>
        <label htmlFor="dq" className="sr-only">Search</label>
        <input id="dq" className="input" type="search" name="q" defaultValue={q} placeholder="Search products, brands…" maxLength={80} />
        {sp.category && <input type="hidden" name="category" value={sp.category} />}
        <button className="btn btn-primary">Search</button>
      </form>
      <div className="chips" aria-label="Filter by category">
        <Link className={`chip ${!cat ? "on" : ""}`} href={`/discover${qs({ category: undefined })}`}>All</Link>
        {cats.map((c) => <Link key={c.id} className={`chip ${cat?.id === c.id ? "on" : ""}`} href={`/discover${qs({ category: c.slug })}`}>{c.name}</Link>)}
      </div>
      <div className="row between" style={{ margin: "16px 0" }}>
        <span className="small muted">{items.length} product{items.length === 1 ? "" : "s"}</span>
        <div className="chips" style={{ marginTop: 0 }} aria-label="Sort">{SORTS.map(([k, l]) => <Link key={k} className={`chip ${(sp.sort || "new") === k ? "on" : ""}`} href={`/discover${qs({ sort: k })}`}>{l}</Link>)}</div>
      </div>
      {items.length ? (
        <>
          <div style={{ marginBottom: 16 }}><Disclosure text={s.disclosure} compact /></div>
          <div className="grid g4">{items.map((p, i) => <ProductCard key={p.id} p={p} catSlug={cats.find((c) => c.id === p.category_id)?.slug} priority={i < 2} />)}</div>
          {(sp.sort === "price_asc" || sp.sort === "price_desc") && <p className="xs muted" style={{ marginTop: 12 }}>Products without a checked price are listed last. Prices are as last checked and may have changed on the retailer site.</p>}
        </>
      ) : (
        <div className="empty"><div className="big">🔍</div><h3>No products found</h3><p className="muted">{q ? "Try a shorter or different search term, or browse by category." : "No products are published yet."}</p><Link className="btn btn-outline" href="/categories">Browse categories</Link></div>
      )}
    </div>
  );
}
