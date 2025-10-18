const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

const publicDir = path.join(__dirname, '..', 'public');

app.use('/cdn', express.static(path.join(publicDir, 'cdn'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));

app.get('/catalog.json', (_req, res) => {
  const catalogPath = path.join(publicDir, 'catalog.json');
  if (!fs.existsSync(catalogPath)) return res.json({});
  res.sendFile(catalogPath);
});

app.get('/', (_req, res) => res.send('OK'));

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Static server on ${port} -> ${path.resolve(publicDir)}`);
  console.log(`Catalog: ${path.join(publicDir, 'catalog.json')}`);
  console.log(`CDN: ${path.join(publicDir, 'cdn')}`);
});