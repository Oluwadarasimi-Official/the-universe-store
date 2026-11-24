import type { Metadata } from "next";
import { getSettings } from "@/lib/data";
import Tracker from "@/components/Tracker";
export const revalidate = 300;
export const metadata: Metadata = { title: "Affiliate disclosure", alternates: { canonical: "/affiliate-disclosure" } };

export default async function AffiliateDisclosure() {
  const s = await getSettings();
  return (
    <div className="wrap section-sm prose">
      <Tracker />
      <h1>Affiliate disclosure</h1>
      <p className="notice">{s.disclosure}</p>
      <h2>What this means</h2>
      <p>The Universe Store participates in the AliExpress affiliate programme. When you click certain links on this site and then make a qualifying purchase, AliExpress may pay us a commission.</p>
      <p>Commission rates, attribution windows, returns and whether a commission is approved are decided by the affiliate programme, not by us. We do not state specific commission rates.</p>
      <h2>How we keep it honest</h2>
      <ul>
        <li>Affiliate links are labelled and shown near product recommendations and retailer buttons.</li>
        <li>Commissions do not change what you pay; the retailer sets the price.</li>
        <li>We never fabricate prices, ratings, reviews, stock or discounts, and we do not claim to have tested products unless we say so with evidence.</li>
        <li>Social media posts that recommend products or include affiliate links carry a clear disclosure.</li>
      </ul>
      <h2>Retailer responsibility</h2>
      <p>The Universe Store is not the seller. Pricing, availability, shipping, returns, warranties and purchase terms are determined by the retailer and may change at any time. Please review them on the retailer&apos;s site before buying.</p>
      <p>The Universe Store is not owned by, endorsed by or officially operated by AliExpress or any retailer we link to.</p>
    </div>
  );
}
