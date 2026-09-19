import { speechLang, type Locale } from "@/lib/i18n";

export function unlockSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.resume();
    const warm = new SpeechSynthesisUtterance(" ");
    warm.volume = 0;
    warm.rate = 2;
    window.speechSynthesis.speak(warm);
    window.speechSynthesis.cancel();
    window.speechSynthesis.getVoices();
  } catch {
    // Some browsers throw if speech is unavailable; the later speak() call reports that.
  }
}

export function pickVoice(locale: Locale): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const wanted = speechLang(locale).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === wanted) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${locale}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(locale))
  );
}

export function speak(text: string, locale: Locale) {
  if (!text || typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;

  synth.cancel();
  synth.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang(locale);
  utterance.rate = 0.95;
  utterance.volume = 1;
  const voice = pickVoice(locale);
  if (voice) utterance.voice = voice;

  const play = () => {
    synth.speak(utterance);
    if (synth.paused) synth.resume();
  };

  if (synth.getVoices().length === 0) {
    synth.addEventListener("voiceschanged", play, { once: true });
    window.setTimeout(play, 250);
    return;
  }

  play();
}

export function cameraFailureMessage(
  error: unknown,
  copy: { cameraDenied: string; cameraMissing: string; cameraError: string },
): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: string }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return copy.cameraDenied;
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return copy.cameraMissing;
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return copy.cameraError;
  }
  if (error instanceof Error && error.message === "unsupported") {
    return copy.cameraError;
  }
  return copy.cameraError;
}
