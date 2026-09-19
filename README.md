# Business Chatbot (Backend)

A chatbot backend for Ayansh Infocom, a wholesale supplier of networking equipment (cables, routers, switches, racks, firewalls). A customer asks a question, and the bot answers using real products from the company's catalog.

**Status: in progress.** The backend works and has been tested locally. The chat web page (frontend) and online hosting are still to do.

## How it works
1. `scrape.js` collects 53 products (name, price, category, description) from the company's website into `catalog.json`.
2. `import_to_mongo.js` loads those products into MongoDB Atlas.
3. `server.js` runs an Express API. When a question arrives at `POST /chat`, it:
   - searches the products for keywords from the question,
   - sends the matching products to the Gemini API in a prompt that tells it to answer only from that list,
   - returns the answer, and retries up to 3 times if Google's servers are temporarily overloaded.

## Tech stack
Node.js, Express, MongoDB Atlas (Mongoose), Google Gemini API, axios and cheerio for scraping.

## API
- `POST /chat` with body `{ "message": "Which routers do you have?" }` returns `{ "reply": "..." }`
- `GET /` returns a short message that shows the server is running
- `GET /test-products` returns 3 products from the database

## Run it yourself
```
git clone https://github.com/anshdtri-hub/business-chatbot.git
cd business-chatbot
npm install
```

Create a `.env` file (it is not in this repo, on purpose) with:
```
MONGODB_URI=your MongoDB Atlas connection string
GEMINI_API_KEY=your Gemini API key
```

Load the products, then start the server:
```
node import_to_mongo.js
npm start
```

Try it (Windows PowerShell):
```
Invoke-RestMethod -Uri http://localhost:3000/chat -Method Post -ContentType "application/json" -Body '{"message":"Which routers do you have?"}'
```

## Planned
- A chat web page for customers
- Hosting the server online