const fs = require('fs');
const path = require('path');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function logAuditEvent({ eventType, actor, ip, dataDir = 'data', details = null }) {
  if (!eventType) {
    throw new Error('eventType is required');
  }

  ensureDirExists(dataDir);

  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    actor: actor || null,
    ip: ip || null,
    details
  };

  const filePath = path.join(dataDir, 'audit.log');
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

module.exports = {
  logAuditEvent
};
