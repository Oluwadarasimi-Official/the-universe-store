"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/categories", label: "Categories" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
];
const KEY = "us_recent_searches";

export default function Header({ suggestions }: { suggestions: { name: string; slug: string }[] }) {
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMenu(false); setSearch(false); }, [path]);
  useEffect(() => {
    if (search) {
      try { setRecent(JSON.parse(localStorage.getItem(KEY) || "[]").slice(0, 5)); } catch { setRecent([]); }
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [search]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSearch(false); setMenu(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim().slice(0, 80);
    if (!term) return;
    try { localStorage.setItem(KEY, JSON.stringify([term, ...recent.filter((r) => r !== term)].slice(0, 5))); } catch {}
    router.push(`/discover?q=${encodeURIComponent(term)}`);
  }
  const isActive = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const matches = q ? suggestions.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];

  return (
    <header className="site-header">
      <a href="#main" className="skip">Skip to content</a>
      <div className="wrap header-in">
        <Link href="/" className="brand" aria-label="The Universe Store — home">
          <img src="/brand/mark-96.png" alt="" width={40} height={40} />
          <span className="brand-text"><b>THE <span>UNIVERSE</span> STORE</b><small>Everything Worth Discovering.</small></span>
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>{n.label}</Link>)}
        </nav>
        <div className="header-actions">
          <button className="icon-btn" aria-label="Search products" aria-expanded={search} onClick={() => { setSearch((s) => !s); setMenu(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          <Link href="/discover" className="btn btn-primary btn-sm hide-sm">Explore Products</Link>
          <button className="icon-btn menu-toggle" aria-label="Open menu" aria-expanded={menu} onClick={() => { setMenu((m) => !m); setSearch(false); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{menu ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      {search && (
        <div className="search-panel">
          <div className="wrap">
            <form className="search-form" role="search" onSubmit={submit}>
              <label htmlFor="site-q" className="sr-only">Search products</label>
              <input id="site-q" ref={inputRef} className="input" type="search" placeholder="Search products, brands…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} autoComplete="off" />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>
            <div className="chips">
              {matches.map((m) => <Link key={m.slug} className="chip" href={`/categories/${m.slug}`}>Category: {m.name}</Link>)}
              {!q && recent.map((r) => <Link key={r} className="chip" href={`/discover?q=${encodeURIComponent(r)}`}>↺ {r}</Link>)}
              {!q && recent.length > 0 && <button className="chip" onClick={() => { localStorage.removeItem(KEY); setRecent([]); }}>Clear recent</button>}
            </div>
          </div>
        </div>
      )}
      {menu && (
        <nav className="mobile-menu" aria-label="Mobile">
          {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
          <Link href="/deals">Deals</Link>
          <Link href="/contact">Contact</Link>
          <div style={{ marginTop: 12 }}><Link href="/discover" className="btn btn-primary btn-block" style={{ border: 0 }}>Explore Products</Link></div>
        </nav>
      )}
    </header>
  );
}
