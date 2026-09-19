"use client";

import { useEffect, useRef, useState } from "react";
import {
  LOCALES,
  UI,
  isLocale,
  localeDir,
  speechLang,
  type Locale,
} from "@/lib/i18n";
import type { ProductId } from "@/lib/products";
import {
  bindStreamToVideo,
  canUseLiveCamera,
  getCameraStream,
  isMobileDevice,
} from "@/lib/camera";
import { compressImage } from "@/lib/image";
import { cameraFailureMessage, speak, unlockSpeech } from "@/lib/speech";
import {
  BackIcon,
  CameraIcon,
  CartIcon,
  CheckIcon,
  GlobeIcon,
  NextIcon,
} from "@/components/Icons";
import { StripeLockup, StripeMark } from "@/components/StripeMark";

type IdentifyResponse = {
  product: ProductId | null;
  name?: string;
  price?: string;
  spokenText?: string;
  message?: string;
  error?: string;
};

type Step = "language" | "scan" | "confirm";

function waitForFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      if (Date.now() - start > 8000) {
        reject(new Error("timeout"));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function Dots() {
  return (
    <div className="dots" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [step, setStep] = useState<Step>("language");
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState(false);
  const [useNativeCapture, setUseNativeCapture] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<IdentifyResponse | null>(null);
  const [inCart, setInCart] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copy = UI[locale];

  useEffect(() => {
    setUseNativeCapture(isMobileDevice() || !canUseLiveCamera());
    const refresh = () => window.speechSynthesis.getVoices();
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  useEffect(() => {
    document.documentElement.lang = speechLang(locale);
    document.documentElement.dir = localeDir(locale);
  }, [locale]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function continueFromLanguage() {
    unlockSpeech();
    setError("");
    setStatus("");
    setStep("scan");
    speak(copy.step2Body, locale);
  }

  function goBack() {
    unlockSpeech();
    setError("");
    setStatus("");
    setBuying(false);
    if (step === "scan") {
      setStep("language");
      speak(copy.step1Body, locale);
      return;
    }
    if (step === "confirm") {
      setResult(null);
      setInCart(false);
      setStep("scan");
      speak(copy.step2Body, locale);
    }
  }

  async function identifyFromDataUrl(dataUrl: string) {
    setBusy(true);
    setError("");
    setResult(null);
    setStatus(copy.identifying);
    try {
      const image = await compressImage(dataUrl);
      const response = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, language: locale }),
      });
      const data = (await response.json()) as IdentifyResponse;
      if (!response.ok) {
        throw new Error(data.error ?? copy.errorIdentify);
      }
      if (!data.product) {
        const spoken = data.spokenText ?? data.message ?? copy.unknown;
        setStatus(spoken);
        speak(spoken, locale);
        return;
      }
      setResult(data);
      setInCart(false);
      setStep("confirm");
      const spoken = data.spokenText ?? `${data.name ?? ""} ${data.price ?? ""}`.trim();
      setStatus(spoken);
      speak(spoken, locale);
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.errorIdentify;
      setError(message);
      speak(message, locale);
    } finally {
      setBusy(false);
    }
  }

  async function takeLivePhoto() {
    setBusy(true);
    setError("");
    const video = videoRef.current;
    if (!video) {
      throw new Error(copy.cameraError);
    }
    const stream = await getCameraStream();
    streamRef.current = stream;
    bindStreamToVideo(video, stream);
    await waitForFrame(video);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(copy.cameraError);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopStream();
    await identifyFromDataUrl(dataUrl);
  }

  function openNativeCamera() {
    const input = fileInputRef.current;
    if (!input) {
      setError(copy.cameraError);
      speak(copy.cameraError, locale);
      return;
    }
    input.click();
  }

  function onScanProduct() {
    if (busy) return;
    setError("");
    unlockSpeech();
    speak(copy.identifying, locale);

    if (useNativeCapture) {
      openNativeCamera();
      return;
    }

    void takeLivePhoto().catch((err) => {
      stopStream();
      setBusy(false);
      const message = cameraFailureMessage(err, copy);
      setError(message);
      speak(message, locale);
      openNativeCamera();
    });
  }

  function onPhotoSelected(file: File | undefined) {
    if (!file) return;
    unlockSpeech();
    const reader = new FileReader();
    reader.onerror = () => {
      setBusy(false);
      setError(copy.errorIdentify);
      speak(copy.errorIdentify, locale);
    };
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        await identifyFromDataUrl(reader.result);
      }
    };
    setBusy(true);
    reader.readAsDataURL(file);
  }

  function addToCart() {
    if (!result?.product) return;
    unlockSpeech();
    setInCart(true);
    setError("");
    setStatus(copy.addedToCart);
    speak(copy.addedToCart, locale);
  }

  function retakePhoto() {
    unlockSpeech();
    setResult(null);
    setInCart(false);
    setError("");
    setStatus("");
    setStep("scan");
    speak(copy.step2Body, locale);
  }

  async function buyNow() {
    if (!result?.product) return;
    setBuying(true);
    setError("");
    speak(copy.buying, locale);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: result.product, language: locale }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? copy.errorCheckout);
      }
      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.errorCheckout;
      setError(message);
      speak(message, locale);
      setBuying(false);
    }
  }

  return (
    <main className="app" id="main">
      {step === "language" ? (
        <a className="skip" href="#language">
          {copy.language}
        </a>
      ) : (
        <a className="skip" href="#primary-action">
          {step === "scan" ? copy.scanProduct : copy.purchaseWithStripe}
        </a>
      )}

      <header className="home-header">
        <h1>{copy.title}</h1>
        {step === "language" ? <p className="lede">{copy.step1Body}</p> : null}
        {step === "scan" ? <p className="lede">{copy.step2Body}</p> : null}
        {step === "confirm" && result?.name ? (
          <p className="lede">
            {result.name} · {result.price}
          </p>
        ) : null}
      </header>

      {step === "language" ? (
        <div className="bento bento-single">
          <div className="tile tile-lang tile-wide">
            <span className="icon-badge" aria-hidden="true">
              <GlobeIcon />
            </span>
            <span className="tile-kicker">{copy.step1}</span>
            <label className="tile-title" htmlFor="language">
              {copy.language}
            </label>
            <select
              id="language"
              className="lang-select"
              value={locale}
              onChange={(event) => {
                const next = event.target.value;
                if (isLocale(next)) {
                  unlockSpeech();
                  setLocale(next);
                  speak(UI[next].step1Body, next);
                }
              }}
            >
              {LOCALES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" type="button" onClick={continueFromLanguage}>
              <NextIcon />
              <span>{copy.continue}</span>
            </button>
          </div>
        </div>
      ) : null}

      {step === "scan" ? (
        <div className="bento bento-single">
          <button
            id="primary-action"
            className="tile tile-scan"
            type="button"
            disabled={busy}
            onClick={onScanProduct}
          >
            <span className="icon-badge" aria-hidden="true">
              <CameraIcon />
            </span>
            <span className="tile-kicker">{copy.step2}</span>
            <span className="tile-title">{copy.scanProduct}</span>
            {busy ? (
              <>
                <span className="visually-hidden">{copy.processing}</span>
                <Dots />
              </>
            ) : (
              <span className="tile-hint">{copy.step2Body}</span>
            )}
          </button>
        </div>
      ) : null}

      {step === "confirm" && result?.product ? (
        <section className="confirm-screen" aria-live="polite">
          <img className="confirm-photo" src="/apple.png" alt={result.name ?? "Apple"} />
          <p className="confirm-name">{result.name}</p>
          <p className="confirm-price">{result.price}</p>
          <button className="btn btn-secondary btn-xl" type="button" onClick={addToCart} disabled={inCart}>
            {inCart ? <CheckIcon /> : <CartIcon />}
            <span>{inCart ? copy.addedToCart : copy.addToCart}</span>
          </button>
          <button
            className="btn btn-primary btn-xl"
            id="primary-action"
            type="button"
            onClick={buyNow}
            disabled={buying}
          >
            <StripeMark variant="white" />
            <span>{buying ? copy.buying : copy.purchaseWithStripe}</span>
          </button>
          <button className="btn btn-secondary" type="button" onClick={retakePhoto} disabled={buying}>
            <CameraIcon />
            <span>{copy.retakePhoto}</span>
          </button>
        </section>
      ) : null}

      {step !== "language" ? (
        <div className="nav-actions">
          <button className="btn btn-secondary" type="button" onClick={goBack} disabled={busy || buying}>
            <BackIcon />
            <span>{copy.back}</span>
          </button>
          {step === "scan" ? (
            <button className="btn btn-secondary" type="button" onClick={() => { setError(""); setStep("language"); }} disabled={busy}>
              <GlobeIcon />
              <span>{copy.changeLanguage}</span>
            </button>
          ) : null}
          {step === "scan" && error ? (
            <button className="btn btn-secondary" type="button" onClick={onScanProduct} disabled={busy}>
              <CameraIcon />
              <span>{copy.tryAgain}</span>
            </button>
          ) : null}
          {step === "confirm" && error ? (
            <button className="btn btn-secondary" type="button" onClick={buyNow} disabled={buying}>
              <CartIcon />
              <span>{copy.tryAgain}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <video
        ref={videoRef}
        className="camera-preload"
        playsInline
        muted
        autoPlay
        controls={false}
        aria-hidden="true"
      />

      <input
        ref={fileInputRef}
        className="ready-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onPhotoSelected(file);
        }}
      />

      <p className={`status${error ? " error" : ""}`} aria-live="polite" role="status">
        {error || (step === "scan" || step === "confirm" ? status : "")}
      </p>

      <footer className="site-footer">
        <StripeLockup label={copy.poweredBy} />
      </footer>
    </main>
  );
}
