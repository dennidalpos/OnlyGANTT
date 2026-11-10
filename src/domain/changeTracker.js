const AppConfig = require('../app-config.js');

const STATE_LABELS = AppConfig?.stateLabels || {
  'da_iniziare': 'Da iniziare',
  'in_corso': 'In corso',
  'in_ritardo': 'In ritardo',
  'completato': 'Completato'
};

function getStateLabel(stateKey) {
  return STATE_LABELS[stateKey] || stateKey || 'Non specificato';
}

function computeDepartmentChanges(oldData, newData, userName = 'Un utente') {
  const changes = [];
  const oldProjects = Array.isArray(oldData?.projects) ? oldData.projects : [];
  const newProjects = Array.isArray(newData?.projects) ? newData.projects : [];

  const oldMap = new Map();
  oldProjects.forEach(p => {
    if (p.id) oldMap.set(p.id, p);
  });

  const newMap = new Map();
  newProjects.forEach(p => {
    if (p.id) newMap.set(p.id, p);
  });

  // 1. Added & Modified Projects
  newProjects.forEach(newP => {
    const oldP = oldMap.get(newP.id);
    if (!oldP) {
      changes.push(`Aggiunto nuovo progetto "${newP.nome || 'Senza nome'}"`);
      return;
    }

    // Check Project level changes
    if (oldP.nome !== newP.nome) {
      changes.push(`Progetto "${oldP.nome}" rinominato in "${newP.nome}"`);
    }
    if (oldP.stato !== newP.stato) {
      changes.push(`Stato del progetto "${newP.nome}" cambiato in "${getStateLabel(newP.stato)}"`);
    }
    if (oldP.dataInizio !== newP.dataInizio || oldP.dataFine !== newP.dataFine) {
      changes.push(`Date del progetto "${newP.nome}" aggiornate (${newP.dataInizio || 'N/D'} - ${newP.dataFine || 'N/D'})`);
    }

    // Check Phase changes inside Project
    const oldPhases = Array.isArray(oldP.fasi) ? oldP.fasi : [];
    const newPhases = Array.isArray(newP.fasi) ? newP.fasi : [];

    const oldPhaseMap = new Map(oldPhases.map(f => [f.id, f]));
    const newPhaseMap = new Map(newPhases.map(f => [f.id, f]));

    newPhases.forEach(newF => {
      const oldF = oldPhaseMap.get(newF.id);
      if (!oldF) {
        changes.push(`Aggiunta nuova fase "${newF.nome || 'Senza nome'}" al progetto "${newP.nome}"`);
        return;
      }

      if (oldF.nome !== newF.nome) {
        changes.push(`Fase "${oldF.nome}" rinominata in "${newF.nome}" nel progetto "${newP.nome}"`);
      }
      if (oldF.stato !== newF.stato) {
        changes.push(`Stato fase "${newF.nome}" (${newP.nome}) cambiato in "${getStateLabel(newF.stato)}"`);
      }
      if (oldF.percentualeCompletamento !== newF.percentualeCompletamento) {
        changes.push(`Completamento fase "${newF.nome}" (${newP.nome}) aggiornato a ${newF.percentualeCompletamento ?? 0}%`);
      }
      if (oldF.dataInizio !== newF.dataInizio || oldF.dataFine !== newF.dataFine) {
        changes.push(`Date fase "${newF.nome}" (${newP.nome}) aggiornate (${newF.dataInizio || 'N/D'} - ${newF.dataFine || 'N/D'})`);
      }
      if (Boolean(oldF.milestone) !== Boolean(newF.milestone)) {
        changes.push(`Fase "${newF.nome}" (${newP.nome}) ${newF.milestone ? 'impostata come Milestone' : 'rimossa da Milestone'}`);
      }
    });

    oldPhases.forEach(oldF => {
      if (!newPhaseMap.has(oldF.id)) {
        changes.push(`Rimossa fase "${oldF.nome}" dal progetto "${newP.nome}"`);
      }
    });
  });

  // 2. Deleted Projects
  oldProjects.forEach(oldP => {
    if (!newMap.has(oldP.id)) {
      changes.push(`Rimosso progetto "${oldP.nome}"`);
    }
  });

  if (changes.length === 0 && oldProjects.length !== newProjects.length) {
    changes.push('Aggiornata la struttura dei progetti');
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    updatedBy: userName
  };
}

const changeTracker = {
  computeDepartmentChanges
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = changeTracker;
}

module.exports = changeTracker;
