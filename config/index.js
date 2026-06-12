'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function optional(name, fallback = '') {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

function parseJsonEnv(name, fallback) {
  const raw = optional(name, '');
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[pawnode] Invalid JSON in ${name}, using defaults`);
    return fallback;
  }
}

const defaultCooldown = parseInt(optional('FEED_COOLDOWN_SECONDS', '3600'), 10);

const config = {
  nodeId: optional('NODE_ID', 'pawnode-1'),
  streamerSlug: optional('STREAMER_SLUG', 'beemo'),
  rtspUrl: optional('RTSP_URL', ''),
  port: parseInt(optional('PORT', '3000'), 10),
  go2rtcUrl: optional('GO2RTC_URL', 'http://127.0.0.1:1984').replace(/\/$/, ''),
  go2rtcStreamName: optional('GO2RTC_STREAM_NAME', 'tapo'),
  hlsPublicUrl: optional('HLS_PUBLIC_URL', ''),
  feedCooldownSeconds: Number.isFinite(defaultCooldown) ? defaultCooldown : 3600,
  streamers: parseJsonEnv('STREAMERS_JSON', {}),
  petlibro: {
    email: optional('PETLIBRO_EMAIL', ''),
    password: optional('PETLIBRO_PASSWORD', ''),
    deviceSn: optional('PETLIBRO_DEVICE_SN', ''),
    region: optional('PETLIBRO_REGION', 'US'),
    timezone: optional('PETLIBRO_TIMEZONE', 'Asia/Seoul'),
  },
  paths: {
    root: path.join(__dirname, '..'),
    logs: path.join(__dirname, '..', 'logs'),
    python: path.join(__dirname, '..', 'python'),
    data: path.join(__dirname, '..', 'data'),
  },
};

/**
 * Per-streamer profile (multi-streamer + per-stream cooldown/device).
 *
 * @param {string} streamer
 * @returns {{ slug: string, cooldown_seconds: number }}
 */
config.getStreamerProfile = function getStreamerProfile(streamer) {
  const slug = String(streamer || this.streamerSlug).trim().toLowerCase();
  const custom = this.streamers[slug] || {};

  return {
    slug,
    cooldown_seconds: parseInt(custom.cooldown_seconds || this.feedCooldownSeconds, 10) || 3600,
  };
};

/**
 * @param {string} streamer
 * @returns {boolean}
 */
config.isStreamerKnown = function isStreamerKnown(streamer) {
  const slug = String(streamer || '').trim().toLowerCase();
  if (!slug) {
    return false;
  }

  if (Object.keys(this.streamers).length > 0) {
    return Object.prototype.hasOwnProperty.call(this.streamers, slug);
  }

  return slug === this.streamerSlug;
};

config.getLocalHlsUrl = function getLocalHlsUrl() {
  return `${this.go2rtcUrl}/api/stream.m3u8?src=${encodeURIComponent(this.go2rtcStreamName)}`;
};

config.getHlsUrl = function getHlsUrl() {
  return this.hlsPublicUrl || this.getLocalHlsUrl();
};

module.exports = config;
