import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 와이파이의 다른 PC에서 개발 서버(LAN IP)로 접속할 때
  // Next.js가 기본적으로 차단하는 교차 출처 요청을 허용.
  allowedDevOrigins: ["192.168.0.141"],
};

export default nextConfig;
