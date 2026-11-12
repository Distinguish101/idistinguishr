// Response headers that tell browsers to be stricter with this site. Not added
// here: a Content-Security-Policy. It needs the page's scripts and styles
// inventoried first, and a wrong one breaks the site.
const securityHeaders = [
  // Always use HTTPS for the next 180 days. No includeSubDomains or preload yet:
  // both are hard to undo, and the site has no other subdomains in use.
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
  // Stops browsers guessing a file's type from its contents.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Stops other sites embedding this one in a frame to trick clicks.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site uses none of these browser features.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Don't announce "X-Powered-By: Next.js" on every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
};

module.exports = nextConfig;
