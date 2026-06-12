'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

const LOG_DIR = config.paths.logs;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(fileName, level, message, meta) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  });

  fs.appendFile(path.join(LOG_DIR, fileName), line + '\n', () => {});
}

module.exports = {
  feed(message, meta) {
    writeLog('feed.log', 'info', message, meta);
  },
  stream(message, meta) {
    writeLog('stream.log', 'info', message, meta);
  },
  error(message, meta) {
    writeLog('error.log', 'error', message, meta);
    console.error(`[pawnode] ${message}`, meta || '');
  },
};
