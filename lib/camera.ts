export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return (
    iPadOs ||
    /iPhone|iPad|iPod|Android|webOS|CriOS|FxiOS|Mobile/i.test(ua) ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function canUseLiveCamera(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function preferNativeCameraCapture(): boolean {
  return isMobileDevice() && !canUseLiveCamera();
}

export async function getCameraStream(): Promise<MediaStream> {
  if (!canUseLiveCamera()) {
    throw new Error("unsupported");
  }

  const mobile = isMobileDevice();
  const attempts: MediaStreamConstraints[] = mobile
    ? [
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        { audio: false, video: true },
      ]
    : [
        { audio: false, video: true },
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        { audio: false, video: { facingMode: "user" } },
      ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("camera");
}

export function bindStreamToVideo(video: HTMLVideoElement, stream: MediaStream) {
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "true");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  (video as HTMLVideoElement & { webkitPlaysInline?: boolean }).webkitPlaysInline =
    true;
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }

  const play = () => {
    void video.play().catch(() => undefined);
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    play();
  } else {
    video.onloadedmetadata = play;
  }
}
