import type { Metadata } from "next";
import { getSettings } from "@/lib/data";
import ContactForm from "./ContactForm";
import Tracker from "@/components/Tracker";
export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default async function Contact({ searchParams }: { searchParams: Promise<{ type?: string; product?: string }> }) {
  const sp = await searchParams; const s = await getSettings();
  return (
    <div className="wrap section-sm" style={{ maxWidth: 720 }}>
      <Tracker />
      <h1>Contact us</h1>
      <p className="muted">Questions, feedback, a broken link or a product detail that looks wrong? Let us know.{s.contactEmail && <> You can also email <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>.</>}</p>
      <p className="small muted">For orders, delivery, returns or refunds, please contact the retailer you bought from — we don&apos;t sell or ship products.</p>
      <ContactForm kind={sp.type} product={sp.product?.slice(0, 120)} />
    </div>
  );
}
