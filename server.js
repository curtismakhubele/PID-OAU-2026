const express = require('express');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 8080;
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'pid-fms-data';
const requireAuth = process.env.REQUIRE_BACKEND_AUTH !== 'false';
const containerClient = connectionString
  ? BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName)
  : null;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

function safeKey(value) {
  const key = String(value || '').trim();
  if (!key || key.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
}

function isAuthenticated(req) {
  return Boolean(req.headers['x-ms-client-principal'] || req.headers['x-ms-client-principal-name']);
}

function requireBackendAuth(req, res, next) {
  if (!requireAuth || isAuthenticated(req)) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

async function getBlob(key) {
  if (!containerClient) {
    const error = new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
    error.statusCode = 503;
    throw error;
  }
  await containerClient.createIfNotExists();
  return containerClient.getBlockBlobClient(`${key}.json`);
}

async function readBlob(blob) {
  if (!(await blob.exists())) return null;
  const buffer = await blob.downloadToBuffer();
  return JSON.parse(buffer.toString('utf8'));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', storageConfigured: Boolean(containerClient), authenticationRequired: requireAuth });
});

app.get('/api/storage/:key', requireBackendAuth, async (req, res, next) => {
  try {
    const key = safeKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Invalid storage key' });
    const value = await readBlob(await getBlob(key));
    if (value === null) return res.status(404).json({ error: 'Not found' });
    return res.json({ key, value });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/storage/:key', requireBackendAuth, async (req, res, next) => {
  try {
    const key = safeKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Invalid storage key' });
    const value = req.body && req.body.value;
    const payload = JSON.stringify(value);
    const blob = await getBlob(key);
    await blob.upload(payload, Buffer.byteLength(payload), { blobHTTPHeaders: { blobContentType: 'application/json' } });
    return res.json({ key, value });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/storage/:key', requireBackendAuth, async (req, res, next) => {
  try {
    const key = safeKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Invalid storage key' });
    await (await getBlob(key)).deleteIfExists();
    return res.json({ key, deleted: true });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/storage', requireBackendAuth, async (req, res, next) => {
  try {
    if (!containerClient) return res.status(503).json({ error: 'Storage is not configured' });
    await containerClient.createIfNotExists();
    const prefix = String(req.query.prefix || '').replace(/[^A-Za-z0-9._:-]/g, '');
    const keys = [];
    for await (const item of containerClient.listBlobsFlat({ prefix })) {
      if (item.name.endsWith('.json')) keys.push(item.name.slice(0, -5));
    }
    return res.json({ keys, prefix });
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({ error: 'Backend request failed' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PID Facilities Management System running on port ${PORT}`);
});
