const express = require('express');
const yahooFinance2 = require('yahoo-finance2').default; // Cambiamos la forma de importar
const cors = require('cors');

const app = express();
// En las versiones más recientes de la v3, 'default' ya es una instancia lista para usar
// o requiere ser instanciada desde el objeto importado.
const yahooFinance = yahooFinance2; 

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Yahoo Finance helper ──────────────────────────────────────────────────────

async function fetchQuotes(symbols) {
  // Intentamos usar el método directamente desde la exportación por defecto
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

// ... (Resto de tus rutas: /api/quote, /api/history, /health) ...

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

app.listen(PORT, () => {
  console.log(`Yahoo Finance Proxy corriendo en puerto ${PORT}`);
});
