import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProducts, getSettings } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import Disclosure from "@/components/Disclosure";
import Tracker from "@/components/Tracker";
import { fmtDate } from "@/lib/util";

export const revalidate = 300;
export const metadata: Metadata = { title: "Deals", description: "Verified, current offers only.", alternates: { canonical: "/deals" } };

export default async function Deals() {
  const [items, cats, s] = await Promise.all([getProducts({ deals: true, limit: 48 }), getCategories(), getSettings()]);
  return (
    <div className="wrap section-sm">
      <Tracker />
      <h1>Deals</h1>
      <p className="muted prose">We only show an offer here after the owner has checked it on the retailer site and set an end date. Offers can end early — always confirm the price on the retailer site.</p>
      {items.length ? (<>
        <Disclosure text={s.disclosure} compact />
        <div className="grid g4" style={{ marginTop: 16 }}>{items.map((p) => (
          <div key={p.id}><ProductCard p={p} catSlug={cats.find((c) => c.id === p.category_id)?.slug} />
            <p className="xs muted" style={{ marginTop: 6 }}>{p.deal_note ? `${p.deal_note} · ` : ""}Checked {fmtDate(p.deal_verified_at)} · ends {fmtDate(p.deal_expires_at)}</p></div>
        ))}</div>
      </>) : <div className="empty" style={{ marginTop: 16 }}><div className="big">🏷️</div><h3>No verified deals right now</h3><p className="muted">We don&apos;t post deals we can&apos;t confirm. Explore the full catalogue instead.</p><Link className="btn btn-outline" href="/discover">Discover products</Link></div>}
    </div>
  );
}
