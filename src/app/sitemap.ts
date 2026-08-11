import type { MetadataRoute } from "next";

const BASE_URL = "https://www.realtylabz.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/login", "/signup", "/privacy", "/terms", "/support", "/changelog"];
  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
