"use client";

import Link from "next/link";
import { PageShell, Metric } from "@/components/SharedLayout";
import { useLanguage } from "@/components/LanguageContext";

type ToolCard = {
  id: string;
  href: string;
  icon: string;
};

const toolCards: ToolCard[] = [
  { id: "compress", href: "/image-optimizer", icon: "📷" },
  { id: "video", href: "/video-processor", icon: "🎥" },
  { id: "subtitle", href: "/subtitle-generator", icon: "🎙️" },
  { id: "pdf", href: "/pdf-tools", icon: "📄" },
];

export default function Home() {
  return (
    <PageShell>
      <HomeContent />
    </PageShell>
  );
}

function HomeContent() {
  const { t } = useLanguage();

  return (
    <>
      {/* Hero */}
      <section className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-20">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase text-cyan-300">
            {t("hero_tagline")}
          </p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
            {t("hero_description")}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric value="0" label={t("metric_server_upload")} />
            <Metric value="4" label={t("metric_media_tools")} />
            <Metric value="100%" label={t("metric_local_first")} />
          </div>
        </div>
      </section>

      {/* Tool Cards */}
      <section id="tools" className="flex-1 pb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white">{t("workspace_title")}</h2>
          <p className="mt-2 text-sm text-neutral-400">
            {t("workspace_description")}
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {toolCards.map((card) => (
            <ToolCardLink key={card.id} card={card} />
          ))}
        </div>
      </section>
    </>
  );
}

function ToolCardLink({ card }: { card: ToolCard }) {
  const { t } = useLanguage();

  const titleKey = card.id === "compress" ? "tool_image_title" : card.id === "video" ? "tool_video_title" : card.id === "subtitle" ? "tool_subtitle_title" : "tool_pdf_title";
  const labelKey = card.id === "compress" ? "tool_image_label" : card.id === "video" ? "tool_video_label" : card.id === "subtitle" ? "tool_subtitle_label" : "tool_pdf_label";
  const descKey = card.id === "compress" ? "tool_image_desc" : card.id === "video" ? "tool_video_desc" : card.id === "subtitle" ? "tool_subtitle_desc" : "tool_pdf_desc";

  return (
    <Link
      href={card.href}
      className="group rounded-lg border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-cyan-300/50 hover:bg-cyan-300/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-2xl">{card.icon}</span>
          <p className="mt-2 text-sm font-semibold text-white group-hover:text-cyan-300 transition">
            {t(titleKey)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{t(labelKey)}</p>
        </div>
        <span className="mt-1 text-neutral-700 group-hover:text-cyan-300 transition text-lg">
          →
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        {t(descKey)}
      </p>
    </Link>
  );
}
