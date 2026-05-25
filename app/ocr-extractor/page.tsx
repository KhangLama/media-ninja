import type { Metadata } from "next";
import OcrExtractorClient from "./client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://media-ninja.vercel.app";

export const metadata: Metadata = {
  title: "Trích xuất chữ từ Ảnh & PDF (OCR Online) – 100% Bảo mật",
  description:
    "Bộ công cụ OCR trích xuất chữ viết từ ảnh (JPEG, PNG, WebP) và tài liệu PDF offline 100% trong trình duyệt. Không tải file lên server, hỗ trợ tiếng Anh & tiếng Việt.",
  alternates: {
    canonical: `${SITE_URL}/ocr-extractor`,
  },
};

export default function OcrExtractorPage() {
  return <OcrExtractorClient />;
}
