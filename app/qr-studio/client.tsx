"use client";

import { PageShell, Breadcrumb } from "@/components/SharedLayout";
import { useLanguage } from "@/components/LanguageContext";
import QrStudio from "@/components/QrStudio";

export default function QrStudioClient() {
  const { t } = useLanguage();

  return (
    <PageShell>
      <Breadcrumb current={t("tool_qr_title")} />
      <section className="flex-1 pb-12">
        <QrStudio />
      </section>
    </PageShell>
  );
}
