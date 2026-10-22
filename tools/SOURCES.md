# Open data sources used for the Philippine product catalogue

The BiliLIST prototype ships a catalogue of ~180 common Filipino grocery products
(`assets/js/data.js` → `CATALOGUE`) with the amount and unit each is normally
sold in. It was assembled from these free, public sources:

## 1. Philippine Statistics Authority (PSA) — Consumer Price Survey
Official government statistics. Used for the commodity-group structure and the
retail units (piece / kilogram / litre / pack) that Philippine households
actually shop in.

* CPI page: <https://psa.gov.ph/price-indices/cpi-ir>
* Statistical Tables (Sept 2026, 2018=100) — the workbook we pulled:
  `https://psa.gov.ph/system/files/psd/Statistical Tables on September 2026 CPI for All Income Households (2018=100)_f2j9p.xlsx`
* Technical Notes — CPI All Items:
  `https://psa.gov.ph/system/files/psd/Technical Notes - CPI All Items_19.pdf`
* Metro Manila Price Bulletin (Market Prices of Selected Commodities) — the
  rice / fish / meat / poultry / vegetable / fruit / basic-necessities list with
  the unit each is sold in:
  <https://psa.gov.ph/psa-media-service-market-prices-selected-commodities-metro-manila>

## 2. Wikipedia (CC BY-SA 4.0) — authentic local product names
Used for the Filipino product names and their market aliases (bagoong, patis,
toyo, sukang, ampalaya, sitao, kangkung, longganisa, tocino, chicharon, suman,
balut, kwek kwek …).

* `Category:Filipino cuisine` and its sub-categories
  (condiments, snack food, drinks, cheeses, breads, pastries, meat dishes,
  rice dishes, desserts, noodles, soups, stews, street food)
* Article: *Filipino cuisine* → "Native ingredients" and "Souring agents"
* Article: *Palengke* (the Philippine public wet market)

API used: `https://en.wikipedia.org/w/api.php`

## 3. Units
The retail units in `assets/js/data.js` → `UNITS` follow the PSA CPI
convention and add the market units a *palengke* actually uses (kilo, cavan,
picul, liyega, sakot, kaha, balot, papel, syahan).

---

### Note on fetching PSAI files
`psa.gov.ph` sits behind Cloudflare, so a plain `curl` / `requests` download
returns **403**. Only a real browser session can fetch the file. The helper in
`tools/receive.py` is a tiny loopback receiver used once to pull the workbook
out of the browser:

```bash
python tools/receive.py 8124
```

then, from a page on psa.gov.ph, `fetch()` the file and POST it to
`http://127.0.0.1:8124/<filename>`. The downloaded files are written to
`tools/_download/`.
