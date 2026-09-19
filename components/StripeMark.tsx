type StripeMarkProps = {
  variant?: "white" | "blurple";
};

export function StripeMark({ variant = "white" }: StripeMarkProps) {
  const src =
    variant === "blurple" ? "/stripe-wordmark.svg" : "/stripe-wordmark-white.svg";
  return (
    <img
      className="stripe-mark"
      src={src}
      alt="Stripe"
      width={96}
      height={40}
    />
  );
}

export function StripeLockup({
  label,
  variant = "blurple",
}: {
  label: string;
  variant?: "white" | "blurple";
}) {
  return (
    <a
      className="stripe-lockup"
      href="https://stripe.com"
      rel="noopener noreferrer"
      target="_blank"
    >
      <span>{label}</span>
      <StripeMark variant={variant} />
    </a>
  );
}
