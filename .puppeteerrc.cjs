const { join } = require('path');

/**
 * Pins the puppeteer cache to a fixed path inside the app directory.
 * This file is read at both npm install time (when Chrome is downloaded)
 * and at runtime (when puppeteer looks for Chrome), overriding HOME and
 * PUPPETEER_CACHE_DIR env vars — which Render resets between build and run.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
