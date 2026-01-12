const crypto = require("crypto");

function generateDeleteCode() {
  const n = crypto.randomInt(0, 1_000_000);   // 0–999999
  const s = n.toString().padStart(6, "0");    // "000000"–"999999"
  return `${s.slice(0, 3)}-${s.slice(3)}`;    // "123-456"
}

module.exports = { generateDeleteCode };
