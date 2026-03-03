const express = require('express');
const cors = require('cors');
// Importamos el módulo completo
const yfModule = require('yahoo-finance2');

const app = express();
const PORT = process.env.PORT || 3000;

// Buscamos el constructor con "escáner" para no fallar
const YahooFinance = yfModule.YahooFinance || yfModule.default?.YahooFinance;

if (!YahooFinance) {
  console.error("Error crítico: No se encontró el constructor YahooFinance");
}

// CREAMOS LA INSTANCIA
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

app.get('/health', (req, res) => res.json({ status: 'ok', library: 'v3' }));

app.listen(PORT, () => {
  console.log(`Servidor iniciado correctamente en puerto ${PORT}`);
});
