'use strict';

const config = require('../config');
const logger = require('./logger');

async function checkGo2rtcStatus() {
  const url = `${config.go2rtcUrl}/api`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      logger.stream('go2rtc unreachable', { url, status: response.status });
      return { online: false, status: response.status, url: config.go2rtcUrl };
    }

    let streams = [];
    try {
      const streamsResponse = await fetch(`${config.go2rtcUrl}/api/streams`, {
        signal: AbortSignal.timeout(5000),
      });
      if (streamsResponse.ok) {
        const data = await streamsResponse.json();
        streams = Object.keys(data || {});
      }
    } catch (err) {
      logger.stream('go2rtc streams check failed', { error: err.message });
    }

    const streamReady = streams.includes(config.go2rtcStreamName);

    return {
      online: true,
      url: config.go2rtcUrl,
      stream_name: config.go2rtcStreamName,
      stream_ready: streamReady,
      streams,
    };
  } catch (err) {
    logger.stream('go2rtc check error', { error: err.message });
    return { online: false, error: err.message, url: config.go2rtcUrl };
  }
}

async function getStreamViewerCount(streamName) {
  const name = String(streamName || config.go2rtcStreamName || '').trim();
  if (!name) {
    return { viewers: 0, stream: '', source: 'go2rtc_consumers' };
  }

  try {
    const response = await fetch(`${config.go2rtcUrl}/api/streams`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { viewers: 0, stream: name, source: 'go2rtc_consumers', online: false };
    }

    const data = await response.json();
    const entry = data && typeof data === 'object' ? data[name] : null;
    const consumers = entry && Array.isArray(entry.consumers) ? entry.consumers : [];
    const producers = entry && Array.isArray(entry.producers) ? entry.producers : [];
    const streamActive = producers.length > 0;

    logger.stream('go2rtc viewer count', {
      stream: name,
      consumers: consumers.length,
      producers: producers.length,
      stream_active: streamActive,
      has_entry: !!entry,
    });

    return {
      viewers: consumers.length,
      stream: name,
      source: 'go2rtc_consumers',
      online: true,
      stream_active: streamActive,
    };
  } catch (err) {
    logger.stream('go2rtc viewer count failed', { error: err.message, stream: name });
    return { viewers: 0, stream: name, source: 'go2rtc_consumers', online: false, error: err.message };
  }
}

module.exports = {
  checkGo2rtcStatus,
  getStreamViewerCount,
};
