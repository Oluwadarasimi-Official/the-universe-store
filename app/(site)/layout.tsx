import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getCategories } from "@/lib/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const cats = await getCategories();
  return (
    <>
      <Header suggestions={cats.map((c) => ({ name: c.name, slug: c.slug }))} />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
