const { spawn } = require('child_process');

function logRestartDiagnostic(message) {
  const timestamp = new Date().toISOString();
  console.info(`[serverService] ${message} | ts=${timestamp} pid=${process.pid} os=${process.platform}`);
}

function restartServer() {
  logRestartDiagnostic('Restart requested');

  if (process.platform === 'win32') {
    const child = spawn('cmd', ['/c', `taskkill /PID ${process.pid} /F && npm start`], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    logRestartDiagnostic(`Windows restart dispatched (child pid ${child.pid})`);
    return;
  }

  const child = spawn('sh', ['-c', 'npm start'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  logRestartDiagnostic(`Unix restart dispatched (child pid ${child.pid})`);
  process.kill(process.pid, 'SIGTERM');
}

module.exports = {
  restartServer
};
