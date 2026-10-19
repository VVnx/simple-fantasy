import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Briefing metadata comes from the same small D1 read as the article. Keep it
  // in the first HTML head for every crawler/share preview, without requiring JS.
  htmlLimitedBots: /.*/,
};
export default config;
