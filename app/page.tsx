"use client";

import ImageProcessor from "@/components/ImageProcessor";
import VideoProcessor from "@/components/VideoProcessor";
import { useState } from "react";

type ToolId = "compress" | "video";

type Tool = {
  id: ToolId;
  title: string;
  label: string;
  description: string;
  acceptLabel: string;
  formats: string;
  accept: string;
};

const tools: Tool[] = [
  {
    id: "compress",
    title: "Nén ảnh",
    label: "Image Optimizer",
    description: "Tối ưu hàng loạt ảnh WebP, JPEG, PNG với chất lượng linh hoạt.",
    acceptLabel: "Kéo thả ảnh vào đây",
    formats: "WebP, JPEG, PNG",
    accept: "image/webp,image/jpeg,image/png",
  },
  {
    id: "video",
    title: "Xử lý Video",
    label: "FFmpeg.wasm",
    description: "Chuyển đổi định dạng, cắt video ngắn ngay trong trình duyệt.",
    acceptLabel: "Kéo thả video ngắn vào đây",
    formats: "MP4, MOV, WebM",
    accept: "video/mp4,video/quicktime,video/webm",
  },
];

export default function Home() {
  const [activeToolId, setActiveToolId] = useState<ToolId>("compress");

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Header />
        <Hero />
        <ToolWorkspace
          activeToolId={activeToolId}
          onToolChange={setActiveToolId}
        />
        <Footer />
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <a className="text-base font-semibold text-white flex items-center gap-2" href="#">
        <span>MediaNinja</span>
        <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-300">Open Source</span>
      </a>
      <nav
        aria-label="Primary navigation"
        className="flex items-center gap-6 text-sm text-neutral-400"
      >
        <a className="transition hover:text-white" href="#tools">
          Công cụ
        </a>
        <a className="transition hover:text-white" href="#privacy">
          Riêng tư
        </a>
        <a
          className="flex items-center gap-1.5 text-neutral-300 transition hover:text-white"
          href="https://github.com/KhangLama/media-ninja"
          rel="noopener noreferrer"
          target="_blank"
        >
          <GithubIcon />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </nav>
    </header>
  );
}

function GithubIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.67-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function Hero() {
  return (
    <section className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-20">
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-medium uppercase text-cyan-300">
          Client-side media toolkit
        </p>
        <h1 className="text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
          Xử lý media nhanh, riêng tư và không cần upload.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
          MediaNinja gom các tác vụ nén ảnh, chỉnh metadata và xử lý video ngắn vào một
          giao diện tối giản, chạy trực tiếp trên trình duyệt của bạn.
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric value="0" label="Server upload" />
          <Metric value="3" label="Media tools" />
          <Metric value="100%" label="Local-first" />
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-neutral-900 p-4">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{label}</div>
    </div>
  );
}

function ToolWorkspace({
  activeToolId,
  onToolChange,
}: {
  activeToolId: ToolId;
  onToolChange: (toolId: ToolId) => void;
}) {
  return (
    <section id="tools" className="flex-1 pb-12">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Bắt đầu xử lý</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Chọn công cụ, kéo thả file và xử lý tại chỗ trong trình duyệt.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div
          aria-label="Media tools"
          className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"
          role="tablist"
        >
          {tools.map((tool) => (
            <ToolTab
              key={tool.id}
              tool={tool}
              isActive={activeToolId === tool.id}
              onClick={() => onToolChange(tool.id)}
            />
          ))}
        </div>

        {activeToolId === "video" ? (
          <VideoProcessor />
        ) : (
          <ImageProcessor key={activeToolId} />
        )}
      </div>
    </section>
  );
}

function ToolTab({
  tool,
  isActive,
  onClick,
}: {
  tool: Tool;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={isActive}
      className={[
        "rounded-lg border p-4 text-left transition",
        "focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-neutral-950",
        isActive
          ? "border-cyan-300/70 bg-cyan-300/10 text-white"
          : "border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/25 hover:bg-white/[0.06]",
      ].join(" ")}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{tool.title}</p>
          <p className="mt-1 text-xs text-neutral-500">{tool.label}</p>
        </div>
        <span
          className={[
            "mt-1 h-2.5 w-2.5 rounded-full",
            isActive ? "bg-cyan-300" : "bg-neutral-700",
          ].join(" ")}
        />
      </div>
      <p className="mt-4 text-sm leading-6 text-neutral-400">{tool.description}</p>
    </button>
  );
}


function Footer() {
  return (
    <footer
      className="flex flex-col gap-3 border-t border-white/10 py-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between"
      id="privacy"
    >
      <p>© 2026 MediaNinja. Local-first media tools.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p>Không upload file mặc định. Không khóa dữ liệu của bạn.</p>
        <span className="hidden sm:inline text-neutral-700">•</span>
        <a
          className="text-neutral-400 hover:text-white transition flex items-center gap-1"
          href="https://github.com/KhangLama/media-ninja"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span>Mã nguồn mở trên GitHub</span>
        </a>
      </div>
    </footer>
  );
}
