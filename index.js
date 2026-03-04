const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Common browser-like User-Agent ────────────────────────────────────────────
const USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${110 + Math.floor(Math.random() * 10)}.0.0.0 Safari/537.36`;

// ── Crumb / session cache ─────────────────────────────────────────────────────
let crumbCache = null; // { crumb: string, cookie: string, fetchedAt: number }
const CRUMB_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Obtain a Yahoo Finance crumb + session cookie required for authenticated API
 * calls.  Results are cached for CRUMB_TTL_MS to avoid unnecessary round-trips.
 *
 * @returns {Promise<{ crumb: string, cookie: string }>}
 */
async function getYahooCrumb() {
  const now = Date.now();
  if (crumbCache && now - crumbCache.fetchedAt < CRUMB_TTL_MS) {
    return crumbCache;
  }

  // Step 1: visit Yahoo Finance to acquire session cookies.
  const homeRes = await axios.get('https://finance.yahoo.com', {
    headers: {
      'User-Agent': USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: 15000,
    maxRedirects: 5,
  });

  const rawCookies = homeRes.headers['set-cookie'] ?? [];
  const cookie = rawCookies.map((c) => c.split(';')[0]).join('; ');

  // Step 2: exchange cookies for a crumb token.
  const crumbRes = await axios.get(
    'https://query1.finance.yahoo.com/v1/test/getcrumb',
    {
      headers: {
        'User-Agent': USER_AGENT,
        Cookie: cookie,
      },
      timeout: 10000,
    },
  );

  crumbCache = { crumb: String(crumbRes.data), cookie, fetchedAt: now };
  return crumbCache;
}

/** Invalidate the crumb cache so the next request fetches a fresh crumb. */
function invalidateCrumbCache() {
  crumbCache = null;
}

// ── Yahoo Finance helper ──────────────────────────────────────────────────────

/**
 * Fetch quote data for one or more tickers from Yahoo Finance v7 quote API.
 * Automatically obtains and caches the crumb + session cookie required by the
 * Yahoo Finance API.  On a 401 response it invalidates the cache and retries
 * once with fresh credentials.
 *
 * @param {string[]} symbols - Array of ticker symbols (e.g. ['AAPL', 'MSFT'])
 * @returns {Promise<Object[]>}
 */
async function fetchQuotes(symbols) {
  const joined = symbols.map((s) => s.toUpperCase().trim()).join(',');

  const url = 'https://query1.finance.yahoo.com/v7/finance/quote';

  const doRequest = async () => {
    const { crumb, cookie } = await getYahooCrumb();

    return axios.get(url, {
      params: {
        symbols: joined,
        crumb,
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
        'User-Agent': USER_AGENT,
        Cookie: cookie,
      },
      timeout: 10000,
    });
  };

  let response;
  try {
    response = await doRequest();
  } catch (err) {
    // On 401 the crumb/cookie have expired — refresh and retry once.
    if (err.response?.status === 401) {
      invalidateCrumbCache();
      response = await doRequest();
    } else {
      throw err;
    }
  }

  const { data } = response;

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

// ── Yahoo Finance history helper ──────────────────────────────────────────────

/**
 * Valid range / interval values accepted by the Yahoo Finance chart API.
 */
const VALID_RANGES = new Set([
  '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max',
]);
const VALID_INTERVALS = new Set([
  '1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h',
  '1d', '5d', '1wk', '1mo', '3mo',
]);

/**
 * Fetch OHLCV historical data for a single ticker from Yahoo Finance v8 chart API.
 * Automatically obtains and caches the crumb + session cookie.
 * On a 401 response it invalidates the cache and retries once with fresh credentials.
 *
 * @param {string} symbol   - Ticker symbol (e.g. 'AAPL')
 * @param {string} range    - Date range (e.g. '1y', '6mo', 'max') — default '1y'
 * @param {string} interval - Data interval (e.g. '1d', '1wk')     — default '1d'
 * @returns {Promise<Object>}
 */
async function fetchHistory(symbol, range = '1y', interval = '1d') {
  const ticker = symbol.toUpperCase().trim();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`;

  const doRequest = async () => {
    const { crumb, cookie } = await getYahooCrumb();

    return axios.get(url, {
      params: { range, interval, crumb, includeAdjustedClose: true },
      headers: {
        'User-Agent': USER_AGENT,
        Cookie: cookie,
      },
      timeout: 15000,
    });
  };

  let response;
  try {
    response = await doRequest();
  } catch (err) {
    if (err.response?.status === 401) {
      invalidateCrumbCache();
      response = await doRequest();
    } else {
      throw err;
    }
  }

  const chart = response.data?.chart;
  if (chart?.error) {
    const e = new Error(chart.error.description ?? 'Yahoo Finance chart error');
    e.yahooError = chart.error;
    throw e;
  }

  const result = chart?.result?.[0];
  if (!result) {
    return null;
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const meta = result.meta ?? {};

  // Shape into an array of candle objects, filtering out entries with null OHLCV.
  const candles = timestamps.reduce((acc, ts, i) => {
    const open  = quote.open?.[i];
    const high  = quote.high?.[i];
    const low   = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    if (open == null || high == null || low == null || close == null) {
      return acc;
    }

    acc.push({
      date: new Date(ts * 1000).toISOString(),
      open:  parseFloat(open.toFixed(4)),
      high:  parseFloat(high.toFixed(4)),
      low:   parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      adjClose: adjClose[i] != null ? parseFloat(adjClose[i].toFixed(4)) : null,
      volume: volume ?? null,
    });

    return acc;
  }, []);

  return {
    symbol: meta.symbol ?? ticker,
    currency: meta.currency ?? null,
    exchangeName: meta.exchangeName ?? null,
    instrumentType: meta.instrumentType ?? null,
    range,
    interval,
    candles,
  };
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
    err.yahooError?.description ??
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
 * GET /api/history?symbol=AAPL&range=1y&interval=1d
 *
 * Returns OHLCV candle data suitable for charting libraries.
 *
 * Query parameters:
 *   symbol   {string}  required – ticker symbol (e.g. AAPL)
 *   range    {string}  optional – date range (default: 1y)
 *                      allowed : 1d | 5d | 1mo | 3mo | 6mo | 1y | 2y | 5y | 10y | ytd | max
 *   interval {string}  optional – candle interval (default: 1d)
 *                      allowed : 1m | 2m | 5m | 15m | 30m | 60m | 90m | 1h |
 *                                1d | 5d | 1wk | 1mo | 3mo
 */
app.get('/api/history', async (req, res) => {
  const { symbol, range = '1y', interval = '1d' } = req.query;

  if (!symbol) {
    return res.status(400).json({
      error: 'Missing required query parameter: symbol',
      example: '/api/history?symbol=AAPL&range=1y&interval=1d',
    });
  }

  if (!VALID_RANGES.has(range)) {
    return res.status(400).json({
      error: `Invalid range "${range}".`,
      allowed: [...VALID_RANGES],
    });
  }

  if (!VALID_INTERVALS.has(interval)) {
    return res.status(400).json({
      error: `Invalid interval "${interval}".`,
      allowed: [...VALID_INTERVALS],
    });
  }

  try {
    const history = await fetchHistory(symbol, range, interval);

    if (!history) {
      return res.status(404).json({
        error: 'No historical data found for the provided symbol.',
        symbol,
      });
    }

    return res.json(history);
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
  console.log(`  GET  /api/history?symbol=AAPL&range=1y&interval=1d`);
  console.log(`  GET  /health`);
});

module.exports = app; // exported for testing
