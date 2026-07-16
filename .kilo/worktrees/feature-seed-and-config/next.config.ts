import type { NextConfig } from "next";

import fs from 'fs';
import path from 'path';

// remove stale route.ts from supervisor/sites to avoid build conflict with page
try {
  const p = path.join(process.cwd(), 'app', 'supervisor', 'sites', 'route.ts');
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.debug('[next.config] removed conflicting supervisor/sites/route.ts');
  }
} catch (e) {
  console.warn('[next.config] could not remove route.ts', e);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.29.45.47'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
