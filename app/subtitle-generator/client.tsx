"use client";

import { PageShell, Breadcrumb } from "@/components/SharedLayout";
import { useLanguage } from "@/components/LanguageContext";
import SubtitleProcessor from "@/components/SubtitleProcessor";

export default function SubtitleGeneratorClient() {
  const { t } = useLanguage();

  return (
    <PageShell>
      <Breadcrumb current={t("tool_subtitle_title")} />
      <section className="flex-1 pb-12">
        <SubtitleProcessor />
      </section>
    </PageShell>
  );
}
