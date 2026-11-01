import assert from "node:assert/strict";
import { decidePrice } from "../src/price_watch";

const item = { title: "Aurora Bundle", assetType: "bundle" as const, price: 8, currency: "USD" };
assert.equal(decidePrice(item, 10).action, "review");
assert.equal(decidePrice(item, 8).action, "keep");
console.log("price decision test passed");
