"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useLanguage } from "@/components/LanguageContext";

const features = [
  {
    id: "image",
    href: "/image-optimizer",
    emoji: "🖼️",
    accent: "var(--accent-neon)",
    accentRgb: "57,255,20",
    visual: (t: any) => (
      <div className="relative w-full h-32 rounded-xl overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(57,255,20,0.15) 0%, rgba(57,255,20,0.03) 100%)" }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/40" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg">
          <span className="text-xs text-black font-bold">↔</span>
        </div>
        <div className="absolute left-3 top-3 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(57,255,20,0.15)", color: "var(--accent-neon)" }}>
          {t("before")}
        </div>
        <div className="absolute right-3 top-3 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(57,255,20,0.15)", color: "var(--accent-neon)" }}>
          {t("after")}
        </div>
        <div className="absolute bottom-3 left-3 text-xs" style={{ color: "var(--text-muted)" }}>4.2 MB</div>
        <div className="absolute bottom-3 right-3 text-xs" style={{ color: "var(--accent-neon)" }}>→ 380 KB (-91%)</div>
      </div>
    ),
  },
  {
    id: "video",
    href: "/video-processor",
    emoji: "✂️",
    accent: "var(--accent-purple)",
    accentRgb: "168,85,247",
    visual: () => (
      <div className="relative w-full h-32 rounded-xl overflow-hidden flex items-center justify-center gap-3">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.2), transparent)" }}
        />
        {[
          { label: "TikTok", ratio: "9:16" },
          { label: "Reels", ratio: "9:16" },
          { label: "Shorts", ratio: "16:9" },
        ].map((p) => (
          <div
            key={p.label}
            className="relative flex flex-col items-center gap-1.5 p-2 rounded-lg"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}
          >
            <div
              className="rounded"
              style={{
                width: p.ratio === "9:16" ? "24px" : "40px",
                height: p.ratio === "9:16" ? "40px" : "24px",
                background: "rgba(168,85,247,0.4)",
              }}
            />
            <span className="text-xs font-semibold" style={{ color: "var(--accent-purple)" }}>{p.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "subtitle",
    href: "/subtitle-generator",
    emoji: "🎙️",
    accent: "var(--accent-cyan)",
    accentRgb: "34,211,238",
    visual: (t: any) => {
      const activeLine = t("language") === "vi" 
        ? "Mọi quá trình xử lý đều chạy cục bộ."
        : "All processing is done locally.";
      const line1 = t("language") === "vi" ? "Chào mừng đến với MediaNinja." : "Welcome to MediaNinja.";
      const line3 = t("language") === "vi" ? "Quyền riêng tư của bạn được đảm bảo." : "Your privacy is guaranteed.";

      return (
        <div className="relative w-full h-32 rounded-xl overflow-hidden p-3 flex flex-col gap-1.5">
          <div
            className="absolute inset-0 opacity-30"
            style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.15), transparent)" }}
          />
          {[
            { time: "00:01", text: line1, active: false },
            { time: "00:03", text: activeLine, active: true },
            { time: "00:06", text: line3, active: false },
          ].map((line) => (
            <div
              key={line.time}
              className="relative flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-all"
              style={{
                background: line.active ? "rgba(34,211,238,0.12)" : "transparent",
                border: line.active ? "1px solid rgba(34,211,238,0.25)" : "1px solid transparent",
              }}
            >
              <span className="font-mono flex-shrink-0" style={{ color: line.active ? "var(--accent-cyan)" : "var(--text-muted)" }}>
                {line.time}
              </span>
              <span style={{ color: line.active ? "var(--text-primary)" : "var(--text-muted)" }}>{line.text}</span>
              {line.active && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(34,211,238,0.15)", color: "var(--accent-cyan)" }}>
                  ▶
                </span>
              )}
            </div>
          ))}
        </div>
      );
    },
  },
];

export default function FeatureHighlights() {
  const { t } = useLanguage();

  return (
    <section className="py-16" id="features">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--accent-cyan)" }}
        >
          {t("features_tagline")}
        </p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold" style={{ color: "var(--text-primary)" }}>
          {t("features_title")}{" "}
          <span style={{ color: "var(--text-muted)" }}>{t("features_title_muted")}</span>
        </h2>
      </motion.div>

      <div className="flex flex-col gap-8">
        {features.map((feature, i) => (
          <FeatureCard key={feature.id} feature={feature} index={i} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  index,
}: {
  feature: typeof features[number];
  index: number;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const isEven = index % 2 === 0;

  const highlights = Array.from({ length: 4 }).map((_, idx) =>
    t(`feat_highlight_${feature.id}_${idx}`)
  );

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isEven ? -32 : 32 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative rounded-2xl p-6 sm:p-8 grid sm:grid-cols-2 gap-6 sm:gap-10 items-center overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* BG glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 60% at ${isEven ? "20%" : "80%"} 50%, rgba(${feature.accentRgb},0.07) 0%, transparent 70%)`,
        }}
      />

      {/* Content side */}
      <div className={isEven ? "order-1" : "order-1 sm:order-2"}>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-2xl">{feature.emoji}</span>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: `rgba(${feature.accentRgb},0.1)`,
              color: feature.accent,
              border: `1px solid rgba(${feature.accentRgb},0.2)`,
            }}
          >
            {t(`feat_subtitle_${feature.id}`)}
          </span>
        </div>

        <h3
          className="text-xl sm:text-2xl font-extrabold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          {t(`feat_title_${feature.id}`)}
        </h3>
        <p
          className="text-sm leading-relaxed mb-5"
          style={{ color: "var(--text-secondary)" }}
        >
          {t(`feat_desc_${feature.id}`)}
        </p>

        <ul className="flex flex-col gap-2 mb-6">
          {highlights.map((h) => (
            <li key={h} className="flex items-center gap-2.5 text-sm">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                style={{ background: `rgba(${feature.accentRgb},0.15)`, color: feature.accent }}
              >
                ✓
              </span>
              <span style={{ color: "var(--text-secondary)" }}>{h}</span>
            </li>
          ))}
        </ul>

        <Link
          href={feature.href}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 hover:shadow-lg cursor-pointer"
          style={{
            background: `rgba(${feature.accentRgb},0.12)`,
            color: feature.accent,
            border: `1px solid rgba(${feature.accentRgb},0.25)`,
          }}
        >
          {t("btn_try_now")}
          <span className="text-base">→</span>
        </Link>
      </div>

      {/* Visual side */}
      <div className={isEven ? "order-2" : "order-2 sm:order-1"}>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid rgba(${feature.accentRgb},0.12)` }}
        >
          {feature.visual(t)}
        </div>
      </div>
    </motion.div>
  );
}
