'use strict';

const express = require('express');
const feedService = require('../services/feed-service');
const config = require('../config');
const logger = require('../services/logger');

const router = express.Router();

/** @deprecated Use POST /api/feed */
router.post('/', async (req, res) => {
  try {
    const result = await feedService.requestFeed({
      streamer: req.body?.streamer || config.streamerSlug,
      viewer: req.body?.viewer || 'legacy',
      portion: req.body?.grain_num || req.body?.grainNum || 1,
    });

    if (!result.success) {
      return res.status(429).json(result);
    }

    logger.feed('legacy /feed ok', { feed_id: result.feed_id });

    return res.json({
      success: true,
      feed_id: result.feed_id,
      remaining: result.remaining,
      message: 'feed_ok',
    });
  } catch (err) {
    return res.status(err.statusCode || 502).json({
      success: false,
      message: err.message || 'feed_failed',
      ...(err.payload || {}),
    });
  }
});

module.exports = router;
