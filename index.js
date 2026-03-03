const express = require('express');
const cors = require('cors');
// Importación directa del constructor de la versión 3
const YahooFinance = require('yahoo-finance2').YahooFinance;

const app = express();
const PORT = process.env.PORT || 3000;

// CREAMOS LA INSTANCIA DE FORMA EXPLÍCITA
const yahooFinance = new YahooFinance();

app.use(cors());
app.use(express.json());

// ── Rutas ────────────────────────────────────────────────────────────────────

app.get('/api/quote', async (req, res) => {
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'Faltan símbolos' });
  const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase());

  try {
    const results = await yahooFinance.quote(symbolList);
    const quotesArray = Array.isArray(results) ? results : [results];

    const shapedData = quotesArray.map((q) => ({
      symbol: q.symbol,
      name: q.shortName,
      price: q.regularMarketPrice,
      changePercent: q.regularMarketChangePercent?.toFixed(2),
      currency: q.currency
    }));

    return res.json({ quotes: shapedData });
  } catch (err) {
    return res.status(502).json({ error: 'Error en Yahoo', detail: err.message });
  }
});

app.get('/api/history/:symbol', async (req, res) => {
  try {
    const result = await yahooFinance.historical(req.params.symbol, { 
      period1: '2025-01-01' // Cambiado a 2025 para asegurar datos recientes
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Error en historial', detail: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Servidor iniciado correctamente en puerto ${PORT}`);
});
