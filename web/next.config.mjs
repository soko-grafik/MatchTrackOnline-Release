import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig = {
  // Commented out for VPS deployment with PM2 (allows running next start)
  // output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  workboxOptions: {
    cleanupOutdatedCaches: true,
    ignoreURLParametersMatching: [/^id$/],
    exclude: [
      /middleware-manifest\.json$/,
      /_buildManifest\.js$/,
      /_ssgManifest\.js$/,
      /\.map$/,
    ],
  },
  // This is the key for static exports. It tells the service worker
  // where to find the files relative to the root.
  basePath: "/", 
});

export default withPWA(nextConfig);
