"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { HomeIcon } from "@/components/Icons";
import { StripeLockup } from "@/components/StripeMark";
import { UI, isLocale, speechLang, localeDir, type Locale } from "@/lib/i18n";

function SuccessBody() {
  const params = useSearchParams();
  const langParam = params.get("lang") ?? "en";
  const locale: Locale = isLocale(langParam) ? langParam : "en";
  const copy = UI[locale];

  useEffect(() => {
    document.documentElement.lang = speechLang(locale);
    document.documentElement.dir = localeDir(locale);
    const utterance = new SpeechSynthesisUtterance(copy.successBody);
    utterance.lang = speechLang(locale);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [copy.successBody, locale]);

  return (
    <main className="app end-page">
      <h1>{copy.successTitle}</h1>
      <p>{copy.successBody}</p>
      <a className="btn btn-primary" href="/">
        <HomeIcon />
        <span>{copy.home}</span>
      </a>
      <footer className="site-footer">
        <StripeLockup label={copy.poweredBy} />
      </footer>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessBody />
    </Suspense>
  );
}
