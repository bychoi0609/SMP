import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 와이파이의 다른 PC에서 개발 서버(LAN IP)로 접속할 때
  // Next.js가 기본적으로 차단하는 교차 출처 요청을 허용.
  allowedDevOrigins: ["192.168.0.141"],
  // @sparticuz/chromium의 bin(실제 Chromium 바이너리) 폴더는 코드에서 동적으로
  // require하기 때문에 빌드 시 자동으로 추적되지 않는다. PDF 생성 라우트에서
  // 수동으로 포함시켜줘야 Vercel 배포본에 바이너리가 실제로 올라간다.
  outputFileTracingIncludes: {
    "/api/smp/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/smp/export-pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
