const https = require('https');

const URL = process.env.RENDER_URL || 'https://sua-api.onrender.com';
const INTERVAL_MS = 14 * 60 * 1000; // 14 minutos

function ping() {
  const url = `${URL}/health`;
  https.get(url, (res) => {
    console.log(`[keep-alive] ${new Date().toISOString()} → status ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[keep-alive] Erro: ${err.message}`);
  });
}

ping();
setInterval(ping, INTERVAL_MS);