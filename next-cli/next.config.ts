import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */

  allowedDevOrigins: [
    '127.0.0.1',
  ],
  turbopack: {
    root: path.resolve('/Users/tjlxndr/Documents/Programming/@atproto/at-oauth/next-cli')
  }
};

export default nextConfig;
