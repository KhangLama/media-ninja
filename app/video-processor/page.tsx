import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cắt & Xử lý Video Online – Crop, Denoise, Blur",
  description:
    "Cắt video, crop tỉ lệ 9:16 TikTok/Reels, lọc tiếng ồn, che mờ vùng nhạy cảm – 100% trong trình duyệt bằng FFmpeg WebAssembly. Không upload server.",
  keywords: [
    "cắt video online",
    "crop video tiktok 9:16",
    "ffmpeg wasm",
    "video trimmer online",
    "lọc tiếng ồn video",
    "che mờ video",
  ],
  openGraph: {
    title: "Cắt & Xử lý Video Online | MediaNinja",
    description:
      "Cắt, crop, denoise, blur video – chạy 100% trong trình duyệt, không upload server.",
  },
};

export default function VideoProcessorPage() {
  return <VideoProcessorClient />;
}

import VideoProcessorClient from "./client";
