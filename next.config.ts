import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next's Server Action default is 1MB. saveProfile (src/app/profile/edit/actions.ts)
    // submits the whole form — headshot + résumé PDF + up to 8 gallery photos — as ONE
    // multipart request, so a phone's full-resolution camera photos blow past the
    // default easily (a laptop test with small files never hit it). Raised to cover a
    // 5MB headshot + a résumé + several real phone photos in one save.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
