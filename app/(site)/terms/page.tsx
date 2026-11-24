import type { Metadata } from "next";
import Tracker from "@/components/Tracker";
export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <div className="wrap section-sm prose">
      <Tracker />
      <h1>Terms of use</h1>
      <h2>About this site</h2>
      <p>The Universe Store is an independent product-discovery website. We do not sell products, take payments, hold stock or ship orders. Purchases are made directly with third-party retailers.</p>
      <h2>Information accuracy</h2>
      <p>We work to keep product information accurate, but descriptions, specifications, prices and availability may be incomplete or out of date. Prices are shown with the date they were last checked and are not live. Always confirm details on the retailer&apos;s site before buying.</p>
      <h2>Third-party retailers</h2>
      <p>Your purchase is a contract between you and the retailer. The retailer is responsible for price, stock, delivery, returns, warranties and customer service. We are not responsible for the retailer&apos;s products, services or websites.</p>
      <h2>Affiliate links</h2>
      <p>Some links are affiliate links and we may earn a commission on qualifying purchases. See our affiliate disclosure for details.</p>
      <h2>Acceptable use</h2>
      <p>Do not misuse the site, attempt to access admin areas without permission, scrape it in a way that harms its performance, or submit spam or unlawful content through our forms.</p>
      <h2>Intellectual property</h2>
      <p>The Universe Store name and logo belong to the site owner. Retailer names and marks belong to their respective owners and are used only to identify where products are sold.</p>
      <h2>Changes</h2>
      <p>We may update these terms. The current version is always on this page.</p>
    </div>
  );
}
