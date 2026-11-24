import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";
export default function robots(): MetadataRoute.Robots {
  // The admin path is intentionally NOT listed here (listing it would reveal it);
  // admin pages send noindex headers/meta instead.
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/go/", "/api/"] }], sitemap: `${siteUrl()}/sitemap.xml` };
}
