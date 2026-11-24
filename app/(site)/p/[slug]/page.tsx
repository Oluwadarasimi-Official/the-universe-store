import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getGuides, getProduct, getProducts, getSettings } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import Disclosure from "@/components/Disclosure";
import Tracker from "@/components/Tracker";
import { fmtDate, formatPrice, isAliExpressHost, isJumiaHost } from "@/lib/util";
import { siteUrl } from "@/lib/config";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.title, description: p.short_description || undefined, alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: p.title, description: p.short_description || undefined, images: p.images?.[0] ? [{ url: p.images[0].url, alt: p.images[0].alt_text }] : ["/brand/logo-512.png"] },
    robots: p.is_demo ? { index: false } : undefined,
  };
}

const AVAIL: Record<string, string> = { in_stock: "In stock (as last checked)", limited: "Limited stock (as last checked)", out_of_stock: "Out of stock (as last checked)" };

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const [cats, s] = await Promise.all([getCategories(), getSettings()]);
  const cat = cats.find((c) => c.id === p.category_id);
  const [related, guides] = await Promise.all([cat ? getProducts({ category: cat.id, excludeId: p.id, limit: 4 }) : Promise.resolve([]), getGuides(undefined, 50)]);
  const relGuides = guides.filter((g) => g.product_ids?.includes(p.id)).slice(0, 3);
  const price = formatPrice(p.displayed_price, p.currency);
  const isJumia = isJumiaHost(p.outbound_host);
  const isAliExpress = isAliExpressHost(p.outbound_host);
  const ctaLabel = isJumia ? "View on Jumia" : isAliExpress ? "View on AliExpress" : `View on ${p.retailer_name || "retailer site"}`;
  const specs = Array.isArray(p.specifications) ? p.specifications.filter((x) => x?.key && x?.value) : [];

  const ld: any = { "@context": "https://schema.org", "@type": "Product", name: p.title, description: p.short_description || undefined, url: `${siteUrl()}/p/${p.slug}` };
  if (p.brand) ld.brand = { "@type": "Brand", name: p.brand };
  if (p.images?.length) ld.image = p.images.map((i) => i.url);
  if (price && p.price_checked_at && p.outbound_ready) ld.offers = { "@type": "Offer", price: String(p.displayed_price), priceCurrency: p.currency, url: `${siteUrl()}/p/${p.slug}` };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl() },
    ...(cat ? [{ "@type": "ListItem", position: 2, name: cat.name, item: `${siteUrl()}/categories/${cat.slug}` }] : []),
    { "@type": "ListItem", position: cat ? 3 : 2, name: p.title },
  ] };

  return (
    <div className="wrap section-sm">
      <Tracker type="product_view" productId={p.id} demo={p.is_demo} />
      {!p.is_demo && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs).replace(/</g, "\\u003c") }} />
      <nav className="crumbs" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li>{cat && <li><Link href={`/categories/${cat.slug}`}>{cat.name}</Link></li>}<li aria-current="page">{p.title}</li></ol></nav>
      {p.is_demo && <div className="notice notice-warn" style={{ marginTop: 12 }}><b>Demo product.</b> This is sample content used to preview the store layout. It is not a real offer and has no price or retailer link.</div>}
      <div className="pd" style={{ marginTop: 16 }}>
        <div>
          <div className="gallery-main" id="img-0">
            {p.images?.[0] ? <img src={p.images[0].url} alt={p.images[0].alt_text} width={640} height={640} fetchPriority="high" /> : <div className="p-ph"><img src="/brand/mark-96.png" alt="" width={96} height={96} style={{ opacity: 0.35 }} /><small>Image not provided</small></div>}
          </div>
          {p.images && p.images.length > 1 && (
            <div className="thumbs">{p.images.map((im, i) => <a key={i} href={im.url} target="_blank" rel="noopener noreferrer" aria-label={`Open image ${i + 1}: ${im.alt_text}`}><img src={im.url} alt="" width={64} height={64} loading="lazy" /></a>)}</div>
          )}
        </div>
        <div className="stack">
          {p.brand && <div className="eyebrow">{p.brand}</div>}
          <h1 style={{ fontSize: "clamp(1.4rem,3.5vw,2rem)" }}>{p.title}</h1>
          {p.short_description && <p className="muted" style={{ fontSize: "1.05rem" }}>{p.short_description}</p>}
          <div className="buy-box stack">
            {price ? (
              <div>
                <div className="price-lg">{price}</div>
                <div className="xs muted">Price as last checked {p.price_checked_at ? `on ${fmtDate(p.price_checked_at)}` : "(date not provided)"}{p.price_source ? ` · source: ${p.price_source}` : ""}. Not a live price — confirm on the retailer site.</div>
              </div>
            ) : <div className="small muted">Price: Not provided — check the current price on the retailer site.</div>}
            {AVAIL[p.availability_status] && <div className="small"><span className="badge badge-gray">{AVAIL[p.availability_status]}</span></div>}
            <div className="small">Retailer: <b>{p.retailer_name}</b></div>
            {p.outbound_ready ? (
              <a className="btn btn-primary btn-block" href={`/go/${p.slug}`} target="_blank" rel="sponsored noopener noreferrer">{ctaLabel} ↗</a>
            ) : (
              <button className="btn btn-outline btn-block" disabled aria-disabled="true">{p.is_demo ? "Demo product — no retailer link" : "Retailer link coming soon"}</button>
            )}
            <p className="xs muted" style={{ margin: 0 }}>Price, stock, shipping, returns and final purchase terms are controlled by the retailer and may change. The Universe Store is not the seller.</p>
          </div>
          <Disclosure text={s.disclosure} />
          {p.full_description && (<section><h2 style={{ fontSize: "1.2rem" }}>About this product</h2><div className="prose">{p.full_description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div></section>)}
          {specs.length > 0 && (<section><h2 style={{ fontSize: "1.2rem" }}>Key specifications</h2><table className="spec"><tbody>{specs.map((x, i) => <tr key={i}><th scope="row">{x.key}</th><td>{x.value}</td></tr>)}</tbody></table><p className="xs muted">Specifications as provided by the retailer/manufacturer listing; confirm before buying.</p></section>)}
          <p className="small"><Link href={`/contact?type=incorrect_info&product=${p.slug}`}>Report incorrect information</Link> · <Link href={`/contact?type=broken_link&product=${p.slug}`}>Report a broken link</Link></p>
        </div>
      </div>
      {relGuides.length > 0 && (<section className="section-sm"><h2>Related guides</h2><div className="grid g3">{relGuides.map((g) => <Link key={g.id} href={`/guides/${g.slug}`} className="card card-pad">{g.title}</Link>)}</div></section>)}
      {related.length > 0 && (<section className="section-sm"><h2>More in {cat?.name}</h2><div className="grid g4">{related.map((r) => <ProductCard key={r.id} p={r} catSlug={cat?.slug} />)}</div></section>)}
    </div>
  );
}
