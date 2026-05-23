import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Công cụ PDF Online Miễn phí – Ghép, Tách, Nén & Chuyển đổi PDF",
  description:
    "Bộ công cụ xử lý PDF 100% trong trình duyệt. Ghép, tách, nén dung lượng, xoay trang, đóng dấu watermark, chuyển PDF thành ảnh và ngược lại. Bảo mật tuyệt đối.",
  keywords: [
    "ghép file pdf",
    "tách file pdf",
    "nén file pdf",
    "chuyển pdf sang ảnh",
    "chuyển ảnh sang pdf",
    "xoay trang pdf",
    "đóng dấu pdf",
    "pdf tools online",
    "offline pdf processor",
    "media ninja pdf",
  ],
  openGraph: {
    title: "Bộ công cụ PDF Online Miễn phí | MediaNinja",
    description:
      "Ghép, tách, nén, đóng dấu, xoay và chuyển đổi PDF trực tiếp trong trình duyệt – 100% offline & bảo mật.",
  },
};

export default function PdfToolsPage() {
  return <PdfToolsClient />;
}

import PdfToolsClient from "./client";
