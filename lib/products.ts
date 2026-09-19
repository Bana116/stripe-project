export const PRODUCT_IDS = ["apple", "banana", "bread"] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];

export const PRODUCTS: Record<
  ProductId,
  { id: ProductId; amountCents: number }
> = {
  apple: { id: "apple", amountCents: 120 },
  banana: { id: "banana", amountCents: 60 },
  bread: { id: "bread", amountCents: 350 },
};

export function isProductId(value: string): value is ProductId {
  return (PRODUCT_IDS as readonly string[]).includes(value);
}
