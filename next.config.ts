import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "vynfcgvpljnvoiqrqyti.supabase.co",
            },
        ],
    },
};

export default nextConfig;
