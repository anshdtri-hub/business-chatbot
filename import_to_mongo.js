require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

// Define what a "Product" looks like in our database
const productSchema = new mongoose.Schema({
  name: String,
  priceText: String,
  link: String,
  category: String,
  description: String,
});

const Product = mongoose.model('Product', productSchema);

async function importCatalog() {
  try {
    // 1. Connect to MongoDB using the connection string from .env
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 2. Read our scraped catalog file
    const catalog = JSON.parse(fs.readFileSync('catalog.json', 'utf-8'));
    console.log(`Read ${catalog.length} products from catalog.json`);

    // 3. Clear out any old data first (safe to re-run this script anytime)
    await Product.deleteMany({});
    console.log('Cleared old products from database');

    // 4. Insert all products in one go
    await Product.insertMany(catalog);
    console.log(`Inserted ${catalog.length} products into MongoDB`);

    // 5. Quick sanity check - count what's actually in the DB now
    const count = await Product.countDocuments();
    console.log(`Database now contains ${count} products`);
  } catch (err) {
    console.error('Import failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

importCatalog();
