import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nén ảnh Online Miễn phí – JPEG, PNG, WebP",
  description:
    "Nén ảnh hàng loạt JPEG, PNG, WebP 100% trong trình duyệt. Xóa EXIF GPS bảo mật. Không upload file lên server – bảo mật tuyệt đối.",
  keywords: [
    "nén ảnh online",
    "nén ảnh miễn phí",
    "compress image online",
    "xóa exif ảnh",
    "nén ảnh webp",
    "giảm dung lượng ảnh",
  ],
  openGraph: {
    title: "Nén ảnh Online Miễn phí | MediaNinja",
    description:
      "Nén ảnh hàng loạt, xóa EXIF GPS – chạy 100% trong trình duyệt, không upload server.",
  },
};

export default function ImageOptimizerPage() {
  return <ImageOptimizerClient />;
}

import ImageOptimizerClient from "./client";
