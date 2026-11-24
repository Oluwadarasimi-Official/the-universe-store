import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Page not found", robots: { index: false } };
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Header suggestions={[]} />
      <main id="main" className="wrap section center" style={{ minHeight: "40vh" }}>
        <img src="/brand/mark-96.png" alt="" width={96} height={96} style={{ margin: "0 auto 12px" }} />
        <p className="eyebrow">Error 404</p>
        <h1>This page wandered off into the universe</h1>
        <p className="muted">The page you&apos;re looking for doesn&apos;t exist or is no longer available.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
          <Link className="btn btn-primary" href="/discover">Discover products</Link>
          <Link className="btn btn-outline" href="/">Go home</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
