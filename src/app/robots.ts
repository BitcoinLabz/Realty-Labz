import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Same authenticated-app prefixes proxy.ts protects — kept in sync
        // with that matcher, not re-derived independently.
        "/dashboard",
        "/account",
        "/transactions",
        "/finances",
        "/deals",
        "/team",
        "/forms",
        // Public but token-gated, not real indexable content.
        "/sign",
        "/join",
        "/portal",
        "/open-house",
      ],
    },
    sitemap: "https://www.realtylabz.com/sitemap.xml",
  };
}
