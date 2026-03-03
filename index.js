const express = require('express');
const yahooFinance = require('yahoo-finance2').default; // En v2 esto es directo
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Rutas ────────────────────────────────────────────────────────────────────

app.get('/api/quote', async (req, res) => {
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'Faltan símbolos' });
  
  const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase());

  try {
    // En v2, llamamos al método directamente desde el objeto importado
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
      period1: '2024-01-01' 
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Error en historial', detail: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Servidor ESTABLE corriendo en puerto ${PORT}`);
});
