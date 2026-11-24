import Link from "next/link";
import { getCategories, getGuides, getProducts, getSettings } from "@/lib/data";
import ProductCard, { CAT_ICON } from "@/components/ProductCard";
import Disclosure from "@/components/Disclosure";
import Tracker from "@/components/Tracker";

export const revalidate = 300;

export default async function Home() {
  const [cats, featured, recent, guides, collections, s] = await Promise.all([
    getCategories(), getProducts({ featured: true, limit: 8 }), getProducts({ limit: 8 }), getGuides("guide", 3), getGuides("collection", 3), getSettings(),
  ]);
  const catSlug = (id: string | null) => cats.find((c) => c.id === id)?.slug;
  return (
    <>
      <Tracker />
      <section className="hero">
        <div className="wrap hero-in">
          <div>
            <p className="eyebrow">Product discovery · Nigeria &amp; worldwide</p>
            <h1>Everything <em>Worth Discovering.</em></h1>
            <p className="lead">Hand-picked products across tech, home, fashion, beauty and everyday essentials — with clear facts, honest notes and a direct link to the retailer when you are ready to buy.</p>
            <div className="row" style={{ marginTop: 20 }}>
              <Link href="/discover" className="btn btn-primary">Discover Products</Link>
              <Link href="/guides" className="btn btn-outline">Read buying guides</Link>
            </div>
            <div className="trust-row">
              <span><i className="dot" /> No fake reviews or ratings</span>
              <span><i className="dot" /> Any price shown carries a “last checked” date</span>
              <span><i className="dot" /> You buy on the retailer&apos;s site</span>
            </div>
          </div>
          <div className="hero-brand">
            <img className="hero-mark" src="/brand/mark-96.png" alt="The Universe Store" width={120} height={120} fetchPriority="high" />
            <p className="hero-wordmark">THE UNIVERSE STORE</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="row between" style={{ marginBottom: 16 }}><h2 style={{ margin: 0 }}>Shop by category</h2><Link href="/categories" className="small">All categories →</Link></div>
          {cats.length ? (
            <div className="grid g3">
              {cats.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/categories/${c.slug}`} className="cat-tile"><span className="cat-icon" aria-hidden="true">{c.icon || CAT_ICON[c.slug] || "✦"}</span><span><b>{c.name}</b>{c.intro && <small className="clamp2">{c.intro}</small>}</span></Link>
              ))}
            </div>
          ) : <div className="empty"><p className="muted">Categories are being set up. Check back soon.</p></div>}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section surface">
          <div className="wrap">
            <div className="row between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Featured discoveries</h2><Link href="/discover" className="small">See all →</Link></div>
            <div style={{ marginBottom: 16 }}><Disclosure text={s.disclosure} compact /></div>
            <div className="grid g4">{featured.map((p, i) => <ProductCard key={p.id} p={p} catSlug={catSlug(p.category_id)} priority={i < 2} />)}</div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap">
          <div className="row between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>Recently added</h2><Link href="/discover" className="small">Browse everything →</Link></div>
          {recent.length ? (
            <>
              {!featured.length && <div style={{ marginBottom: 16 }}><Disclosure text={s.disclosure} compact /></div>}
              <div className="grid g4">{recent.map((p) => <ProductCard key={p.id} p={p} catSlug={catSlug(p.category_id)} />)}</div>
            </>
          ) : (
            <div className="empty"><div className="big">✦</div><h3>New discoveries are on the way</h3><p className="muted">We only list products after they have been reviewed. Please check back soon.</p></div>
          )}
        </div>
      </section>

      {(guides.length > 0 || collections.length > 0) && (
        <section className="section surface">
          <div className="wrap">
            <h2>Buying guides &amp; collections</h2>
            <div className="grid g3">
              {[...guides, ...collections].map((g) => (
                <Link key={g.id} href={`/guides/${g.slug}`} className="card card-pad" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="badge">{g.kind === "collection" ? "Collection" : "Buying guide"}</span>{g.is_demo && <> <span className="badge badge-demo">Demo</span></>}
                  <h3 style={{ marginTop: 10 }}>{g.title}</h3>
                  {g.excerpt && <p className="small muted" style={{ margin: 0 }}>{g.excerpt}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap"><div className="card card-pad row between">
          <div><h3 style={{ margin: 0 }}>How The Universe Store works</h3><p className="small muted" style={{ margin: "6px 0 0" }}>We curate and describe products. When you click “View on Jumia” (or another retailer), you complete your purchase on their site — they handle price, stock, delivery and returns.</p></div>
          <Link href="/affiliate-disclosure" className="btn btn-outline btn-sm">Our disclosure</Link>
        </div></div>
      </section>
    </>
  );
}
