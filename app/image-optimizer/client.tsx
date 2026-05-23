"use client";

import { PageShell, Breadcrumb } from "@/components/SharedLayout";
import { useLanguage } from "@/components/LanguageContext";
import ImageProcessor from "@/components/ImageProcessor";

export default function ImageOptimizerClient() {
  const { t } = useLanguage();

  return (
    <PageShell>
      <Breadcrumb current={t("tool_image_title")} />
      <section className="flex-1 pb-12">
        <ImageProcessor />
      </section>
    </PageShell>
  );
}
