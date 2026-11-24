import type { Metadata } from "next";
import { getSettings } from "@/lib/data";
import Tracker from "@/components/Tracker";
export const revalidate = 300;
export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default async function Privacy() {
  const s = await getSettings();
  return (
    <div className="wrap section-sm prose">
      <Tracker />
      <h1>Privacy policy</h1>
      <p className="small muted">This policy describes what this website actually collects.</p>
      <h2>Analytics we collect</h2>
      <p>We record privacy-conscious, first-party events to understand which pages and products are useful:</p>
      <ul>
        <li>Page, product, category and guide views (the page path and time).</li>
        <li>Search terms typed into our site search (stored as text, not linked to you).</li>
        <li>Clicks on retailer buttons (which product and link, and the time).</li>
        <li>The referring website&apos;s domain name and any campaign tags in the link (utm_source, utm_medium, utm_campaign).</li>
      </ul>
      <p>We do <b>not</b> set analytics or advertising cookies, do not use fingerprinting, and do not store your IP address with these events. To prevent abuse, we may use a one-way hashed form of your IP address for short-term rate limiting only.</p>
      <h2>Your browser storage</h2>
      <p>If you use the site search, your last few search terms are saved only in your own browser (localStorage) so you can repeat them. You can clear them from the search panel at any time.</p>
      <h2>Contact and report forms</h2>
      <p>If you use the contact or report form, we store the message and any name or email address you choose to give, so we can reply or fix the issue. Do not include sensitive personal information.</p>
      <h2>Retailers and affiliate links</h2>
      <p>When you click a retailer link you leave this site. The retailer (for example AliExpress) and its affiliate programme may use cookies and collect data under their own privacy policy.</p>
      <h2>Service providers</h2>
      <p>The site is hosted on Vercel and uses Supabase for its database. These providers process data on our behalf.</p>
      <h2>Retention</h2>
      <p>Analytics events are kept for a limited period (by default up to 12 months) and then deleted or aggregated.</p>
      <h2>Contact</h2>
      <p>{s.contactEmail ? <>Questions about privacy: <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>.</> : <>Questions about privacy: please use our <a href="/contact">contact form</a>.</>}</p>
    </div>
  );
}
