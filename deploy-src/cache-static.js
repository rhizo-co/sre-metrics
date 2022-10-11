const { resolve, extname } = require('path');
const { readdir, readFile } = require('fs').promises;

/*
 This file implements a fairly simple in-memory cache of all the static assets on the provided path.
 It populates the cache by reading from the filesystem immediately on startup. This generally makes
 a big reduction in the _perceived_ cold-start time of the application when it is served from cloud
 functions.
*/

// TODO: only initialise the cache if we are going to use it?
const memoryCache = require('memory-cache');

async function* processFiles(dir, fn) {
  const directoryEntries = await readdir(dir, { withFileTypes: true });
  const childQueue = [];

  let inFlightPromise = undefined;

  for (const entry of directoryEntries) {
    const resolvedDirectory = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      childQueue.push(processFiles(resolvedDirectory, fn));
    } else {
      const nextPromise = fn(resolvedDirectory, extname(resolvedDirectory));
      if (inFlightPromise) {
        yield await inFlightPromise;
      }
      inFlightPromise = nextPromise;
    }
  }

  if (inFlightPromise) {
    yield await inFlightPromise;
  }
  for (const childEntries of childQueue) {
    yield* childEntries;
  }
}

async function storeFileInCache(filesystemPath, fileExtension, prefixToStrip) {
  // We strip the prefix so that the keys in the cache match the _relative_ paths that express urls get
  // i.e. a request for <hostname>/styles/main.css will have an "express path" of /styles/main.css and a
  // filesystem path of (something like) /workspace/remix-app/public/styles/main.css.
  // To get the keys to match we strip off the '/workspace/remix-app/public/' prefix from the filesystem path.
  const key = filesystemPath.slice(prefixToStrip.length);
  memoryCache.put(key, {
    type: fileExtension,
    buffer: await readFile(filesystemPath),
  });
  return key;
}

async function cacheStaticDirectory(staticDirectoryPath) {
  const staticDirectoryResolvedPath = resolve(staticDirectoryPath);
  function cacheFile(filePath, fileExtension) {
    return storeFileInCache(filePath, fileExtension, staticDirectoryResolvedPath);
  }

  let totalBytesCached = 0;
  for await (path of processFiles(staticDirectoryPath, cacheFile)) {
    const byteLength = memoryCache.get(path).buffer.byteLength;

    // Log the file and size in the cache - this is only logged on startup and allows us to debug memory problems if they occur.
    console.log('cached', path, byteLength);
    totalBytesCached += byteLength;
  }

  return { totalBytesCached };
}

function cacheStaticMiddleware(path) {
  const startTimestamp = Date.now();

  // Setting off a promise that is not awaited is a risky thing. We have to do it in this case because Express middleware doesn't support async/await directly.
  cacheStaticDirectory(path)
    .then(({ totalBytesCached }) => console.log(totalBytesCached, 'bytes of static assets cached after', Date.now() - startTimestamp))
    .catch((error) => {
      console.error('An error occurred while caching static assets:', error);
    });

  return function tryStaticCache(req, res, next) {
    try {
      const key = req.path;
      const cached = memoryCache.get(key);
      if (cached) {
        if (cached.type) {
          res.type(cached.type);
        }
        res.send(cached.buffer);
        return;
      } else {
        next();
      }
    } catch (error) {
      console.error('An error occurred while serving static assets:', error);
      next(error);
    }
  };
}

module.exports = { cacheStaticMiddleware };
