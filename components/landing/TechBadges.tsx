"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const techBadges = [
  { name: "FFmpeg WASM", desc: "Video processing", emoji: "🎬", color: "#FF6B6B", rgb: "255,107,107" },
  { name: "Whisper.js", desc: "AI Speech-to-Text", emoji: "🎙️", color: "var(--accent-cyan)", rgb: "34,211,238" },
  { name: "Web Workers", desc: "Non-blocking execution", emoji: "⚙️", color: "var(--accent-neon)", rgb: "57,255,20" },
  { name: "Tesseract.js", desc: "OCR engine", emoji: "🔍", color: "#F472B6", rgb: "244,114,182" },
  { name: "PDF-lib", desc: "PDF manipulation", emoji: "📄", color: "var(--accent-orange)", rgb: "251,146,60" },
  { name: "WebAssembly", desc: "Near-native speed", emoji: "🚀", color: "var(--accent-purple)", rgb: "168,85,247" },
  { name: "Canvas API", desc: "Image processing", emoji: "🖼️", color: "#FBBF24", rgb: "251,191,36" },
  { name: "IndexedDB", desc: "Local storage", emoji: "💾", color: "#6EE7B7", rgb: "110,231,183" },
];

const privacyPoints = [
  { icon: "🚫", text: "Zero server uploads — ever" },
  { icon: "🧠", text: "AI models cached in your browser" },
  { icon: "🔑", text: "No account, no tracking, no ads" },
  { icon: "🌐", text: "Works fully offline after first load" },
];

export default function TechBadges() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-16">
      {/* Privacy guarantee block */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative rounded-2xl p-8 sm:p-10 mb-12 overflow-hidden text-center"
        style={{
          background: "rgba(57,255,20,0.03)",
          border: "1px solid rgba(57,255,20,0.12)",
        }}
      >
        {/* BG glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(57,255,20,0.05) 0%, transparent 70%)",
          }}
        />

        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
          style={{
            background: "rgba(57,255,20,0.08)",
            border: "1px solid rgba(57,255,20,0.2)",
            color: "var(--accent-neon)",
          }}
        >
          🔒 Privacy Verified
        </div>

        <h2
          className="text-2xl sm:text-3xl font-extrabold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Built for the privacy-conscious creator
        </h2>
        <p className="text-sm max-w-lg mx-auto mb-8" style={{ color: "var(--text-secondary)" }}>
          Every tool runs 100% in your browser. Your files are processed locally using WebAssembly
          and never touch our servers — because there are no servers.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {privacyPoints.map((point, i) => (
            <motion.div
              key={point.text}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span className="text-2xl">{point.icon}</span>
              <span className="text-xs font-medium text-center leading-snug" style={{ color: "var(--text-secondary)" }}>
                {point.text}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tech stack badges */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-5 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Powered by open-source technology
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {techBadges.map((badge, i) => (
            <motion.div
              key={badge.name}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.35, delay: 0.35 + i * 0.06 }}
              whileHover={{ scale: 1.06, y: -2 }}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-default transition-shadow"
              style={{
                background: `rgba(${badge.rgb},0.06)`,
                border: `1px solid rgba(${badge.rgb},0.18)`,
              }}
            >
              <span className="text-lg">{badge.emoji}</span>
              <div>
                <p className="text-xs font-bold leading-none mb-0.5" style={{ color: badge.color }}>
                  {badge.name}
                </p>
                <p className="text-xs leading-none" style={{ color: "var(--text-muted)" }}>
                  {badge.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
