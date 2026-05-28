import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LanguageProvider } from "@/components/LanguageContext";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://media-ninja.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MediaNinja | Open-Source AI Image Compression, Video Cutter & Auto-Subtitles — 100% Private, Offline",
    template: "%s | MediaNinja",
  },
  description:
    "Free & open-source browser-based media toolkit. Compress images, cut videos for TikTok/Reels, and generate AI subtitles with Whisper — all 100% client-side. Your files never leave your device.",
  keywords: [
    "open source image compressor",
    "free video cutter online",
    "image compressor online free",
    "remove exif metadata",
    "video cutter online",
    "tiktok video crop 9:16",
    "auto subtitle generator free",
    "ai subtitles browser",
    "whisper ai offline",
    "ffmpeg wasm",
    "compress image browser",
    "video trimmer online free",
    "local first media tools",
    "media ninja",
    "privacy first media",
    "open source media tools",
    "client side processing",
  ],
  authors: [{ name: "KhangLama", url: "https://github.com/KhangLama" }],
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
    locale: "en_US",
    alternateLocale: "vi_VN",
    url: SITE_URL,
    siteName: "MediaNinja",
    title: "MediaNinja | Free & Open-Source AI Media Tools — 100% Private & Offline",
    description:
      "Free, open-source browser toolkit. Compress images, cut videos for TikTok/Reels, generate AI subtitles — all in your browser. Zero uploads, zero servers, 100% private.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MediaNinja – Premium Client-side Media Toolkit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MediaNinja | Free Open-Source AI Media Tools — 100% Offline",
    description:
      "Free & open-source browser-based media toolkit — 100% client-side. No uploads, no servers, no tracking.",
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
  themeColor: "#39FF14",
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
      "Free & open-source client-side media toolkit. Compress images, cut & crop videos for TikTok/Reels, generate AI subtitles with Whisper — all 100% in-browser, zero uploads.",
    codeRepository: "https://github.com/KhangLama/media-ninja",
    license: "https://opensource.org/licenses/MIT",
    author: {
      "@type": "Person",
      name: "KhangLama",
      url: "https://github.com/KhangLama",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Batch image compression (JPEG, PNG, WebP) with Before/After slider",
      "EXIF and GPS metadata removal",
      "Video trimming and aspect ratio crop (9:16, 1:1) for TikTok & Reels",
      "Audio denoising with FFmpeg WASM",
      "Offline AI speech-to-text subtitle generation (Whisper)",
      "Export subtitles as SRT, VTT, or TXT",
      "Burn-in subtitles into video",
      "Client-side PDF suite (merge, split, compress, watermark, rotate)",
      "Offline OCR text extraction (Tesseract.js)",
      "Custom QR Code Studio",
    ],
    inLanguage: ["vi", "en"],
  };

  return (
    <html lang="en" className={`h-full antialiased ${plusJakarta.variable}`}>
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
