const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Configuración global para mejorar la estabilidad
yahooFinance.setGlobalConfig({ validation: { logErrors: true } });

// ── Yahoo Finance helper ──────────────────────────────────────────────────────

/**
 * Obtiene datos de cotización usando la librería yahoo-finance2.
 * Esta librería gestiona automáticamente las cookies/crumbs para evitar el error 401.
 */
async function fetchQuotes(symbols) {
  // yahoo-finance2 acepta un array de strings directamente
  const results = await yahooFinance.quote(symbols);
  
  // Si solo se pide uno, la librería devuelve un objeto; si son varios, un array.
  // Normalizamos siempre a array para el mapeo.
  const quotesArray = Array.isArray(results) ? results : [results];

  // ── Data Shaping (Mantenemos tus mismos campos) ─────────────────────────────
  return quotesArray.map((q) => ({
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

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/quote?symbols=AAPL,MSFT
 */
app.get('/api/quote', async (req, res) => {
  const { symbols } = req.query;

  if (!symbols) {
    return res.status(400).json({
      error: 'Missing required query parameter: symbols',
      example: '/api/quote?symbols=AAPL,MSFT',
    });
  }

  const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

  try {
    const quotes = await fetchQuotes(symbolList);
    return res.json({ quotes });
  } catch (err) {
    return res.status(502).json({
      error: 'Failed to fetch data from Yahoo Finance.',
      detail: err.message,
    });
  }
});

/**
 * POST /api/quote
 * Body: { "symbols": ["AAPL", "MSFT"] }
 */
app.post('/api/quote', async (req, res) => {
  const { symbols } = req.body ?? {};

  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({
      error: 'Request body must contain a non-empty "symbols" array.',
    });
  }

  try {
    const quotes = await fetchQuotes(symbols);
    return res.json({ quotes });
  } catch (err) {
    return res.status(502).json({
      error: 'Failed to fetch data from Yahoo Finance.',
      detail: err.message,
    });
  }
});

/**
 * GET /api/history/:symbol
 * Nueva ruta necesaria para alimentar tus gráficas
 */
app.get('/api/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3); // 3 meses atrás

        const result = await yahooFinance.historical(symbol, {
            period1: start,
            period2: end,
            interval: '1d' 
        });
        res.json(result);
    } catch (err) {
        res.status(502).json({ error: 'Error al obtener historial', detail: err.message });
    }
});

/**
 * GET /health
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
  console.log(`Yahoo Finance Proxy (v2) running on port ${PORT}`);
});
