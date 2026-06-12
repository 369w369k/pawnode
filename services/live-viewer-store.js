'use strict';

const logger = require('./logger');

const TTL_MS = 45000;
const CLEANUP_INTERVAL_MS = 15000;

/** @type {Map<string, { viewerId: string, stream: string, streamer: string, userLabel: string, lastSeen: number }>} */
const sessions = new Map();

let cleanupTimer = null;

function sessionKey(viewerId, stream) {
  return `${String(viewerId)}|${String(stream)}`;
}

function cleanupExpired() {
  const now = Date.now();
  let removed = 0;

  for (const [key, session] of sessions.entries()) {
    if (now - session.lastSeen > TTL_MS) {
      sessions.delete(key);
      removed += 1;
    }
  }

  if (removed > 0) {
    logger.stream('live viewers cleanup', { removed, active: sessions.size });
  }
}

function ensureCleanupTimer() {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }
}

/**
 * Register or refresh a viewer heartbeat.
 *
 * @param {{ viewer_id?: string, stream?: string, streamer?: string, user_label?: string }} input
 * @returns {{ viewer_id: string, stream: string, streamer: string, registered: boolean, active_viewers: number }}
 */
function touchPresence(input = {}) {
  ensureCleanupTimer();
  cleanupExpired();

  const viewerId = String(input.viewer_id || '').trim();
  const stream = String(input.stream || '').trim().toLowerCase();
  const streamer = String(input.streamer || '').trim().toLowerCase();
  const userLabel = String(input.user_label || 'guest').trim() || 'guest';

  if (!viewerId || !stream) {
    throw new Error('viewer_id_and_stream_required');
  }

  const key = sessionKey(viewerId, stream);
  const isNew = !sessions.has(key);

  sessions.set(key, {
    viewerId,
    stream,
    streamer,
    userLabel,
    lastSeen: Date.now(),
  });

  const activeViewers = countActive(stream);

  logger.stream(isNew ? 'live viewer registered' : 'live viewer heartbeat', {
    viewer_id: viewerId,
    stream,
    streamer,
    user_label: userLabel,
    active_viewers: activeViewers,
    session_key: key,
  });

  return {
    viewer_id: viewerId,
    stream,
    streamer,
    registered: isNew,
    active_viewers: activeViewers,
  };
}

/**
 * Count active viewer sessions for a stream.
 *
 * @param {string} stream
 * @returns {number}
 */
function countActive(stream) {
  cleanupExpired();

  const name = String(stream || '').trim().toLowerCase();
  if (!name) {
    return 0;
  }

  const now = Date.now();
  let count = 0;

  for (const session of sessions.values()) {
    if (session.stream === name && now - session.lastSeen <= TTL_MS) {
      count += 1;
    }
  }

  return count;
}

/**
 * Debug snapshot for a stream.
 *
 * @param {string} stream
 * @returns {{ stream: string, active_viewers: number, sessions: Array<object> }}
 */
function getDebugSnapshot(stream) {
  cleanupExpired();

  const name = String(stream || '').trim().toLowerCase();
  const now = Date.now();
  const matched = [];

  for (const session of sessions.values()) {
    if (session.stream === name && now - session.lastSeen <= TTL_MS) {
      matched.push({
        viewer_id: session.viewerId,
        streamer: session.streamer,
        user_label: session.userLabel,
        age_ms: now - session.lastSeen,
      });
    }
  }

  return {
    stream: name,
    active_viewers: matched.length,
    sessions: matched,
  };
}

module.exports = {
  TTL_MS,
  touchPresence,
  countActive,
  getDebugSnapshot,
};
