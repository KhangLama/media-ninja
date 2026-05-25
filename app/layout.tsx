import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LanguageProvider } from "@/components/LanguageContext";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://media-ninja.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MediaNinja | Nén ảnh, Cắt video & Tạo phụ đề AI – Miễn phí, Offline, 100% Bảo mật",
    template: "%s | MediaNinja",
  },
  description:
    "Bộ công cụ xử lý media 100% trong trình duyệt, không tải file lên server. Nén ảnh JPEG/PNG/WebP hàng loạt, xóa EXIF GPS, cắt & crop video TikTok/Reels, lọc tiếng ồn, che mờ vùng nhạy cảm và tạo phụ đề tự động AI offline bằng Whisper.",
  keywords: [
    "nén ảnh online miễn phí",
    "xóa exif ảnh",
    "cắt video online",
    "crop video 9:16 tiktok reels",
    "tạo phụ đề tự động",
    "tạo phụ đề srt",
    "speech to text offline",
    "whisper ai browser",
    "ffmpeg wasm",
    "compress image browser",
    "remove exif metadata",
    "video trimmer online free",
    "local first media tools",
    "media ninja",
  ],
  authors: [{ name: "MediaNinja", url: SITE_URL }],
  creator: "KhangLama",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    alternateLocale: "en_US",
    url: SITE_URL,
    siteName: "MediaNinja",
    title: "MediaNinja | Nén ảnh, Cắt video & Tạo phụ đề AI – Offline, 100% Bảo mật",
    description:
      "Nén ảnh, xóa EXIF GPS, cắt & crop video TikTok/Reels, lọc tiếng ồn, che mờ nhạy cảm và tạo phụ đề AI – tất cả chạy 100% trong trình duyệt, không upload lên server.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MediaNinja – Client-side Media Toolkit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MediaNinja | Nén ảnh, Cắt video & Tạo phụ đề AI – Offline",
    description:
      "Bộ công cụ media chạy 100% trong trình duyệt – bảo mật tuyệt đối, không cần upload file.",
    images: ["/og-image.png"],
    creator: "@KhangLama",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "vi-VN": SITE_URL,
      "en-US": `${SITE_URL}?lang=en`,
    },
  },
  verification: {
    google: "e95ca6b49c6191fb",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MediaNinja",
  },
};

export const viewport = {
  themeColor: "#06b6d4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MediaNinja",
    url: SITE_URL,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "All",
    browserRequirements: "Requires HTML5, WebAssembly, and SharedArrayBuffer support.",
    description:
      "Client-side media toolkit to compress images, clear EXIF metadata, crop and trim videos, denoise audio, blur sensitive areas, and generate offline AI subtitles using Whisper.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Batch image compression (JPEG, PNG, WebP)",
      "EXIF and GPS metadata removal",
      "Video trimming and aspect ratio crop (9:16, 1:1)",
      "Audio denoising with FFmpeg",
      "Sensitive area video blur / redaction",
      "Offline AI speech-to-text subtitle generation (Whisper-Tiny)",
      "Export subtitles as SRT, VTT, or TXT",
      "Burn-in subtitles into video",
      "Client-side PDF suite (merge, split, compress, watermark, rotate, convert)",
      "Offline OCR Text Extractor (extract text from images and PDFs using Tesseract.js)",
      "Custom QR Code Studio (generate customized QR codes with gradients, logos and scan offline)",
    ],
    inLanguage: ["vi", "en"],
  };

  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          {children}
        </LanguageProvider>
        <SpeedInsights />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
