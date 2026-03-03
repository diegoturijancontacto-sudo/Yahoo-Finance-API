const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Yahoo Finance helper ──────────────────────────────────────────────────────

/**
 * Fetch quote data for one or more tickers from Yahoo Finance v7 quote API.
 * Returns an array of shaped quote objects.
 *
 * @param {string[]} symbols - Array of ticker symbols (e.g. ['AAPL', 'MSFT'])
 * @returns {Promise<Object[]>}
 */
async function fetchQuotes(symbols) {
  const joined = symbols.map((s) => s.toUpperCase().trim()).join(',');

  const url = 'https://query1.finance.yahoo.com/v7/finance/quote';

  const { data } = await axios.get(url, {
    params: {
      symbols: joined,
      fields: [
        'symbol',
        'shortName',
        'regularMarketPrice',
        'regularMarketChangePercent',
        'regularMarketVolume',
        'marketCap',
        'fiftyTwoWeekHigh',
        'fiftyTwoWeekLow',
        'currency',
      ].join(','),
    },
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; YahooFinanceProxy/1.0)',
    },
    timeout: 10000,
  });

  const results = data?.quoteResponse?.result;
  if (!results || results.length === 0) {
    return [];
  }

  // ── Data Shaping ─────────────────────────────────────────────────────────
  return results.map((q) => ({
    symbol: q.symbol ?? null,
    name: q.shortName ?? null,
    price: q.regularMarketPrice ?? null,
    changePercent: q.regularMarketChangePercent != null
      ? parseFloat(q.regularMarketChangePercent.toFixed(2))
      : null,
    volume: q.regularMarketVolume ?? null,
    marketCap: q.marketCap ?? null,
    week52High: q.fiftyTwoWeekHigh ?? null,
    week52Low: q.fiftyTwoWeekLow ?? null,
    currency: q.currency ?? null,
  }));
}

// ── Shared error handler ──────────────────────────────────────────────────────

/**
 * Handle errors from Yahoo Finance requests and send a consistent 502 response.
 * Using 502 (Bad Gateway) for all upstream errors is semantically correct because
 * the proxy received an invalid/unexpected response from the upstream service.
 */
function handleUpstreamError(err, res) {
  const message =
    err.response?.data?.quoteResponse?.error?.description ??
    err.message ??
    'Unexpected error while contacting Yahoo Finance.';

  return res.status(502).json({
    error: 'Failed to fetch data from Yahoo Finance.',
    detail: message,
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/quote?symbols=AAPL,MSFT,GOOGL
 *
 * Supports batch requests: pass a comma-separated list of ticker symbols.
 * Returns an array of shaped quote objects.
 */
app.get('/api/quote', async (req, res) => {
  const { symbols } = req.query;

  if (!symbols) {
    return res.status(400).json({
      error: 'Missing required query parameter: symbols',
      example: '/api/quote?symbols=AAPL,MSFT,GOOGL',
    });
  }

  const symbolList = symbols
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (symbolList.length === 0) {
    return res.status(400).json({ error: 'No valid symbols provided.' });
  }

  try {
    const quotes = await fetchQuotes(symbolList);

    if (quotes.length === 0) {
      return res.status(404).json({
        error: 'No data found for the provided symbols.',
        symbols: symbolList,
      });
    }

    return res.json({ quotes });
  } catch (err) {
    return handleUpstreamError(err, res);
  }
});

/**
 * POST /api/quote
 * Body: { "symbols": ["AAPL", "MSFT", "GOOGL"] }
 *
 * Alternative batch endpoint that accepts symbols in the request body.
 */
app.post('/api/quote', async (req, res) => {
  const { symbols } = req.body ?? {};

  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({
      error: 'Request body must contain a non-empty "symbols" array.',
      example: { symbols: ['AAPL', 'MSFT', 'GOOGL'] },
    });
  }

  const symbolList = symbols.map((s) => String(s).trim()).filter(Boolean);

  try {
    const quotes = await fetchQuotes(symbolList);

    if (quotes.length === 0) {
      return res.status(404).json({
        error: 'No data found for the provided symbols.',
        symbols: symbolList,
      });
    }

    return res.json({ quotes });
  } catch (err) {
    return handleUpstreamError(err, res);
  }
});

/**
 * GET /health
 *
 * Simple health-check endpoint.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Yahoo Finance Proxy running on port ${PORT}`);
  console.log(`  GET  /api/quote?symbols=AAPL,MSFT`);
  console.log(`  POST /api/quote  { "symbols": ["AAPL","MSFT"] }`);
  console.log(`  GET  /health`);
});

module.exports = app; // exported for testing
