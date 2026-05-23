"use client";

import { PageShell, Breadcrumb } from "@/components/SharedLayout";
import { useLanguage } from "@/components/LanguageContext";
import VideoProcessor from "@/components/VideoProcessor";

export default function VideoProcessorClient() {
  const { t } = useLanguage();

  return (
    <PageShell>
      <Breadcrumb current={t("tool_video_title")} />
      <section className="flex-1 pb-12">
        <VideoProcessor />
      </section>
    </PageShell>
  );
}
