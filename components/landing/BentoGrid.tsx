"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

type BentoTile = {
  id: string;
  href: string;
  emoji: string;
  title: string;
  description: string;
  label: string;
  accent: string;
  accentRgb: string;
  size: "large" | "tall" | "small";
  badge?: string;
};

const tiles: BentoTile[] = [
  {
    id: "image",
    href: "/image-optimizer",
    emoji: "🖼️",
    title: "AI Image Compressor",
    description: "Batch compress JPEG, PNG & WebP. Before/After comparison slider. Download all as ZIP.",
    label: "Drag & drop · Batch · Export ZIP",
    accent: "var(--accent-neon)",
    accentRgb: "57,255,20",
    size: "large",
    badge: "Most Popular",
  },
  {
    id: "video",
    href: "/video-processor",
    emoji: "✂️",
    title: "Video Cutter",
    description: "Mobile-first 9:16 preview. Drag-to-trim timeline. TikTok, Reels & Shorts presets built-in.",
    label: "TikTok · Reels · YouTube Shorts",
    accent: "var(--accent-purple)",
    accentRgb: "168,85,247",
    size: "tall",
    badge: "FFmpeg WASM",
  },
  {
    id: "subtitle",
    href: "/subtitle-generator",
    emoji: "🎙️",
    title: "AI Auto-Subtitles",
    description: "Click any timestamped word to jump to that exact frame. Export SRT, VTT or burn-in.",
    label: "Whisper · SRT · VTT · Burn-in",
    accent: "var(--accent-cyan)",
    accentRgb: "34,211,238",
    size: "large",
    badge: "Privacy Verified",
  },
  {
    id: "pdf",
    href: "/pdf-tools",
    emoji: "📄",
    title: "PDF Suite",
    description: "Merge, split, compress, watermark & rotate PDFs — all offline.",
    label: "Merge · Split · Watermark",
    accent: "var(--accent-orange)",
    accentRgb: "251,146,60",
    size: "small",
  },
  {
    id: "ocr",
    href: "/ocr-extractor",
    emoji: "🔍",
    title: "OCR Extractor",
    description: "Extract text from images & PDFs using Tesseract.js — no cloud needed.",
    label: "Tesseract.js · Offline",
    accent: "#F472B6",
    accentRgb: "244,114,182",
    size: "small",
  },
  {
    id: "qr",
    href: "/qr-studio",
    emoji: "📱",
    title: "QR Studio",
    description: "Generate customised QR codes with gradients, logos & offline scanning.",
    label: "Custom · Gradient · Logo",
    accent: "#FBBF24",
    accentRgb: "251,191,36",
    size: "small",
  },
];

/* ── BentoCard ─────────────────────────────────────────────────────────── */
function BentoCard({
  tile,
  index,
  wide = false,
}: {
  tile: BentoTile;
  index: number;
  wide?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        ref={ref}
        href={tile.href}
        className={`group bento-card h-full p-6 sm:p-7 relative overflow-hidden ${
          wide
            ? "flex flex-col sm:flex-row items-start sm:items-center gap-6"
            : "flex flex-col"
        }`}
        style={{
          minHeight: wide
            ? "90px"
            : tile.size === "small"
            ? "180px"
            : tile.size === "tall"
            ? "100%"
            : "260px",
        }}
      >
        {/* Glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{
            background: `radial-gradient(circle at 30% 30%, rgba(${tile.accentRgb},0.08) 0%, transparent 70%)`,
          }}
        />

        {/* Animated gradient border on hover */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `linear-gradient(var(--bg-base), var(--bg-base)) padding-box, linear-gradient(135deg, rgba(${tile.accentRgb},0.6), transparent 60%) border-box`,
            border: "1.5px solid transparent",
          }}
        />

        {/* Badge */}
        {tile.badge && (
          <div
            className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: `rgba(${tile.accentRgb},0.12)`,
              color: tile.accent,
              border: `1px solid rgba(${tile.accentRgb},0.25)`,
            }}
          >
            {tile.badge}
          </div>
        )}

        {/* Emoji */}
        <motion.div
          className={`text-3xl sm:text-4xl w-fit flex-shrink-0 ${wide ? "" : "mb-4"}`}
          whileHover={{ scale: 1.15, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          {tile.emoji}
        </motion.div>

        {/* Content */}
        <div className={`flex-1 flex ${wide ? "flex-row items-center gap-6" : "flex-col"}`}>
          <div className="flex-1">
            <h3
              className="text-base sm:text-lg font-bold mb-1.5 transition-colors duration-200 group-hover:text-white"
              style={{ color: "var(--text-primary)" }}
            >
              {tile.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {tile.description}
            </p>
          </div>

          {/* Label + arrow */}
          <div
            className={`flex items-center justify-between gap-4 flex-shrink-0 ${
              wide ? "" : "mt-4 pt-4"
            }`}
            style={wide ? {} : { borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span
              className="text-xs font-medium whitespace-nowrap"
              style={{ color: tile.accent, opacity: 0.8 }}
            >
              {tile.label}
            </span>
            <motion.span
              className="text-lg font-light"
              style={{ color: tile.accent }}
              initial={{ x: 0, opacity: 0.5 }}
              whileHover={{ x: 4, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              →
            </motion.span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── BentoGrid ─────────────────────────────────────────────────────────── */
export default function BentoGrid() {
  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  const [image, video, subtitle, pdf, ocr, qr] = tiles;

  return (
    <section className="py-12" id="tools">
      {/* Header */}
      <motion.div
        ref={headerRef}
        initial={{ opacity: 0, y: 20 }}
        animate={headerInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8"
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--accent-neon)" }}
        >
          ✦ The Toolkit
        </p>
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-extrabold"
          style={{ color: "var(--text-primary)" }}
        >
          Every media task.{" "}
          <span style={{ color: "var(--text-muted)" }}>One place.</span>
        </h2>
      </motion.div>

      {/* Bento grid
          Desktop (lg):  col1        | col2 (row-span-2) | col3
          Row 1:         Image        | Video             | PDF
          Row 2:         Subtitle     | Video (cont.)     | OCR
          Row 3:         QR ──────────────────────────────────── (col-span-3)
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Row 1 */}
        <div><BentoCard tile={image} index={0} /></div>

        <div className="sm:row-span-2">
          <BentoCard tile={video} index={1} />
        </div>

        <div><BentoCard tile={pdf} index={2} /></div>

        {/* Row 2 */}
        <div><BentoCard tile={subtitle} index={3} /></div>
        <div><BentoCard tile={ocr} index={4} /></div>

        {/* Row 3 — QR full-width banner, no orphan gap */}
        <div className="sm:col-span-2 lg:col-span-3">
          <BentoCard tile={qr} index={5} wide />
        </div>
      </div>
    </section>
  );
}
