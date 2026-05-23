import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tạo phụ đề tự động bằng AI Offline – SRT, VTT",
  description:
    "Tự động tạo phụ đề từ video/audio bằng Whisper AI chạy 100% offline trong trình duyệt. Xuất file SRT, VTT, TXT. Chèn cứng phụ đề vào video.",
  keywords: [
    "tạo phụ đề tự động",
    "tạo phụ đề srt",
    "speech to text offline",
    "whisper ai",
    "tạo phụ đề video",
    "chèn phụ đề vào video",
  ],
  openGraph: {
    title: "Tạo phụ đề tự động bằng AI | MediaNinja",
    description:
      "Trích xuất phụ đề SRT/VTT offline bằng Whisper AI – chạy 100% trong trình duyệt.",
  },
};

export default function SubtitleGeneratorPage() {
  return <SubtitleGeneratorClient />;
}

import SubtitleGeneratorClient from "./client";
