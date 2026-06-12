'use strict';

const config = require('../config');
const logger = require('./logger');
const feedStore = require('./feed-store');
const rankingIndex = require('./ranking-index');
const petlibro = require('./petlibro');

/**
 * @param {string} streamer
 * @returns {number}
 */
function getCooldownSeconds(streamer) {
  return config.getStreamerProfile(streamer).cooldown_seconds;
}

/**
 * @param {string} [streamer]
 * @returns {{ streamer: string, last_feed: string|null, cooldown_remaining: number }}
 */
function getFeedStatus(streamer) {
  const normalized = normalizeStreamer(streamer || config.streamerSlug);
  const state = feedStore.getStreamerState(normalized);
  const cooldownSeconds = getCooldownSeconds(normalized);

  if (!state.last_feed) {
    return {
      streamer: normalized,
      last_feed: null,
      last_feed_by: null,
      cooldown_remaining: 0,
    };
  }

  const elapsedMs = Date.now() - new Date(state.last_feed).getTime();
  const remainingMs = cooldownSeconds * 1000 - elapsedMs;

  return {
    streamer: normalized,
    last_feed: state.last_feed,
    last_feed_by: state.viewer || null,
    cooldown_remaining: remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0,
  };
}

/**
 * @param {string} streamer
 * @returns {string}
 */
function normalizeStreamer(streamer) {
  const slug = String(streamer || '').trim().toLowerCase();
  if (!slug) {
    const err = new Error('missing_streamer');
    err.statusCode = 400;
    throw err;
  }
  return slug;
}

/**
 * @param {string} streamer
 */
function assertStreamerKnown(streamer) {
  if (!config.isStreamerKnown(streamer)) {
    const err = new Error('unknown_streamer');
    err.statusCode = 404;
    throw err;
  }
}

/**
 * Viewer → WordPress → PawNode → Petlibro Cloud
 *
 * @param {object} input
 * @returns {Promise<object>}
 */
async function requestFeed(input = {}) {
  const streamer = normalizeStreamer(input.streamer || config.streamerSlug);
  assertStreamerKnown(streamer);

  const viewer = String(input.viewer || 'anonymous').trim() || 'anonymous';
  const portion = Math.max(1, parseInt(input.portion || 1, 10));
  const statusBefore = getFeedStatus(streamer);

  if (statusBefore.cooldown_remaining > 0) {
    const rejected = feedStore.createLogEntry({
      streamer,
      viewer,
      status: 'cooldown_rejected',
      response: {
        message: 'cooldown_active',
        remaining: statusBefore.cooldown_remaining,
        last_feed: statusBefore.last_feed,
      },
    });

    logger.feed('feed rejected — cooldown', {
      streamer,
      viewer,
      remaining: statusBefore.cooldown_remaining,
    });

    return {
      success: false,
      message: 'cooldown_active',
      feed_id: rejected.id,
      remaining: statusBefore.cooldown_remaining,
      last_feed: statusBefore.last_feed,
    };
  }

  const pending = feedStore.createLogEntry({
    streamer,
    viewer,
    status: 'pending',
    response: null,
  });

  try {
    const petlibroResult = await petlibro.feed(portion);
    const feedTime = new Date().toISOString();

    feedStore.updateLogStatus(pending.id, {
      status: 'success',
      feed_time: feedTime,
      response: petlibroResult.response || petlibroResult,
    });

    rankingIndex.recordFeed({
      streamer,
      viewer,
      feed_id: pending.id,
      portion,
      feed_time: feedTime,
      status: 'success',
    });

    logger.feed('feed success', {
      feed_id: pending.id,
      streamer,
      viewer,
      portion,
      device_sn: petlibroResult.device_sn,
    });

    return {
      success: true,
      feed_id: pending.id,
      remaining: getCooldownSeconds(streamer),
      timestamp: feedTime,
    };
  } catch (err) {
    feedStore.updateLogStatus(pending.id, {
      status: 'failed',
      response: {
        message: err.message || 'feed_failed',
      },
    });

    logger.error('feed failed', {
      feed_id: pending.id,
      streamer,
      viewer,
      error: err.message,
    });

    const failure = new Error(err.message || 'feed_failed');
    failure.statusCode = err.statusCode || 502;
    failure.payload = {
      success: false,
      message: err.message || 'feed_failed',
      feed_id: pending.id,
      remaining: 0,
    };
    throw failure;
  }
}

module.exports = {
  getFeedStatus,
  requestFeed,
  normalizeStreamer,
};
