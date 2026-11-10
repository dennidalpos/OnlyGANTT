const fs = require('fs');
const http = require('http');
const https = require('https');

function readHttpsFile(label, filePath) {
  if (!filePath) {
    throw new Error(`HTTPS abilitato ma ${label} non impostato.`);
  }
  try {
    return fs.readFileSync(filePath);
  } catch (err) {
    throw new Error(`Impossibile leggere ${label} da "${filePath}": ${err.message}`);
  }
}

function startServer(app, { port, httpsEnabled, httpsKeyPath, httpsCertPath }) {
  if (httpsEnabled) {
    const key = readHttpsFile('HTTPS_KEY_PATH', httpsKeyPath);
    const cert = readHttpsFile('HTTPS_CERT_PATH', httpsCertPath);
    const server = https.createServer({ key, cert }, app);
    server.listen(port);
    return { server, protocol: 'https' };
  }

  const server = http.createServer(app);
  server.listen(port);
  return { server, protocol: 'http' };
}

module.exports = { startServer };
