import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/lib/data";
import { CAT_ICON } from "@/components/ProductCard";
import Tracker from "@/components/Tracker";

export const revalidate = 300;
export const metadata: Metadata = { title: "Categories", description: "Browse every product category on The Universe Store.", alternates: { canonical: "/categories" } };

export default async function Categories() {
  const cats = await getCategories();
  return (
    <div className="wrap section-sm">
      <Tracker />
      <nav className="crumbs" aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li aria-current="page">Categories</li></ol></nav>
      <h1 style={{ marginTop: 12 }}>Categories</h1>
      {cats.length ? (
        <div className="grid g2">{cats.map((c) => (
          <Link key={c.id} href={`/categories/${c.slug}`} className="cat-tile"><span className="cat-icon" aria-hidden="true">{c.icon || CAT_ICON[c.slug] || "✦"}</span><span><b>{c.name}</b>{c.intro && <small>{c.intro}</small>}</span></Link>
        ))}</div>
      ) : <div className="empty"><p className="muted">No categories yet.</p></div>}
    </div>
  );
}
