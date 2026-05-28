"use client";

import dynamic from "next/dynamic";

const HeroDropZone = dynamic(() => import("@/components/landing/HeroDropZone"), { ssr: false });
const StatsBar = dynamic(() => import("@/components/landing/StatsBar"), { ssr: false });
const BentoGrid = dynamic(() => import("@/components/landing/BentoGrid"), { ssr: false });
const FeatureHighlights = dynamic(
  () => import("@/components/landing/FeatureHighlights"),
  { ssr: false }
);
const TechBadges = dynamic(() => import("@/components/landing/TechBadges"), { ssr: false });

export default function LandingContent() {
  return (
    <>
      <HeroDropZone />
      <StatsBar />
      <BentoGrid />
      <FeatureHighlights />
      <TechBadges />
    </>
  );
}
