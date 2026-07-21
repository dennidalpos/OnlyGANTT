function createSseService({ normalizeDepartmentName }) {
  const sseClients = new Map();

  function broadcastDepartmentUpdate(department, data) {
    const normalized = normalizeDepartmentName(department);
    const clients = sseClients.get(normalized);
    if (clients && clients.size > 0) {
      const payload = JSON.stringify({
        type: 'update',
        department: normalized,
        revision: data.meta?.revision || 1,
        updatedAt: data.meta?.updatedAt || new Date().toISOString()
      });
      for (const res of clients) {
        res.write(`data: ${payload}\n\n`);
      }
    }
  }

  return {
    sseClients,
    broadcastDepartmentUpdate
  };
}

module.exports = { createSseService };
