// Maps app://crewmove/<path> requests onto files of the Vite build (dist/).
// Kept free of Electron imports so it can be checked with plain Node.
const fs = require('node:fs')
const path = require('node:path')

// Returns the absolute file to serve for a request URL, or null when the path
// escapes distDir (path traversal). Any path that is not an existing file falls
// back to index.html so TanStack Router's browser history survives a reload on
// a nested route.
function resolveDistFile(distDir, requestUrl) {
  const root = path.resolve(distDir)
  let relativePath

  try {
    relativePath = decodeURIComponent(new URL(requestUrl).pathname)
  } catch {
    return null
  }

  // Decoding can surface "..", "%5c" -> "\" or a drive letter, so the final
  // resolved path is what gets checked, not the raw URL.
  const filePath = path.resolve(root, '.' + path.sep + relativePath)
  const fromRoot = path.relative(root, filePath)

  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) {
    return null
  }

  if (fromRoot !== '' && isFile(filePath)) {
    return filePath
  }

  return path.join(root, 'index.html')
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

module.exports = { resolveDistFile }
