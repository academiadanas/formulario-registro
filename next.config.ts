import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "uafyxhczxbsyzfyjokwf.supabase.co",
            },
        ],
    },
};

export default nextConfig;
