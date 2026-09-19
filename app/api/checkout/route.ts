import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import Stripe from "stripe";
import { isLocale, productName } from "@/lib/i18n";
import { isProductId, PRODUCTS } from "@/lib/products";

const execFileAsync = promisify(execFile);

function stripeCliPath(): string {
  const candidates = [
    process.env.STRIPE_CLI_PATH,
    "/opt/homebrew/bin/stripe",
    "/usr/local/bin/stripe",
  ].filter((value): value is string => Boolean(value));
  const found = candidates.find((path) => existsSync(path));
  return found ?? "stripe";
}

function parseStripeJson(text: string): { url?: string; id?: string; livemode?: boolean } {
  const match = text.match(/\{[\s\S]*\}\s*$/);
  if (!match) {
    throw new Error("Stripe CLI did not return a Checkout Session.");
  }
  return JSON.parse(match[0]) as { url?: string; id?: string; livemode?: boolean };
}

async function createSessionWithCli(params: {
  name: string;
  amountCents: number;
  language: string;
  origin: string;
}): Promise<string> {
  const { stdout } = await execFileAsync(
    stripeCliPath(),
    [
      "checkout",
      "sessions",
      "create",
      "--confirm",
      "--mode",
      "payment",
      "--success-url",
      `${params.origin}/success?lang=${params.language}`,
      "-d",
      `cancel_url=${params.origin}/cancel?lang=${params.language}`,
      "-d",
      "line_items[0][quantity]=1",
      "-d",
      "line_items[0][price_data][currency]=usd",
      "-d",
      `line_items[0][price_data][unit_amount]=${params.amountCents}`,
      "-d",
      `line_items[0][price_data][product_data][name]=${params.name}`,
    ],
    {
      timeout: 20000,
      env: process.env,
    },
  );
  const session = parseStripeJson(stdout);
  if (session.livemode) {
    throw new Error("Refusing live-mode Checkout. This demo uses test/sandbox only.");
  }
  if (!session.url) {
    throw new Error("Stripe Checkout did not return a URL.");
  }
  return session.url;
}

export async function POST(request: Request) {
  let body: { product?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.product || !isProductId(body.product)) {
    return Response.json({ error: "A recognized product is required." }, { status: 400 });
  }

  const language = body.language && isLocale(body.language) ? body.language : "en";
  const product = PRODUCTS[body.product];
  const origin = request.headers.get("origin") ?? process.env.APP_URL ?? "http://localhost:3000";
  const name = productName(product.id, language);
  const secret = process.env.STRIPE_SECRET_KEY?.trim();

  try {
    if (secret) {
      if (secret.startsWith("sk_live_") || secret.startsWith("rk_live_")) {
        return Response.json(
          { error: "Live Stripe keys are disabled. Use a test or sandbox key." },
          { status: 400 },
        );
      }
      const stripe = new Stripe(secret);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        submit_type: "pay",
        billing_address_collection: "auto",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: product.amountCents,
              product_data: {
                name,
                description: `Accessible shopping assistant (${product.id})`,
              },
            },
          },
        ],
        success_url: `${origin}/success?lang=${language}`,
        cancel_url: `${origin}/cancel?lang=${language}`,
      });
      if (session.livemode) {
        return Response.json(
          { error: "Refusing live-mode Checkout. This demo uses test/sandbox only." },
          { status: 400 },
        );
      }
      if (!session.url) {
        return Response.json({ error: "Stripe Checkout did not return a URL." }, { status: 502 });
      }
      return Response.json({ url: session.url });
    }

    const url = await createSessionWithCli({
      name,
      amountCents: product.amountCents,
      language,
      origin,
    });
    return Response.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout could not start. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
