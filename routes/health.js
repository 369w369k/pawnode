'use strict';

const express = require('express');
const config = require('../config');
const { checkGo2rtcStatus } = require('../services/go2rtc');
const petlibro = require('../services/petlibro');

const router = express.Router();

router.get('/', async (req, res) => {
  const go2rtc = await checkGo2rtcStatus();
  const petlibroStatus = await petlibro.getStatus();

  res.json({
    status: 'ok',
    node_id: config.nodeId,
    streamer_slug: config.streamerSlug,
    go2rtc,
    petlibro: petlibroStatus,
  });
});

module.exports = router;
