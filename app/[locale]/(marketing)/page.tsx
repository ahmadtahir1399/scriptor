import { setRequestLocale } from "next-intl/server";

import { AnchoredViewer } from "@/components/marketing/AnchoredViewer";
import { CheckCatalogue } from "@/components/marketing/CheckCatalogue";
import { DefenseStudio } from "@/components/marketing/DefenseStudio";
import { DriftGallery } from "@/components/marketing/DriftGallery";
import { Faq } from "@/components/marketing/Faq";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Hero } from "@/components/marketing/Hero";
import { ReferenceHealth } from "@/components/marketing/ReferenceHealth";
import { Requirements } from "@/components/marketing/Requirements";

/**
 * The landing page.
 *
 * Composition only. Each section owns its own copy, its own motion and its own
 * ground colour, so adding one is adding a line here rather than editing a
 * six-hundred-line file — and a section can be reordered or pulled without
 * touching anything else.
 *
 * The order is an argument:
 *   what it is (Hero)
 *   → what it looks for (CheckCatalogue)
 *   → and what YOU tell it to look for (Requirements)
 *   → where the answers land (AnchoredViewer)
 *   → the bibliography case in full (ReferenceHealth)
 *   → everything you get back (DriftGallery)
 *
 * Grounds alternate linen / sage down that list. The alternation is why no
 * section carries a `border-t`: the change of ground is the seam.
 */
export default async function LandingPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <CheckCatalogue />
      <Requirements />
      <AnchoredViewer />
      <ReferenceHealth />
      <DefenseStudio />
      <DriftGallery />
      <Faq />
      <FinalCta />
    </>
  );
}
