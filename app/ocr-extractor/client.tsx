"use client";

import { PageShell, Breadcrumb } from "@/components/SharedLayout";
import { useLanguage } from "@/components/LanguageContext";
import OcrExtractor from "@/components/OcrExtractor";

export default function OcrExtractorClient() {
  const { t } = useLanguage();

  return (
    <PageShell>
      <Breadcrumb current={t("tool_ocr_title")} />
      <section className="flex-1 pb-12">
        <OcrExtractor />
      </section>
    </PageShell>
  );
}
