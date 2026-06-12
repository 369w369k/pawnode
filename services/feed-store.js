'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = path.join(config.paths.root, 'data');
const META_PATH = path.join(DATA_DIR, 'feed-meta.json');
const LOGS_PATH = path.join(DATA_DIR, 'feed-logs.jsonl');
const RANKING_PATH = path.join(DATA_DIR, 'ranking-events.jsonl');

const DEFAULT_META = {
  next_id: 1,
  streamers: {},
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readMeta() {
  ensureDataDir();
  if (!fs.existsSync(META_PATH)) {
    return structuredClone(DEFAULT_META);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    return {
      next_id: Number(parsed.next_id) || 1,
      streamers: parsed.streamers && typeof parsed.streamers === 'object' ? parsed.streamers : {},
    };
  } catch (err) {
    return structuredClone(DEFAULT_META);
  }
}

function writeMeta(meta) {
  ensureDataDir();
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
}

function appendJsonLine(filePath, row) {
  ensureDataDir();
  fs.appendFileSync(filePath, JSON.stringify(row) + '\n');
}

/**
 * @param {object} entry
 * @returns {object}
 */
function createLogEntry(entry) {
  const meta = readMeta();
  const id = meta.next_id;
  meta.next_id = id + 1;

  const row = {
    id,
    streamer: String(entry.streamer || '').trim(),
    viewer: String(entry.viewer || 'anonymous').trim() || 'anonymous',
    feed_time: entry.feed_time || new Date().toISOString(),
    status: String(entry.status || 'pending'),
    response: entry.response ?? null,
  };

  appendJsonLine(LOGS_PATH, row);

  if (row.status === 'success') {
    meta.streamers[row.streamer] = {
      last_feed: row.feed_time,
      last_feed_id: id,
      viewer: row.viewer,
    };
  }

  writeMeta(meta);
  return row;
}

/**
 * @param {number} id
 * @param {object} patch
 * @returns {object|null}
 */
function updateLogStatus(id, patch) {
  const logs = readAllLogs();
  const index = logs.findIndex((row) => row.id === id);
  if (index < 0) {
    return null;
  }

  const updated = {
    ...logs[index],
    ...patch,
  };

  logs[index] = updated;
  ensureDataDir();
  fs.writeFileSync(
    LOGS_PATH,
    logs.map((row) => JSON.stringify(row)).join('\n') + (logs.length ? '\n' : '')
  );

  if (updated.status === 'success') {
    const meta = readMeta();
    meta.streamers[updated.streamer] = {
      last_feed: updated.feed_time,
      last_feed_id: updated.id,
      viewer: updated.viewer,
    };
    writeMeta(meta);
  }

  return updated;
}

function readAllLogs() {
  ensureDataDir();
  if (!fs.existsSync(LOGS_PATH)) {
    return [];
  }

  return fs
    .readFileSync(LOGS_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * @param {string} streamer
 * @returns {{ last_feed: string|null, last_feed_id: number|null, viewer: string|null }}
 */
function getStreamerState(streamer) {
  const meta = readMeta();
  const state = meta.streamers[streamer];
  if (!state) {
    return { last_feed: null, last_feed_id: null, viewer: null };
  }
  return {
    last_feed: state.last_feed || null,
    last_feed_id: state.last_feed_id || null,
    viewer: state.viewer || null,
  };
}

/**
 * Ranking-ready event stream (weekly / monthly / donation hooks).
 *
 * @param {object} event
 */
function appendRankingEvent(event) {
  appendJsonLine(RANKING_PATH, {
    ts: event.ts || new Date().toISOString(),
    event_type: event.event_type || 'feed',
    streamer: event.streamer,
    viewer: event.viewer,
    viewer_id: event.viewer_id || null,
    feed_id: event.feed_id || null,
    portion: Number(event.portion || 1),
    donation_amount: Number(event.donation_amount || 0),
    status: event.status || 'success',
    period_keys: {
      week: event.period_keys?.week || null,
      month: event.period_keys?.month || null,
    },
  });
}

/**
 * Aggregate feed counts for ranking APIs (future WordPress sync).
 *
 * @param {object} options
 * @returns {Array<{ entity: string, count: number }>}
 */
function aggregateFeedCounts(options = {}) {
  const {
    groupBy = 'viewer',
    streamer = null,
    since = null,
    until = null,
    status = 'success',
  } = options;

  const logs = readAllLogs().filter((row) => {
    if (status && row.status !== status) {
      return false;
    }
    if (streamer && row.streamer !== streamer) {
      return false;
    }
    if (since && row.feed_time < since) {
      return false;
    }
    if (until && row.feed_time > until) {
      return false;
    }
    return true;
  });

  const buckets = new Map();
  for (const row of logs) {
    const key =
      groupBy === 'streamer'
        ? row.streamer
        : groupBy === 'donation'
          ? String(row.donation_amount || 0)
          : row.viewer;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([entity, count]) => ({ entity, count }))
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  createLogEntry,
  updateLogStatus,
  getStreamerState,
  appendRankingEvent,
  aggregateFeedCounts,
  readAllLogs,
};
