const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const serverEntry = path.join(repoRoot, 'server', 'server.js');

function logRestartDiagnostic(message) {
  const timestamp = new Date().toISOString();
  console.info(`[serverService] ${message} | ts=${timestamp} pid=${process.pid} os=${process.platform}`);
}

function restartServer() {
  if ((process.env.ONLYGANTT_SERVICE_MANAGER || '').toLowerCase() === 'nssm') {
    logRestartDiagnostic('Restart delegated to NSSM service manager');
    process.exit(0);
    return;
  }

  logRestartDiagnostic('Restart requested');
  const child = spawn(process.execPath, [serverEntry], {
    cwd: repoRoot,
    env: { ...process.env },
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  logRestartDiagnostic(`Restart dispatched (child pid ${child.pid})`);
  process.kill(process.pid, 'SIGTERM');
}

module.exports = {
  restartServer
};
