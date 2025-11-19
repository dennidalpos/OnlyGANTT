const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.json'];
const MAX_DEPARTMENT_NAME_LENGTH = 50;
const RESERVED_NAMES = ['Home', 'CON', 'PRN', 'AUX', 'NUL'];

let departmentsData = [];
let projectsData = {};
let locksData = {};

const validateDepartmentName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nome reparto non valido' };
  }

  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Nome reparto vuoto' };
  }

  if (trimmed.length > MAX_DEPARTMENT_NAME_LENGTH) {
    return { valid: false, error: 'Nome reparto troppo lungo' };
  }

  if (!/^[a-zA-Z0-9À-ÿ\s_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Nome reparto contiene caratteri non validi' };
  }

  if (RESERVED_NAMES.includes(trimmed)) {
    return { valid: false, error: 'Nome reparto riservato' };
  }

  return { valid: true, name: trimmed };
};

const validateProjects = (projects) => {
  if (!Array.isArray(projects)) {
    return { valid: false, error: 'I dati devono essere un array' };
  }

  if (projects.length > 1000) {
    return { valid: false, error: 'Troppi progetti (max 1000)' };
  }

  return { valid: true };
};

const ensureDataDir = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Errore creazione cartella data:', error);
    throw error;
  }
};

const loadAllData = async () => {
  try {
    await ensureDataDir();
    
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    departmentsData = [];
    projectsData = {};

    const loadPromises = jsonFiles.map(async (file) => {
      const depName = file.replace('.json', '');
      try {
        const filePath = path.join(DATA_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const projects = JSON.parse(content);
        
        if (Array.isArray(projects)) {
          departmentsData.push(depName);
          projectsData[depName] = projects;
        }
      } catch (err) {
        console.error(`Errore caricamento ${file}:`, err.message);
      }
    });

    await Promise.all(loadPromises);

    if (!departmentsData.includes('Home')) {
      departmentsData.unshift('Home');
      projectsData['Home'] = [];
      await saveProjects('Home');
    }

    console.log(`✅ Dati caricati: ${departmentsData.length} reparti, ${Object.values(projectsData).reduce((sum, p) => sum + p.length, 0)} progetti totali`);
  } catch (error) {
    console.error('Errore critico nel caricamento dati:', error);
    departmentsData = ['Home'];
    projectsData = { 'Home': [] };
  }
};

const saveProjects = async (department) => {
  const validation = validateDepartmentName(department);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const projectFile = path.join(DATA_DIR, `${validation.name}.json`);
  const projects = projectsData[department] || [];
  
  const validationResult = validateProjects(projects);
  if (!validationResult.valid) {
    throw new Error(validationResult.error);
  }

  try {
    await fs.writeFile(projectFile, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Errore salvataggio progetti per ${department}:`, error);
    throw error;
  }
};

const deleteProjectsFile = async (department) => {
  const validation = validateDepartmentName(department);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const projectFile = path.join(DATA_DIR, `${validation.name}.json`);
  
  try {
    await fs.unlink(projectFile);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Errore eliminazione file per ${department}:`, error);
      throw error;
    }
  }
};

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON non valido' });
  }
  next();
});

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Tipo di file non consentito'));
    }
    cb(null, true);
  }
});

app.get('/api/departments', (req, res) => {
  try {
    res.json(departmentsData);
  } catch (error) {
    console.error('Errore get departments:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const validation = validateDepartmentName(req.body.name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const trimmed = validation.name;

    if (departmentsData.includes(trimmed)) {
      return res.status(400).json({ error: 'Reparto già esistente' });
    }

    departmentsData.push(trimmed);
    projectsData[trimmed] = [];

    await saveProjects(trimmed);

    res.json({ ok: true, department: trimmed });
  } catch (error) {
    console.error('Errore creazione reparto:', error);
    res.status(500).json({ error: 'Errore nella creazione del reparto' });
  }
});

app.delete('/api/departments/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);

    if (name === 'Home') {
      return res.status(400).json({ error: 'Non puoi eliminare il reparto Home' });
    }

    const validation = validateDepartmentName(name);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const index = departmentsData.indexOf(name);
    if (index === -1) {
      return res.status(404).json({ error: 'Reparto non trovato' });
    }

    departmentsData.splice(index, 1);
    delete projectsData[name];
    delete locksData[name];

    await deleteProjectsFile(name);

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore eliminazione reparto:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del reparto' });
  }
});

app.get('/api/projects/:department', (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const projects = projectsData[dep] || [];
    res.json(projects);
  } catch (error) {
    console.error('Errore get projects:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/projects/:department', async (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const projects = req.body;

    const validation = validateProjects(projects);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    projectsData[dep] = projects;

    await saveProjects(dep);

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore salvataggio progetti:', error);
    res.status(500).json({ error: 'Errore nel salvataggio dei progetti' });
  }
});

app.post('/api/lock/:department/acquire', (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const { userName } = req.body;

    if (!userName || typeof userName !== 'string' || userName.trim() === '') {
      return res.status(400).json({ error: 'Nome utente mancante' });
    }

    const trimmedUserName = userName.trim();
    if (trimmedUserName.length > 100) {
      return res.status(400).json({ error: 'Nome utente troppo lungo' });
    }

    const currentLock = locksData[dep];

    if (currentLock && currentLock.lockedBy !== trimmedUserName) {
      return res.status(423).json({
        lockedBy: currentLock.lockedBy,
        lockedAt: currentLock.lockedAt
      });
    }

    locksData[dep] = {
      lockedBy: trimmedUserName,
      lockedAt: new Date().toISOString()
    };

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore acquisizione lock:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/lock/:department/release', (req, res) => {
  try {
    const dep = decodeURIComponent(req.params.department);
    const { userName } = req.body;

    const currentLock = locksData[dep];
    if (currentLock && currentLock.lockedBy === userName?.trim()) {
      delete locksData[dep];
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Errore rilascio lock:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post('/api/upload/:department', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  
  try {
    const dep = decodeURIComponent(req.params.department);

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const projects = JSON.parse(fileContent);

    const validation = validateProjects(projects);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    projectsData[dep] = projects;

    await saveProjects(dep);
    await fs.unlink(filePath);

    res.json({ ok: true });
  } catch (error) {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Errore eliminazione file temporaneo:', unlinkError);
      }
    }

    const errorMessage = error.message || 'Errore nel parsing del JSON';
    console.error('Errore upload:', errorMessage);
    res.status(400).json({ error: errorMessage });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

app.use((err, req, res, next) => {
  console.error('Errore non gestito:', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

const startServer = async () => {
  try {
    await loadAllData();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server Only GANTT avviato su http://localhost:${PORT}`);
      console.log(`📂 Cartella corrente: ${__dirname}`);
      console.log(`💾 Dati persistenti in: ${DATA_DIR}\n`);
    });
  } catch (error) {
    console.error('Errore fatale all\'avvio:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (error) => {
  console.error('Eccezione non catturata:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejection non gestita:', reason);
  process.exit(1);
});

startServer();
