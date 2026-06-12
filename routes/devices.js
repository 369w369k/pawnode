'use strict';

const express = require('express');
const config = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  const devices = [];

  if (config.rtspUrl) {
    devices.push({
      type: 'camera',
      name: 'Camera1',
      model: 'Tapo C120',
      provider: 'tapo',
      stream: config.go2rtcStreamName,
      status: 'configured',
    });
  }

  if (config.petlibro.email && config.petlibro.password) {
    devices.push({
      type: 'feeder',
      name: 'Feeder1',
      provider: 'petlibro',
      api_ref: 'https://github.com/jjjonesjr33/petlibro',
      device_sn: config.petlibro.deviceSn || null,
      status: 'configured',
    });
  }

  res.json({
    node_id: config.nodeId,
    streamer_slug: config.streamerSlug,
    devices,
  });
});

module.exports = router;
