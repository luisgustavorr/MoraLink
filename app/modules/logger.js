const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'connections.log');

function log(type, status, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    status,
    ...details
  };
  const logLine = JSON.stringify(entry) + '\n';
  fs.appendFileSync(logFilePath, logLine, { flag: 'a' });
  console.log('[LOG]', logLine.trim());
}

module.exports = { log };