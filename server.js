require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Set up Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

// Same product schema as before
const productSchema = new mongoose.Schema({
  name: String,
  priceText: String,
  link: String,
  category: String,
  description: String,
});
const Product = mongoose.model('Product', productSchema);

// Connect to MongoDB once when the server starts
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

// Simple test route - just confirms the server is alive
app.get('/', (req, res) => {
  res.send('Chatbot backend is running');
});

// Test route - confirms we can pull data from MongoDB
app.get('/test-products', async (req, res) => {
  try {
    const products = await Product.find().limit(3);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// THE MAIN CHATBOT ROUTE
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: 'No message provided' });
    }

    // 1. Search MongoDB for products that might be relevant to this question.
    //    Break the message into words, ignore short/common ones, then match
    //    any product whose name/category/description contains any of those words.
    const stopWords = ['what', 'which', 'the', 'is', 'are', 'do', 'you', 'have', 'and', 'for', 'a', 'an', 'to', 'of', 'in', 'me', 'my', 'i'];
    const keywords = userMessage
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.includes(word));

    const searchConditions = keywords.length > 0
      ? keywords.flatMap((word) => [
          { name: { $regex: word, $options: 'i' } },
          { category: { $regex: word, $options: 'i' } },
          { description: { $regex: word, $options: 'i' } },
        ])
      : [];

    const relevantProducts = searchConditions.length > 0
      ? await Product.find({ $or: searchConditions }).limit(10)
      : [];

    // If keyword search finds nothing, fall back to sending a broader sample
    // so Gemini still has something to reference (e.g. for vague questions).
    const productsForContext = relevantProducts.length > 0
      ? relevantProducts
      : await Product.find().limit(15);

    // 2. Build a prompt that gives Gemini the product data + instructions
    const productList = productsForContext
      .map((p) => `- ${p.name} | Category: ${p.category} | Price: ${p.priceText}${p.description ? ` | ${p.description}` : ''}`)
      .join('\n');

    console.log('DEBUG - products sent to Gemini:', productsForContext.length);
    console.log('DEBUG - product list:\n', productList);

    const prompt = `You are a helpful sales assistant for Ayansh Infocom, a wholesale supplier of networking equipment (cables, routers, switches, racks, firewalls) to ISPs and dealers.

Here is a list of relevant products from our catalog:
${productList}

Customer question: "${userMessage}"

Instructions:
- Answer using ONLY the products listed above. Do not invent products or prices that aren't listed.
- If comparing products, briefly explain the practical difference (use case, price, specs).
- Give approximate prices exactly as listed.
- If the question can't be answered from the list above, politely say you'll have a team member follow up, and suggest they WhatsApp/call for details.
- Keep the tone friendly and professional, like a knowledgeable salesperson. Keep answers concise.`;

    // 3. Ask Gemini, with a couple of retries if Google's servers are
    //    temporarily overloaded (503 errors) - common on the free tier.
    let reply;
    let lastError;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        reply = result.response.text();
        break; // success, stop retrying
      } catch (err) {
        lastError = err;
        const isOverloaded = err.message && err.message.includes('503');
        if (isOverloaded && attempt < maxAttempts) {
          console.log(`Gemini overloaded, retrying (attempt ${attempt + 1}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt)); // wait longer each retry
          continue;
        }
        throw err; // not overloaded, or out of retries - give up
      }
    }

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    const isOverloaded = err.message && err.message.includes('503');
    res.status(503).json({
      error: isOverloaded
        ? "Our AI assistant is temporarily busy - please try again in a few seconds."
        : 'Something went wrong, please try again.',
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
