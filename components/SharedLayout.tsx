"use client";

import React from "react";
import { useLanguage } from "@/components/LanguageContext";
import Link from "next/link";

/* ── PageShell: Wraps every page with LanguageProvider + consistent layout ── */

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Header />
        {children}
        <Footer />
      </div>
    </main>
  );
}

/* ── Breadcrumb ── */

export function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 mt-4">
      <ol className="flex items-center gap-2 text-sm text-neutral-500">
        <li>
          <Link href="/" className="text-neutral-400 transition hover:text-white">
            MediaNinja
          </Link>
        </li>
        <li aria-hidden="true" className="text-neutral-700">
          /
        </li>
        <li className="text-cyan-300 font-medium">{current}</li>
      </ol>
    </nav>
  );
}

/* ── Header ── */

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <Link className="text-base font-semibold text-white flex items-center gap-2" href="/">
        <span>MediaNinja</span>
      </Link>
      <nav
        aria-label="Primary navigation"
        className="flex items-center gap-4 text-sm text-neutral-400"
      >
        <NavLinks />
      </nav>
    </header>
  );
}

function NavLinks() {
  const { t } = useLanguage();

  return (
    <>
      <Link
        href="/image-optimizer"
        className="hidden sm:inline text-neutral-400 transition hover:text-white"
      >
        {t("tool_image_title")}
      </Link>
      <Link
        href="/video-processor"
        className="hidden sm:inline text-neutral-400 transition hover:text-white"
      >
        {t("tool_video_title")}
      </Link>
      <Link
        href="/subtitle-generator"
        className="hidden md:inline text-neutral-400 transition hover:text-white"
      >
        {t("tool_subtitle_title")}
      </Link>
      <Link
        href="/pdf-tools"
        className="hidden md:inline text-neutral-400 transition hover:text-white"
      >
        {t("tool_pdf_title")}
      </Link>
      <Link
        href="/ocr-extractor"
        className="hidden lg:inline text-neutral-400 transition hover:text-white"
      >
        {t("tool_ocr_title")}
      </Link>
      <Link
        href="/qr-studio"
        className="hidden lg:inline text-neutral-400 transition hover:text-white"
      >
        {t("tool_qr_title")}
      </Link>
    </>
  );
}

/* ── Footer ── */

function Footer() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <footer
      className="flex flex-col gap-4 border-t border-white/10 py-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between"
      id="privacy"
    >
      <p>{t("footer_tagline")}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p>{t("footer_privacy_note")}</p>
        <span className="hidden sm:inline text-neutral-700">•</span>
        <select
          aria-label="Select Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as "vi" | "en")}
          className="rounded-md border border-white/10 bg-neutral-950 px-2 py-1 text-xs text-neutral-400 outline-none focus:border-cyan-300/70 hover:border-white/20 transition cursor-pointer"
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>
    </footer>
  );
}

/* ── Metric (used on landing page) ── */

export function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-neutral-900 p-4">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{label}</div>
    </div>
  );
}
