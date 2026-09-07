import type { Metadata } from "next";
import { Geist_Mono, Baloo_2 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baloo2 = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Bodado",
  description: "태양광 발전소 SMP·REC 매출 청구 및 데이터 정리 자동화 웹앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistMono.variable} ${baloo2.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1 px-6 py-8 md:px-10">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
