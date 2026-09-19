const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// All category pages on the site
const CATEGORY_URLS = [
  'https://ayanshinfo.com/server-racks/',
  'https://ayanshinfo.com/floor-standing-rack/',
  'https://ayanshinfo.com/wall-mount-racks/',
  'https://ayanshinfo.com/mikrotik-routerboards-routers/',
  'https://ayanshinfo.com/network-switches-hub/',
  'https://ayanshinfo.com/wifi-router/',
  'https://ayanshinfo.com/wireless-network-equipment/',
  'https://ayanshinfo.com/product-category/network-firewall/',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeCategory(url) {
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);
  const products = [];

  $('li.product, li.type-product').each((i, el) => {
    const name = $(el).find('.woocommerce-loop-product__title, h2, h3').first().text().trim();
    const priceText = $(el).find('.price').first().text().trim();
    const link = $(el).find('a').first().attr('href');
    if (name && link) {
      products.push({ name, priceText, link });
    }
  });

  return products;
}

// Visit an individual product page to grab its description
async function scrapeProductDetail(url) {
  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const description = $('.woocommerce-product-details__short-description, .woocommerce-Tabs-panel--description')
      .first()
      .text()
      .trim()
      .replace(/\s+/g, ' ');

    return description || '';
  } catch (err) {
    console.log(`  (could not fetch detail page: ${url})`);
    return '';
  }
}

(async () => {
  const category = (url) => {
    // turn URL slug into a readable category name, e.g. "mikrotik-routerboards-routers" -> "Mikrotik Routerboards Routers"
    const slug = url.replace('https://ayanshinfo.com/', '').replace('product-category/', '').replace(/\/$/, '');
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  let allProducts = [];

  for (const catUrl of CATEGORY_URLS) {
    console.log(`Scraping category: ${catUrl}`);
    try {
      const products = await scrapeCategory(catUrl);
      console.log(`  -> found ${products.length} products`);
      products.forEach((p) => (p.category = category(catUrl)));
      allProducts = allProducts.concat(products);
    } catch (err) {
      console.log(`  !! failed to scrape ${catUrl}: ${err.message}`);
    }
    await sleep(500); // be polite to the server
  }

  console.log(`\nTotal products found: ${allProducts.length}`);
  console.log('Now fetching descriptions from each product page (this takes a bit)...\n');

  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i];
    process.stdout.write(`  (${i + 1}/${allProducts.length}) ${p.name}\r`);
    p.description = await scrapeProductDetail(p.link);
    await sleep(400);
  }

  fs.writeFileSync('catalog.json', JSON.stringify(allProducts, null, 2));
  console.log(`\n\nDone. Saved ${allProducts.length} products to catalog.json`);
})();