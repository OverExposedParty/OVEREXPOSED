const isProduction = process.env.NODE_ENV === 'production';

function debugLog(...args) {
  if (!isProduction) {
    console.log(...args);
  }
}

function debugWarn(...args) {
  if (!isProduction) {
    console.warn(...args);
  }
}

module.exports = {
  debugLog,
  debugWarn,
  isProduction
};
