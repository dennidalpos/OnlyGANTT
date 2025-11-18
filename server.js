// server.js - Server Node.js con Express e persistenza JSON

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Cartella per i dati persistenti
const DATA_DIR = path.join(__dirname, 'data');

// Crea cartella data se non esiste
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Configurazione multer per upload file
const upload = multer({ dest: 'uploads/' });

// Storage in memoria (caricato da file JSON)
let departmentsData = [];
let projectsData = {};
let locksData = {};

// === FUNZIONI PERSISTENZA ===

// Carica tutti i dati leggendo i file JSON nella cartella data
function loadAllData() {
  departmentsData = [];
  projectsData = {};

  // Legge tutti i file .json nella cartella data
  const files = fs.readdirSync(DATA_DIR);
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const depName = file.replace('.json', '');
      try {
        const filePath = path.join(DATA_DIR, file);
        const projects = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        departmentsData.push(depName);
        projectsData[depName] = projects;
      } catch (err) {
        console.error(`Errore caricamento ${file}:`, err);
      }
    }
  });

  // Assicura che Home esista sempre
  if (!departmentsData.includes('Home')) {
    departmentsData.unshift('Home');
    projectsData['Home'] = [];
    saveProjects('Home');
  }

  console.log(`✅ Dati caricati: ${departmentsData.length} reparti, ${Object.keys(projectsData).reduce((sum, k) => sum + (projectsData[k]?.length || 0), 0)} progetti totali`);
}

// Salva progetti di un singolo department
function saveProjects(department) {
  const projectFile = path.join(DATA_DIR, `${department}.json`);
  const projects = projectsData[department] || [];
  fs.writeFileSync(projectFile, JSON.stringify(projects, null, 2), 'utf-8');
}

// Elimina file progetti di un department
function deleteProjectsFile(department) {
  const projectFile = path.join(DATA_DIR, `${department}.json`);
  if (fs.existsSync(projectFile)) {
    fs.unlinkSync(projectFile);
  }
}

// === API ENDPOINTS ===

// API: Get departments
app.get('/api/departments', (req, res) => {
  res.json(departmentsData);
});

// API: Create department
app.post('/api/departments', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nome reparto mancante' });
  }
  const trimmed = name.trim();
  if (departmentsData.includes(trimmed)) {
    return res.status(400).json({ error: 'Reparto già esistente' });
  }
  departmentsData.push(trimmed);
  projectsData[trimmed] = [];
  
  // Salva su disco
  saveProjects(trimmed);
  
  res.json({ ok: true, department: trimmed });
});

// API: Delete department
app.delete('/api/departments/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  if (name === 'Home') {
    return res.status(400).json({ error: 'Non puoi eliminare il reparto Home' });
  }
  const index = departmentsData.indexOf(name);
  if (index === -1) {
    return res.status(404).json({ error: 'Reparto non trovato' });
  }
  departmentsData.splice(index, 1);
  delete projectsData[name];
  delete locksData[name];
  
  // Elimina file su disco
  deleteProjectsFile(name);
  
  res.json({ ok: true });
});

// API: Get projects for department
app.get('/api/projects/:department', (req, res) => {
  const dep = decodeURIComponent(req.params.department);
  const projects = projectsData[dep] || [];
  res.json(projects);
});

// API: Save projects for department
app.post('/api/projects/:department', (req, res) => {
  const dep = decodeURIComponent(req.params.department);
  const projects = req.body;
  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: 'Dati non validi' });
  }
  projectsData[dep] = projects;
  
  // Salva su disco
  saveProjects(dep);
  
  res.json({ ok: true });
});

// API: Acquire lock
app.post('/api/lock/:department/acquire', (req, res) => {
  const dep = decodeURIComponent(req.params.department);
  const { userName } = req.body;
  
  if (!userName || typeof userName !== 'string' || userName.trim() === '') {
    return res.status(400).json({ error: 'Nome utente mancante' });
  }

  const currentLock = locksData[dep];
  
  if (currentLock && currentLock.lockedBy !== userName.trim()) {
    return res.status(423).json({
      lockedBy: currentLock.lockedBy,
      lockedAt: currentLock.lockedAt
    });
  }

  locksData[dep] = {
    lockedBy: userName.trim(),
    lockedAt: new Date().toISOString()
  };

  res.json({ ok: true });
});

// API: Release lock
app.post('/api/lock/:department/release', (req, res) => {
  const dep = decodeURIComponent(req.params.department);
  const { userName } = req.body;

  const currentLock = locksData[dep];
  if (currentLock && currentLock.lockedBy === userName?.trim()) {
    delete locksData[dep];
  }

  res.json({ ok: true });
});

// API: Upload projects from JSON file
app.post('/api/upload/:department', upload.single('file'), (req, res) => {
  const dep = decodeURIComponent(req.params.department);
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Nessun file caricato' });
  }

  try {
    const fileContent = fs.readFileSync(file.path, 'utf-8');
    const projects = JSON.parse(fileContent);

    if (!Array.isArray(projects)) {
      throw new Error('Il file JSON deve contenere un array di progetti');
    }

    projectsData[dep] = projects;
    
    // Salva su disco
    saveProjects(dep);

    fs.unlinkSync(file.path);

    res.json({ ok: true });
  } catch (error) {
    if (file && file.path) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    res.status(400).json({ error: error.message || 'Errore nel parsing del JSON' });
  }
});

// Carica dati all'avvio
loadAllData();

// Avvia il server
app.listen(PORT, () => {
  console.log(`\n🚀 Server Only GANTT avviato su http://localhost:${PORT}`);
  console.log(`📂 Cartella corrente: ${__dirname}`);
  console.log(`💾 Dati persistenti in: ${DATA_DIR}\n`);
});