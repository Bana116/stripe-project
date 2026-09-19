import { isLocale, spokenAnnouncement, formatPrice, productName } from "@/lib/i18n";
import { PRODUCTS, type ProductId } from "@/lib/products";

export async function POST(request: Request) {
  let body: { image?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid photo data was sent. Please scan again." }, { status: 400 });
  }

  const language = body.language ?? "en";
  if (!isLocale(language)) {
    return Response.json({ error: "Unsupported language." }, { status: 400 });
  }

  const product: ProductId = "apple";
  const amountCents = PRODUCTS[product].amountCents;

  return Response.json({
    product,
    name: productName(product, language),
    price: formatPrice(amountCents, language),
    amountCents,
    spokenText: spokenAnnouncement(product, language),
    message: `${productName(product, language)}. ${formatPrice(amountCents, language)}.`,
  });
}
