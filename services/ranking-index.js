'use strict';

const feedStore = require('./feed-store');

/**
 * Period keys for weekly / monthly ranking partitions.
 *
 * @param {Date} date
 * @returns {{ week: string, month: string }}
 */
function periodKeys(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((date - jan1) / 86400000) + 1;
  const week = String(Math.ceil(dayOfYear / 7)).padStart(2, '0');

  return {
    week: `${year}-W${week}`,
    month: `${year}-${month}`,
  };
}

/**
 * Record a feed event for future ranking queries.
 *
 * @param {object} payload
 */
function recordFeed(payload) {
  const keys = periodKeys(new Date(payload.feed_time || Date.now()));

  feedStore.appendRankingEvent({
    event_type: 'feed',
    streamer: payload.streamer,
    viewer: payload.viewer,
    viewer_id: payload.viewer_id || null,
    feed_id: payload.feed_id || null,
    portion: payload.portion || 1,
    donation_amount: payload.donation_amount || 0,
    status: payload.status || 'success',
    period_keys: keys,
  });
}

/**
 * @param {object} options
 * @returns {Array<{ entity: string, count: number }>}
 */
function getFeedRanking(options) {
  return feedStore.aggregateFeedCounts(options);
}

/**
 * Placeholder for donation ranking (future payment webhooks).
 *
 * @param {object} payload
 */
function recordDonation(payload) {
  const keys = periodKeys(new Date(payload.ts || Date.now()));

  feedStore.appendRankingEvent({
    event_type: 'donation',
    streamer: payload.streamer,
    viewer: payload.viewer,
    viewer_id: payload.viewer_id || null,
    donation_amount: payload.amount || 0,
    status: payload.status || 'success',
    period_keys: keys,
  });
}

module.exports = {
  periodKeys,
  recordFeed,
  recordDonation,
  getFeedRanking,
};
