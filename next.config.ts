import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 确保静态资源正确处理
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  // 优化静态资源
  images: {
    unoptimized: false,
  },
  // 确保 public 目录下的文件正确服务
  trailingSlash: false,
};

export default nextConfig;
