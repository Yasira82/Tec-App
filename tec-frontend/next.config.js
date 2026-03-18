/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '.next',
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../'),
  },
};

module.exports = nextConfig;
