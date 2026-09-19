const fs = require('fs');
const catalog = JSON.parse(fs.readFileSync('catalog.json', 'utf-8'));

const manualProduct = {
  name: 'FortiGate FortiWifi 40F',
  priceText: '₹80,000.00',
  link: 'https://ayanshinfo.com/product/fortigate-fortiwifi-40f/',
  category: 'Network Firewall',
  description: 'The FortiGate FortiWiFi 40F series integrates firewalling, SD-WAN, and security in one appliance, ideal for building security-driven networks at distributed enterprise sites.'
};

// avoid duplicate if already scraped
const exists = catalog.some(p => p.link === manualProduct.link);
if (!exists) {
  catalog.push(manualProduct);
  fs.writeFileSync('catalog.json', JSON.stringify(catalog, null, 2));
  console.log('Added manual product. New total:', catalog.length);
} else {
  console.log('Already in catalog, skipped.');
}
