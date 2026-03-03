const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuración para evitar bloqueos
yahooFinance.setGlobalConfig({ validation: { logErrors: true } });

app.get('/api/quote', async (req, res) => {
  const { symbols } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Faltan los símbolos. Ejemplo: ?symbols=AAPL,MSFT' });
  }

  try {
    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
    
    // La librería hace el trabajo sucio de saltar el 401
    const results = await yahooFinance.quote(symbolList);

    // Formateamos la respuesta para que tu HTML sea fácil de leer
    const shapedData = results.map(q => ({
      symbol: q.symbol,
      name: q.shortName,
      price: q.regularMarketPrice,
      changePercent: q.regularMarketChangePercent?.toFixed(2),
      currency: q.currency
    }));

    res.json({ quotes: shapedData });
  } catch (err) {
    console.error("Error en Yahoo:", err.message);
    res.status(502).json({ error: 'Yahoo bloqueó la petición', detail: err.message });
  }
});

// Ruta de historial (Para tus gráficas)
app.get('/api/history/:symbol', async (req, res) => {
  try {
    const result = await yahooFinance.historical(req.params.symbol, { period1: '2024-01-01' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor listo en puerto ${PORT}`);
});
