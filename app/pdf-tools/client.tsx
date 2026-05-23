"use client";

import { PageShell, Breadcrumb } from "@/components/SharedLayout";
import { useLanguage } from "@/components/LanguageContext";
import PdfProcessor from "@/components/PdfProcessor";

export default function PdfToolsClient() {
  const { t } = useLanguage();

  return (
    <PageShell>
      <Breadcrumb current={t("tool_pdf_title")} />
      <section className="flex-1 pb-12">
        <PdfProcessor />
      </section>
    </PageShell>
  );
}
