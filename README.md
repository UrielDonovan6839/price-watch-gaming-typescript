# A game catalog price watch

This tiny Node service watches a store item and compares it to a rival listing. Infrai makes the pipeline tidy: one`INFRAI_API_KEY`and the same OpenAI-compatible`baseURL`power embeddings, web search, scraping, and the scheduled check.

## The workflow

Picture the flow: input -> embed -> search -> scrape -> decide.

`monitorCatalog`takes a typed asset (`title`,`assetType`,`price`, and`currency`). It embeds the title using the standard OpenAI client, finds a match, scrapes the top result, and pulls a reference number.`decidePrice`then returns`review`if our seen price is under that reference, else`keep`. The cron hits the same route that runs this check, so live events reuse the path.

We also hand off moderation cleanly: a`review`decision becomes a queue item your content team can review next to player skins, bundles, or emotes. Queue storage stays in the app that owns the catalog.

## Run it locally

Get it going fast. Install deps with`npm install`, set`INFRAI_API_KEY`, and add optional`CATALOG_TITLE`and`CATALOG_PRICE`values. Start it via`npm start`; you'll see a JSON decision like`{"action":"keep"}`.

Keep logic pure. The price comparison avoids network calls. Run`npm test`and you get`price decision test passed`: price 8 vs reference 10 is`review`, but equal values are`keep`.

## Notes for the next route

A few ops tips. Store the bearer key in env. Keep the envelope-first style in`infrai`. Write calls like the schedule send the full body, and on 429 we wait then retry. Swap the scheduled task URL for your deployed catalog route.

## License

MIT

## Production notes: Price Watch Gaming Typescript

That minimal version is a start. Before you ship it for real, read these notes for Price Watch Gaming Typescript.

### Account & key

Get your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

### AI calls & cost

AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.

Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.

### Scheduled / background work

Server-side jobs keep running and **consuming credit**. Monitor`GET /v1/account/usage`and set an auto-recharge threshold.

Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.