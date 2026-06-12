'use strict';

const express = require('express');
const config = require('../config');
const logger = require('../services/logger');

const healthRoutes = require('../routes/health');
const streamRoutes = require('../routes/stream');
const devicesRoutes = require('../routes/devices');
const feedRoutes = require('../routes/feed');
const apiRoutes = require('../routes/api');

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/health', healthRoutes);
app.use('/stream', streamRoutes);
app.use('/devices', devicesRoutes);
app.use('/api', apiRoutes);
app.use('/feed', feedRoutes);

app.use((err, req, res, next) => {
  logger.error('unhandled error', { error: err.message, path: req.path });
  res.status(500).json({ success: false, message: 'internal_error' });
});

const port = config.port;

app.listen(port, () => {
  console.log(`PawNode listening on http://127.0.0.1:${port}`);
  console.log(`  node_id: ${config.nodeId}`);
  console.log(`  streamer: ${config.streamerSlug}`);
  console.log(`  feed cooldown: ${config.feedCooldownSeconds}s`);
  console.log(`  hls: ${config.getHlsUrl()}`);
});
