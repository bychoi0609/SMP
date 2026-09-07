import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 와이파이의 다른 PC에서 개발 서버(LAN IP)로 접속할 때
  // Next.js가 기본적으로 차단하는 교차 출처 요청을 허용.
  allowedDevOrigins: ["192.168.0.141"],
  // @sparticuz/chromium의 bin(실제 Chromium 바이너리)과 PDF에 인라인 임베드하는
  // Pretendard 폰트는 코드에서 동적 경로로 읽기 때문에 빌드 시 자동으로 추적되지
  // 않는다. PDF 생성 라우트에서 수동으로 포함시켜줘야 Vercel 배포본에 실제로 올라간다.
  outputFileTracingIncludes: {
    "/api/smp/[id]/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/pretendard/dist/web/static/woff2/Pretendard-{Regular,Bold}.woff2",
    ],
    "/api/smp/export-pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/pretendard/dist/web/static/woff2/Pretendard-{Regular,Bold}.woff2",
    ],
  },
};

export default nextConfig;
