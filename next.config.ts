import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB; raised to comfortably fit scanned contract PDFs.
      bodySizeLimit: "15mb",
    },
  },
  // Both realtylabz.com and www.realtylabz.com are live, independently
  // reachable domains (both have Vercel-issued SSL certs) -- but Google
  // OAuth requires an exact, byte-for-byte redirect_uri match, and each
  // domain builds that URI from whichever host the request actually arrived
  // on. That's created a recurring bug: fixing Google sign-in on one domain
  // (adding its callback URL to Authorized redirect URIs) doesn't just leave
  // the other domain's registration alone -- editing the list in Google
  // Cloud Console has a real risk of replacing rather than appending, which
  // is what happened here (bare realtylabz.com's callback URL went missing
  // when www's was added). Rather than re-adding the missing entry and
  // hoping this doesn't happen a third time, this permanently redirects the
  // apex domain to www -- picked because www is the one currently confirmed
  // working, so this takes effect with zero required Google Console change.
  // Once live, no user (and no Google OAuth request) ever reaches the apex
  // domain again, so there's only ever one redirect_uri to keep correct.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "realtylabz.com" }],
        destination: "https://www.realtylabz.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
