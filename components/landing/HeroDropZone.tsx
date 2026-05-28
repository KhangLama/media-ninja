"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { setSharedFile } from "@/lib/sharedFileStore";
import { useLanguage } from "@/components/LanguageContext";

type DropChoice = "video-processor" | "subtitle-generator" | null;

export default function HeroDropZone() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [showVideoChoice, setShowVideoChoice] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  // Auto dismiss error toast
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Magnetic cursor effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-100, 100], [4, -4]);
  const rotateY = useTransform(mouseX, [-100, 100], [-4, 4]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseX.set(e.clientX - cx);
      mouseY.set(e.clientY - cy);
    },
    [mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    routeFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    routeFile(file);
  };

  const routeFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      setSharedFile(file);
      router.push("/image-optimizer");
    } else if (file.type.startsWith("video/")) {
      setPendingFile(file);
      setShowVideoChoice(true);
    } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setSharedFile(file);
      router.push("/pdf-tools");
    } else {
      setErrorMsg(t("drop_err_unsupported"));
    }
  };

  return (
    <section className="relative pt-12 pb-8 sm:pt-20 sm:pb-12">
      {/* Toast Alert */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          >
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold backdrop-blur-xl shadow-2xl"
              style={{
                background: "rgba(220,38,38,0.9)",
                border: "1px solid rgba(220,38,38,0.2)",
                color: "#ffffff",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                className="ml-3 text-white/70 hover:text-white transition-colors cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(57,255,20,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-10"
      >
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
          style={{
            background: "rgba(57,255,20,0.08)",
            border: "1px solid rgba(57,255,20,0.2)",
            color: "var(--accent-neon)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {t("hero_badge")}
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1] mb-5">
          <span style={{ color: "var(--text-primary)" }}>{t("hero_title_1")}</span>
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, var(--accent-neon), var(--accent-cyan))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t("hero_title_2")}
          </span>
        </h1>

        <p
          className="max-w-xl mx-auto text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("hero_description_text")}
        </p>
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        style={{ perspective: 800 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="max-w-2xl mx-auto"
      >
        <motion.div
          style={{ rotateX, rotateY }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        >
          <div
            ref={dropRef}
            onDragEnter={handleDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
            style={{
              border: isDragging
                ? "2px dashed var(--accent-neon)"
                : "2px dashed rgba(255,255,255,0.12)",
              background: isDragging
                ? "rgba(57,255,20,0.04)"
                : "rgba(255,255,255,0.02)",
              boxShadow: isDragging
                ? "0 0 60px rgba(57,255,20,0.12), inset 0 0 40px rgba(57,255,20,0.04)"
                : "none",
            }}
          >
            {/* Inner content */}
            <label className="flex flex-col items-center justify-center gap-5 py-16 px-8 cursor-pointer select-none">
              <input
                type="file"
                accept="image/*,video/*,application/pdf"
                className="sr-only"
                onChange={handleFileInput}
                id="drop-zone-input"
              />

              {/* Icon */}
              <motion.div
                animate={isDragging ? { scale: 1.15, rotate: 5 } : { scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative"
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {isDragging ? "⚡" : "🎯"}
                </div>
                {/* Ping ring */}
                {isDragging && (
                  <div
                    className="absolute inset-0 rounded-2xl animate-ping"
                    style={{ border: "2px solid var(--accent-neon)", opacity: 0.4 }}
                  />
                )}
              </motion.div>

              <div className="text-center">
                <p className="text-lg font-bold mb-1.5" style={{ color: "var(--text-primary)" }}>
                  {isDragging ? t("drop_release") : t("drop_prompt")}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--accent-neon)" }} className="font-medium underline underline-offset-2">
                    {t("drop_browse")}
                  </span>
                </p>
              </div>

              {/* File type hints */}
              <div className="flex items-center gap-3 flex-wrap justify-center">
                {[
                  { icon: "🖼️", label: t("bento_title_image"), href: "/image-optimizer" },
                  { icon: "✂️", label: t("bento_title_video"), href: "/video-processor" },
                  { icon: "🎙️", label: t("bento_title_subtitle"), href: "/subtitle-generator" },
                ].map((chip) => (
                  <a
                    key={chip.href}
                    href={chip.href}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>{chip.icon}</span>
                    {chip.label}
                  </a>
                ))}
              </div>
            </label>
          </div>
        </motion.div>
      </motion.div>

      {/* Video choice modal */}
      <AnimatePresence>
        {showVideoChoice && (
          <VideoChoiceModal
            onClose={() => setShowVideoChoice(false)}
            onChoice={(route) => {
              setShowVideoChoice(false);
              if (pendingFile) {
                setSharedFile(pendingFile);
              }
              router.push(`/${route}`);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function VideoChoiceModal({
  onClose,
  onChoice,
}: {
  onClose: () => void;
  onChoice: (route: DropChoice) => void;
}) {
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="glass rounded-2xl p-8 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-2 text-center" style={{ color: "var(--text-primary)" }}>
          {t("video_choice_title")}
        </h2>
        <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
          {t("video_choice_desc")}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onChoice("video-processor")}
            className="group flex flex-col items-center gap-3 p-5 rounded-xl transition-all hover:scale-105 cursor-pointer text-center"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="text-3xl">✂️</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {t("video_choice_cutter")}
              </p>
              <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {t("video_choice_cutter_desc")}
              </p>
            </div>
          </button>
          <button
            onClick={() => onChoice("subtitle-generator")}
            className="group flex flex-col items-center gap-3 p-5 rounded-xl transition-all hover:scale-105 cursor-pointer text-center"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="text-3xl">🎙️</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {t("video_choice_subtitles")}
              </p>
              <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {t("video_choice_subtitles_desc")}
              </p>
            </div>
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg text-xs transition cursor-pointer hover:text-white"
          style={{ color: "var(--text-muted)" }}
        >
          {t("img_edit_btn_cancel")}
        </button>
      </motion.div>
    </motion.div>
  );
}
