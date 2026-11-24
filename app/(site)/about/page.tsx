import type { Metadata } from "next";
import Link from "next/link";
import Tracker from "@/components/Tracker";
export const metadata: Metadata = { title: "About", description: "What The Universe Store is and how it works.", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <div className="wrap section-sm prose">
      <Tracker />
      <h1>About The Universe Store</h1>
      <p style={{ fontSize: "1.1rem" }}><b>Everything Worth Discovering.</b> The Universe Store is an independent product-discovery website. We find useful products across many categories, describe them clearly, and link you to the retailer where you can buy them.</p>
      <h2>How it works</h2>
      <ul>
        <li>We curate products and write short, factual descriptions based on the retailer&apos;s listing and other information we can verify.</li>
        <li>When you click a retailer button such as “View on Jumia”, you leave our site and complete your purchase with that retailer.</li>
        <li>The retailer — not The Universe Store — sets the price, stock, delivery, returns and final purchase terms.</li>
        <li>Some links are affiliate links. We may earn a commission from qualifying purchases. <Link href="/affiliate-disclosure">Read our disclosure</Link>.</li>
      </ul>
      <h2>Our standards</h2>
      <ul>
        <li>No fake reviews, ratings, testimonials, countdown timers or “best seller” claims.</li>
        <li>Prices are shown with the date we last checked them — they are never presented as live.</li>
        <li>Every product and guide is reviewed and approved by a person before it is published.</li>
        <li>We don&apos;t list age-restricted or unsafe product categories.</li>
      </ul>
      <p>We are not owned by, endorsed by or officially connected to Jumia or any other retailer.</p>
      <p><Link className="btn btn-primary" href="/discover">Discover products</Link></p>
    </div>
  );
}
