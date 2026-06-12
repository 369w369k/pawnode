'use strict';

/**
 * Petlibro Cloud API — Node.js port of pawnode/python/feed.py
 * Reference: https://github.com/jjjonesjr33/petlibro
 */

const crypto = require('crypto');
const config = require('../config');
const logger = require('./logger');

const APP_ID = 1;
const APP_SN = 'c35772530d1041699c87fe62348507a8';
const API_URLS = {
  US: 'https://api.us.petlibro.com',
};

/** @type {string|null} */
let cachedToken = null;

/** @type {object|null} */
let cachedFeeder = null;

function hashPassword(password) {
  return crypto.createHash('md5').update(password, 'utf8').digest('hex');
}

function getBaseUrl() {
  const region = String(config.petlibro.region || 'US').toUpperCase();
  const url = API_URLS[region];
  if (!url) {
    throw new Error(`unsupported_region: ${region}`);
  }
  return url;
}

function apiHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    source: 'ANDROID',
    language: 'EN',
    timezone: config.petlibro.timezone,
    version: '1.3.45',
  };
  if (token) {
    headers.token = token;
  }
  return headers;
}

function assertConfigured() {
  if (!config.petlibro.email || !config.petlibro.password) {
    const err = new Error('petlibro_not_configured');
    err.statusCode = 503;
    throw err;
  }
}

/**
 * Extract auth token from Petlibro login payloads (format A/B variants).
 *
 * @param {object|null|undefined} data
 * @returns {string|null}
 */
function extractToken(data) {
  return data?.token || data?.data?.token || data?.result?.token || null;
}

/**
 * @param {string} path
 * @param {object} body
 * @param {string|null} token
 * @returns {Promise<object>}
 */
async function postJson(path, body, token) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`petlibro_http_${response.status}`);
  }

  return response.json();
}

async function login() {
  const path = '/member/auth/login';
  const payload = {
    appId: APP_ID,
    appSn: APP_SN,
    country: String(config.petlibro.region || 'US').toUpperCase(),
    email: config.petlibro.email,
    password: hashPassword(config.petlibro.password),
    phoneBrand: '',
    phoneSystemVersion: '',
    timezone: config.petlibro.timezone,
    thirdId: null,
    type: null,
  };

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: apiHeaders(null),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  const status = response.status;
  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (err) {
    logger.error('petlibro login response', {
      status,
      parse_error: err.message,
      body: rawText,
    });
    throw new Error('login_failed');
  }

  logger.feed('petlibro login response', { status, body: data });

  const token = extractToken(data);

  if (!token) {
    logger.error('petlibro login response', { status, body: data });
    throw new Error('login_failed');
  }

  cachedToken = token;
  return token;
}

async function ensureToken() {
  assertConfigured();
  if (cachedToken) {
    return cachedToken;
  }
  return login();
}

/**
 * @param {string} token
 * @returns {Promise<object[]>}
 */
async function listDevices(token) {
  const data = await postJson('/device/device/list', {}, token);
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}

/**
 * @param {object[]} devices
 * @returns {object}
 */
function pickFeeder(devices) {
  const deviceSn = config.petlibro.deviceSn;

  if (deviceSn) {
    const match = devices.find((device) => {
      const sn = device.deviceSn || device.id;
      return sn === deviceSn;
    });
    if (!match) {
      throw new Error(`device_not_found: ${deviceSn}`);
    }
    return match;
  }

  let feeders = devices.filter((device) => {
    const product = String(device.productIdentifier || '');
    const name = String(device.productName || '').toLowerCase();
    return product.startsWith('PLAF') || name.includes('feeder');
  });

  if (!feeders.length && devices.length) {
    feeders = devices;
  }

  if (!feeders.length) {
    throw new Error('no_devices_found');
  }

  return feeders[0];
}

async function resolveFeeder(token) {
  if (cachedFeeder) {
    return cachedFeeder;
  }

  const devices = await listDevices(token);
  cachedFeeder = pickFeeder(devices);
  return cachedFeeder;
}

function isDeviceOnline(feeder) {
  if (!feeder) {
    return false;
  }
  if (feeder.onlineStatus === 1 || feeder.onlineStatus === '1') {
    return true;
  }
  if (feeder.online === true) {
    return true;
  }
  return false;
}

/**
 * Trigger one manual feed via Petlibro Cloud API.
 *
 * @param {number} portion
 * @returns {Promise<{ success: boolean, device_sn: string, device_name: string|null, portion: number, response: object }>}
 */
async function feed(portion = 1) {
  const grainNum = Math.max(1, parseInt(portion, 10) || 1);
  const token = await ensureToken();
  const feeder = await resolveFeeder(token);
  const serial = feeder.deviceSn || feeder.id;

  if (!serial) {
    throw new Error('missing_device_serial');
  }

  logger.feed('petlibro feed request', { device_sn: serial, portion: grainNum });

  const response = await postJson(
    '/device/device/manualFeeding',
    {
      deviceSn: serial,
      grainNum,
      requestId: crypto.randomUUID().replace(/-/g, ''),
    },
    token
  );

  if (response && response.code !== undefined && response.code !== 0) {
    throw new Error(response.msg || 'feed_failed');
  }

  return {
    success: true,
    device_sn: serial,
    device_name: feeder.name || null,
    portion: grainNum,
    response,
  };
}

/**
 * Petlibro connection and feeder status.
 *
 * @returns {Promise<object>}
 */
async function getStatus() {
  if (!config.petlibro.email || !config.petlibro.password) {
    return {
      configured: false,
      online: false,
    };
  }

  try {
    const token = await ensureToken();
    const feeder = await resolveFeeder(token);

    return {
      configured: true,
      online: isDeviceOnline(feeder),
      device_sn: feeder.deviceSn || feeder.id || null,
      device_name: feeder.name || null,
      product: feeder.productIdentifier || feeder.productName || null,
      region: String(config.petlibro.region || 'US').toUpperCase(),
    };
  } catch (err) {
    logger.error('petlibro status error', { error: err.message });
    return {
      configured: true,
      online: false,
      error: err.message,
    };
  }
}

function resetSession() {
  cachedToken = null;
  cachedFeeder = null;
}

module.exports = {
  feed,
  getStatus,
  resetSession,
};
