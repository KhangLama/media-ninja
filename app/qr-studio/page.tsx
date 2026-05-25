import type { Metadata } from "next";
import QrStudioClient from "./client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://media-ninja.vercel.app";

export const metadata: Metadata = {
  title: "Tạo & Quét mã QR Tùy biến Nghệ thuật | MediaNinja",
  description:
    "QR Code Studio offline 100% trong trình duyệt. Thiết kế mã QR với màu chuyển sắc (gradient), nhúng logo riêng, và quét mã QR từ ảnh tải lên hoàn toàn bảo mật.",
  alternates: {
    canonical: `${SITE_URL}/qr-studio`,
  },
};

export default function QrStudioPage() {
  return <QrStudioClient />;
}
