"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { HomeIcon } from "@/components/Icons";
import { StripeLockup } from "@/components/StripeMark";
import { UI, isLocale, speechLang, localeDir, type Locale } from "@/lib/i18n";

function CancelBody() {
  const params = useSearchParams();
  const langParam = params.get("lang") ?? "en";
  const locale: Locale = isLocale(langParam) ? langParam : "en";
  const copy = UI[locale];

  useEffect(() => {
    document.documentElement.lang = speechLang(locale);
    document.documentElement.dir = localeDir(locale);
    const utterance = new SpeechSynthesisUtterance(copy.cancelBody);
    utterance.lang = speechLang(locale);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [copy.cancelBody, locale]);

  return (
    <main className="app end-page">
      <h1>{copy.cancelTitle}</h1>
      <p>{copy.cancelBody}</p>
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

export default function CancelPage() {
  return (
    <Suspense>
      <CancelBody />
    </Suspense>
  );
}
