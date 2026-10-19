import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The certificate template picture is sent through a server action. It is resized in the browser first, so it stays small.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
