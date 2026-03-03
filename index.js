const express = require('express');
const yf = require('yahoo-finance2'); // Importamos todo el módulo
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Buscamos el constructor de forma segura
const YahooFinanceClass = yf.YahooFinance || yf.default?.YahooFinance;

if (!YahooFinanceClass) {
  console.error("No se pudo encontrar el constructor YahooFinance. Revisa la versión de la librería.");
}

// CREAMOS LA INSTANCIA
const yahooFinance = new YahooFinanceClass(); 

app.use(cors());
app.use(express.json());

// ── Yahoo Finance helper ──────────────────────────────────────────────────────

async function fetchQuotes(symbols) {
  const results = await yahooFinance.quote(symbols);
  const quotesArray = Array.isArray(results) ? results : [results];

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

// ── Rutas ────────────────────────────────────────────────────────────────────

app.get('/api/quote', async (req, res) => {
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'Faltan símbolos' });
  const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

  try {
    const quotes = await fetchQuotes(symbolList);
    return res.json({ quotes });
  } catch (err) {
    return res.status(502).json({ error: 'Error en Yahoo', detail: err.message });
  }
});

app.get('/api/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    const result = await yahooFinance.historical(symbol, {
      period1: start,
      period2: end,
      interval: '1d' 
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Error en historial', detail: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Yahoo Finance Proxy (v3) corriendo en puerto ${PORT}`);
});
