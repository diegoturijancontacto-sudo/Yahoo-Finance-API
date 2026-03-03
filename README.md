# Yahoo Finance API Proxy

A lightweight Node.js / Express proxy server that bridges a front-end client and the Yahoo Finance API, resolving CORS and response-format limitations so you can query real-time stock quotes from any browser or server-side application.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the server](#running-the-server)
4. [API Endpoints](#api-endpoints)
   - [GET /api/quote](#get-apiquote)
   - [POST /api/quote](#post-apiquote)
   - [GET /health](#get-health)
5. [Response Format](#response-format)
6. [Error Handling](#error-handling)
7. [License](#license)

---

## Prerequisites

- [Node.js](https://nodejs.org/) **v18 or higher**
- npm (comes bundled with Node.js)

---

## Installation

```bash
# Clone the repository
git clone https://github.com/diegoturijancontacto-sudo/Yahoo-Finance-API.git
cd Yahoo-Finance-API

# Install dependencies
npm install
```

---

## Running the server

```bash
# Production
npm start

# Development (auto-restarts on file changes with nodemon)
npm run dev
```

The server listens on **port 3000** by default.  
Override it with the `PORT` environment variable:

```bash
PORT=8080 npm start
```

---

## API Endpoints

### GET /api/quote

Fetch real-time quote data for one or more ticker symbols.

| Parameter | Type   | Required | Description                                         |
|-----------|--------|----------|-----------------------------------------------------|
| `symbols` | string | ✅ yes   | Comma-separated list of ticker symbols (e.g. `AAPL,MSFT,GOOGL`) |

**Example request**

```
GET http://localhost:3000/api/quote?symbols=AAPL,MSFT,GOOGL
```

Using `curl`:

```bash
curl "http://localhost:3000/api/quote?symbols=AAPL,MSFT"
```

**Example response**

```json
{
  "quotes": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "price": 189.84,
      "changePercent": 1.23,
      "volume": 55312400,
      "marketCap": 2940000000000,
      "week52High": 199.62,
      "week52Low": 124.17,
      "currency": "USD"
    },
    {
      "symbol": "MSFT",
      "name": "Microsoft Corporation",
      "price": 415.32,
      "changePercent": -0.47,
      "volume": 18743200,
      "marketCap": 3080000000000,
      "week52High": 430.82,
      "week52Low": 309.45,
      "currency": "USD"
    }
  ]
}
```

---

### POST /api/quote

Alternative batch endpoint that accepts ticker symbols in the **request body** instead of the query string.

**Request body (JSON)**

```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL"]
}
```

**Example request**

```bash
curl -X POST http://localhost:3000/api/quote \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL", "TSLA"]}'
```

**Example response** — same shape as the GET endpoint.

---

### GET /health

Simple health-check endpoint. Returns the server status and current UTC timestamp.

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "timestamp": "2024-06-01T12:00:00.000Z"
}
```

---

## Response Format

Each item in the `quotes` array contains the following fields:

| Field           | Type             | Description                              |
|-----------------|------------------|------------------------------------------|
| `symbol`        | string \| null   | Ticker symbol (e.g. `"AAPL"`)            |
| `name`          | string \| null   | Company short name                       |
| `price`         | number \| null   | Current market price                     |
| `changePercent` | number \| null   | Percentage change (rounded to 2 decimals)|
| `volume`        | number \| null   | Regular market trading volume            |
| `marketCap`     | number \| null   | Market capitalisation in the base currency |
| `week52High`    | number \| null   | 52-week high price                       |
| `week52Low`     | number \| null   | 52-week low price                        |
| `currency`      | string \| null   | Currency code (e.g. `"USD"`)             |

---

## Error Handling

| HTTP Status | Meaning                                                                 |
|-------------|-------------------------------------------------------------------------|
| `400`       | Bad request — missing or invalid `symbols` parameter / body field       |
| `404`       | No data found for the provided symbols                                  |
| `502`       | Bad gateway — upstream Yahoo Finance request failed                     |

**Error response shape**

```json
{
  "error": "Human-readable error message.",
  "detail": "Optional detail from the upstream service."
}
```

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
