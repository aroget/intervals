import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const monorepoRoot = path.join(__dirname, "../../");

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,

  turbopack: {
    // Points to the folder containing your pnpm-workspace.yaml (two levels up)
    root: monorepoRoot,
  },
};

export default withNextIntl(nextConfig);
