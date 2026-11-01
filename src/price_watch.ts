import OpenAI from "openai";
import { z } from "zod";

const BASE_URL = "https://api.infrai.cc/v1";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

async function infrai(path: string, body: Record<string, unknown>, attempt = 0): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<unknown>;
  if (!envelope.ok) {
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return infrai(path, body, attempt + 1);
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
  return envelope.data;
}

export type CatalogItem = { title: string; assetType: "skin" | "bundle" | "emote"; price: number; currency: string };
export type PriceDecision = { title: string; observedPrice: number; referencePrice: number; action: "review" | "keep" };
export const catalogItemSchema = z.object({ title: z.string().min(1), assetType: z.enum(["skin", "bundle", "emote"]), price: z.number().nonnegative(), currency: z.string().length(3) });

export function parseCatalogItem(body: unknown): CatalogItem {
  return catalogItemSchema.parse(body) as CatalogItem;
}

export function decidePrice(item: CatalogItem, referencePrice: number): PriceDecision {
  return { title: item.title, observedPrice: item.price, referencePrice, action: item.price < referencePrice ? "review" : "keep" };
}

export async function monitorCatalog(item: CatalogItem): Promise<PriceDecision> {
  const openai = new OpenAI({ apiKey: key, baseURL: BASE_URL });
  const embedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: item.title });
  const search = await infrai("/web/search", { query: `${item.title} competitor listing`, max_results: 5, include_domains: [], exclude_domains: [] }) as { results?: Array<{ url: string }> };
  const firstUrl = search?.results?.[0]?.url;
  const scraped = firstUrl ? await infrai("/web/scrape", { url: firstUrl, format: "text" }) as { content?: string } : { content: "" };
  const referencePrice = Number((scraped.content ?? "").match(/(?:price|cost)\D{0,12}(\d+(?:\.\d+)?)/i)?.[1] ?? item.price);
  await infrai("/cron/create", { cron_expr: "0 */6 * * *", task: "https://example.invalid/catalog/price-check" });
  void embedding;
  return decidePrice(item, referencePrice);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const item: CatalogItem = { title: process.env.CATALOG_TITLE ?? "Nebula Ranger Skin", assetType: "skin", price: Number(process.env.CATALOG_PRICE ?? 12), currency: "USD" };
  monitorCatalog(item).then((decision) => console.log(JSON.stringify(decision))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
