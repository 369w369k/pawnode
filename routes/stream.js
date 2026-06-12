'use strict';

const express = require('express');
const config = require('../config');
const logger = require('../services/logger');
const { checkGo2rtcStatus } = require('../services/go2rtc');

const router = express.Router();

router.get('/', async (req, res) => {
  const go2rtc = await checkGo2rtcStatus();
  const hlsUrl = config.getHlsUrl();

  logger.stream('stream url requested', { hlsUrl, go2rtc_online: go2rtc.online });

  res.json({
    hls_url: hlsUrl,
    local_hls_url: config.getLocalHlsUrl(),
    stream_name: config.go2rtcStreamName,
    go2rtc,
  });
});

module.exports = router;
