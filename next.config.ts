import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amplify 배포 빌드(scripts/amplify-bundle.sh)만 standalone. 로컬 `pnpm start`는 그대로
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Amplify 컴퓨트 묶음은 220MB 제한. 런타임에 안 쓰는 폴더와 이미지 최적화(sharp, next/image 안 씀)는 빼기
  outputFileTracingExcludes: {
    "*": [".env*", "storage/**", "fixtures/**", "docs/**", "design/**", ".amplify-hosting/**", "*.tsbuildinfo", "node_modules/sharp/**", "node_modules/@img/**", "node_modules/.pnpm/sharp@*/**", "node_modules/.pnpm/@img+*/**"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
