'use strict';

const express = require('express');
const feedService = require('../services/feed-service');
const logger = require('../services/logger');
const { getStreamViewerCount } = require('../services/go2rtc');
const liveViewerStore = require('../services/live-viewer-store');
const config = require('../config');
const router = express.Router();

router.post('/feed', async (req, res) => {
  try {
    const result = await feedService.requestFeed({
      streamer: req.body?.streamer,
      viewer: req.body?.viewer,
      portion: req.body?.portion || req.body?.grain_num || 1,
    });

    if (!result.success) {
      return res.status(429).json({
        success: false,
        message: result.message,
        feed_id: result.feed_id,
        remaining: result.remaining,
        last_feed: result.last_feed,
      });
    }

    return res.json({
      success: true,
      feed_id: result.feed_id,
      remaining: result.remaining,
      timestamp: result.timestamp || null,
    });
  } catch (err) {
    logger.error('api feed error', { error: err.message });

    if (err.payload) {
      return res.status(err.statusCode || 502).json(err.payload);
    }

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'internal_error',
    });
  }
});

router.get('/feed-status', (req, res) => {
  try {
    const status = feedService.getFeedStatus(req.query?.streamer);

    return res.json({
      last_feed: status.last_feed,
      last_feed_by: status.last_feed_by,
      cooldown_remaining: status.cooldown_remaining,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'internal_error',
    });
  }
});

router.post('/live-viewers/presence', (req, res) => {
  try {
    const stream = String(req.body?.stream || config.go2rtcStreamName || '').trim().toLowerCase();
    const payload = liveViewerStore.touchPresence({
      viewer_id: req.body?.viewer_id,
      stream,
      streamer: req.body?.streamer || config.streamerSlug,
      user_label: req.body?.user_label || req.body?.viewer || 'guest',
    });

    logger.stream('live viewer presence response', {
      stream,
      active_viewers: payload.active_viewers,
      registered: payload.registered,
      viewer_id: payload.viewer_id,
    });

    return res.json({
      success: true,
      ...payload,
      source: 'presence',
    });
  } catch (err) {
    logger.error('api live-viewers presence error', { error: err.message });
    return res.status(400).json({
      success: false,
      message: err.message || 'invalid_request',
    });
  }
});

router.get('/live-viewers', async (req, res) => {
  try {
    const stream = String(req.query?.stream || config.go2rtcStreamName || '').trim();
    const go2rtcPayload = await getStreamViewerCount(stream);
    const presenceViewers = liveViewerStore.countActive(stream);
    const viewers = Math.max(presenceViewers, go2rtcPayload.viewers || 0);

    logger.stream('live viewer count response', {
      stream,
      presence_viewers: presenceViewers,
      go2rtc_consumers: go2rtcPayload.viewers || 0,
      active_viewers: viewers,
      debug: liveViewerStore.getDebugSnapshot(stream),
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');

    return res.json({
      viewers,
      stream: go2rtcPayload.stream || stream,
      source: presenceViewers > 0 ? 'presence' : go2rtcPayload.source,
      online: go2rtcPayload.online !== false,
      stream_active: go2rtcPayload.stream_active === true,
      presence_viewers: presenceViewers,
      go2rtc_consumers: go2rtcPayload.viewers || 0,
    });
  } catch (err) {
    logger.error('api live-viewers error', { error: err.message });
    return res.status(500).json({
      success: false,
      message: err.message || 'internal_error',
      viewers: 0,
    });
  }
});

module.exports = router;
