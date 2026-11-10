const assert = require('assert');
const { computeDepartmentChanges } = require('../src/domain/changeTracker');

function runChangeTrackerTests() {
  const oldData = {
    projects: [
      {
        id: 'p1',
        nome: 'Progetto Alpha',
        stato: 'da_iniziare',
        dataInizio: '2026-01-01',
        dataFine: '2026-01-31',
        fasi: [
          {
            id: 'f1',
            nome: 'Analisi',
            stato: 'da_iniziare',
            percentualeCompletamento: 0,
            dataInizio: '2026-01-01',
            dataFine: '2026-01-15',
            milestone: false
          }
        ]
      }
    ]
  };

  const newData = {
    projects: [
      {
        id: 'p1',
        nome: 'Progetto Alpha Riprogrammato',
        stato: 'in_corso',
        dataInizio: '2026-01-01',
        dataFine: '2026-02-15',
        fasi: [
          {
            id: 'f1',
            nome: 'Analisi Completa',
            stato: 'completato',
            percentualeCompletamento: 100,
            dataInizio: '2026-01-01',
            dataFine: '2026-01-15',
            milestone: true
          },
          {
            id: 'f2',
            nome: 'Sviluppo',
            stato: 'in_corso',
            percentualeCompletamento: 20,
            dataInizio: '2026-01-16',
            dataFine: '2026-02-15',
            milestone: false
          }
        ]
      },
      {
        id: 'p2',
        nome: 'Progetto Beta',
        stato: 'da_iniziare',
        fasi: []
      }
    ]
  };

  const result = computeDepartmentChanges(oldData, newData, 'Mario Rossi');
  assert.strictEqual(result.hasChanges, true);
  assert.strictEqual(result.updatedBy, 'Mario Rossi');
  assert.ok(result.changes.some(c => c.includes('Progetto "Progetto Alpha" rinominato in "Progetto Alpha Riprogrammato"')));
  assert.ok(result.changes.some(c => c.includes('Stato del progetto "Progetto Alpha Riprogrammato" cambiato in "In corso"')));
  assert.ok(result.changes.some(c => c.includes('Fase "Analisi" rinominata in "Analisi Completa"')));
  assert.ok(result.changes.some(c => c.includes('Stato fase "Analisi Completa" (Progetto Alpha Riprogrammato) cambiato in "Completato"')));
  assert.ok(result.changes.some(c => c.includes('Completamento fase "Analisi Completa" (Progetto Alpha Riprogrammato) aggiornato a 100%')));
  assert.ok(result.changes.some(c => c.includes('impostata come Milestone')));
  assert.ok(result.changes.some(c => c.includes('Aggiunta nuova fase "Sviluppo"')));
  assert.ok(result.changes.some(c => c.includes('Aggiunto nuovo progetto "Progetto Beta"')));

  console.log('Change tracker unit tests passed successfully');
}

runChangeTrackerTests();
