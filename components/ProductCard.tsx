import Link from "next/link";
import type { Product } from "@/lib/data";
import { formatPrice } from "@/lib/util";

export const CAT_ICON: Record<string, string> = {
  electronics: "🔌", "home-and-kitchen": "🍳", fashion: "👕", "beauty-and-personal-care": "🧴", lifestyle: "🌿",
  accessories: "⌚", "books-and-learning": "📚", "everyday-essentials": "🧺",
};

export default function ProductCard({ p, catSlug, priority = false }: { p: Product; catSlug?: string; priority?: boolean }) {
  const img = p.images?.[0];
  const price = formatPrice(p.displayed_price, p.currency);
  return (
    <Link href={`/p/${p.slug}`} className="p-card">
      <div className="p-media">
        {img ? <img src={img.url} alt={img.alt_text} width={400} height={400} loading={priority ? "eager" : "lazy"} decoding="async" /> : (
          <div className="p-ph" aria-hidden="true"><span className="big">{CAT_ICON[catSlug || ""] || "✦"}</span><small>Image not provided</small></div>
        )}
        {p.is_demo && <span className="badge badge-demo">Demo</span>}
      </div>
      <div className="p-body">
        <span className="p-title">{p.title}</span>
        {p.brand && <span className="xs muted">{p.brand}</span>}
        <span className="p-meta">
          {price ? <span className="p-price">{price}</span> : <span>Price on retailer site</span>}
          {" · "}{p.retailer_name}
        </span>
      </div>
    </Link>
  );
}
