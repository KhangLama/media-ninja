import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Studio – Chỉnh sửa, Đóng dấu & Nén ảnh Online",
  description:
    "Bộ công cụ xử lý ảnh hàng loạt trực tiếp trên trình duyệt: Chỉnh sửa màu sắc, cắt xoay, đóng dấu watermark, xóa EXIF GPS bảo mật và nén ảnh WebP/JPEG/PNG 100% offline.",
  keywords: [
    "chỉnh sửa ảnh online",
    "đóng dấu ảnh",
    "xoay lật ảnh",
    "nén ảnh online",
    "nén ảnh miễn phí",
    "compress image online",
    "xóa exif ảnh",
    "nén ảnh webp",
    "giảm dung lượng ảnh",
    "image studio online",
  ],
  openGraph: {
    title: "Image Studio – Chỉnh sửa, Đóng dấu & Nén ảnh Online | MediaNinja",
    description:
      "Chỉnh sửa màu sắc, xoay lật, đóng dấu watermark và tối ưu dung lượng ảnh hàng loạt trực tiếp trên trình duyệt của bạn.",
  },
};

export default function ImageOptimizerPage() {
  return <ImageOptimizerClient />;
}

import ImageOptimizerClient from "./client";
