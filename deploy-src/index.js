const compression = require('compression');
const express = require('express');
const { createRequestHandler } = require('remix-google-cloud-functions-adapter');

const { cacheStaticMiddleware } = require('./cache-static.js');

const TEN_MINUTES = 10 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// start this immediately so that it can get on with caching entries from the filesystem in the background
const staticCache = cacheStaticMiddleware('public');

function shouldCompress(req, res) {
  if (req.headers['x-no-compression']) {
    return false;
  }

  // fallback to standard filter function
  return compression.filter(req, res);
}

// Start the app server without blocking
const appPromise = new Promise((resolve, reject) =>
  setImmediate(() => {
    try {
      const requestHandler = createRequestHandler({
        // `remix build` and `remix dev` output files to a build directory, you need
        // to pass that build to the request handler
        build: require('../build/index.js'),

        // return anything you want here to be available as `context` in your
        // loaders and actions. This is where you can bridge the gap between Remix
        // and your server
        getLoadContext(req, res) {
          return {};
        },
      });

      const app = express();

      app.use(
        compression({ filter: shouldCompress }),
        staticCache,
        express.static('public/assets', {
          maxAge: TWENTY_FOUR_HOURS,
        }),
        express.static('public', {
          maxAge: TEN_MINUTES,
        }),
      );

      app.all('*', requestHandler);
      resolve(app);
    } catch (err) {
      reject(err);
    }
  }),
);

const functions = require('@google-cloud/functions-framework');
const remixApp = functions.http('remixApp', async (req, res) => {
  const app = await appPromise;
  app(req, res, (err) => {
    if (err) {
      console.error('error handling request', err);
      res.status(500).send('Ooops! An error occured on the server');
    }
  });
});

module.exports = { remixApp };
