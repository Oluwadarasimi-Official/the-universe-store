import Link from "next/link";
import { getSettings } from "@/lib/data";

export default async function Footer() {
  const s = await getSettings();
  const SOCIAL_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
  const social = Object.entries(s.social || {}).filter(([, v]) => !!v) as [string, string][];
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <img className="footer-logo" src="/brand/logo-192.png" alt="The Universe Store logo" width={84} height={84} loading="lazy" />
          <p style={{ marginTop: 12, fontWeight: 800, color: "#fff" }}>THE UNIVERSE STORE</p>
          <p className="small" style={{ fontStyle: "italic" }}>Everything Worth Discovering.</p>
          <p className="xs" style={{ maxWidth: 360 }}>{s.disclosure}</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul><li><Link href="/discover">Discover</Link></li><li><Link href="/categories">Categories</Link></li><li><Link href="/guides">Buying guides</Link></li><li><Link href="/deals">Deals</Link></li></ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul><li><Link href="/about">About</Link></li><li><Link href="/contact">Contact</Link></li><li><Link href="/contact?type=broken_link">Report a broken link</Link></li></ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul><li><Link href="/affiliate-disclosure">Affiliate disclosure</Link></li><li><Link href="/privacy">Privacy policy</Link></li><li><Link href="/terms">Terms</Link></li></ul>
          {social.length > 0 && (<><h4 style={{ marginTop: 20 }}>Follow</h4><ul>{social.map(([k, v]) => <li key={k}><a href={v} target="_blank" rel="noopener noreferrer">{SOCIAL_LABEL[k] || (k[0].toUpperCase() + k.slice(1))}</a></li>)}</ul></>)}
        </div>
      </div>
      <div className="wrap footer-bottom">
        © {new Date().getFullYear()} The Universe Store. Independent product-discovery site — not owned, operated or endorsed by Jumia or any retailer. Prices, stock, shipping and returns are set by the retailer.
      </div>
    </footer>
  );
}
