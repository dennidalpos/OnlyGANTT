const express = require("express")
const fs = require("fs")
const path = require("path")
const multer = require("multer")

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json({ limit: "2mb" }))
app.use(express.urlencoded({ extended: true }))

const publicDir = __dirname

app.use(express.static(publicDir))

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"))
})

const dataDir = path.join(__dirname, "data")
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

function sanitizeDepartmentName(name) {
  const base = String(name || "").trim()
  if (!base) return "Generale"
  return base.replace(/[^a-zA-Z0-9_-]/g, "_")
}

function getDepartmentFilePath(depName) {
  const safe = sanitizeDepartmentName(depName)
  return path.join(dataDir, safe + ".json")
}

function readProjectsForDepartment(depName) {
  const filePath = getDepartmentFilePath(depName)
  if (!fs.existsSync(filePath)) {
    return []
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8")
    const json = JSON.parse(raw)
    if (Array.isArray(json)) return json
    return []
  } catch (e) {
    return []
  }
}

function writeProjectsForDepartment(depName, projects) {
  const filePath = getDepartmentFilePath(depName)
  fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), "utf-8")
}

function listDepartments() {
  const files = fs.readdirSync(dataDir, { withFileTypes: true })
  const names = files
    .filter(f => f.isFile() && f.name.toLowerCase().endsWith(".json"))
    .map(f => f.name.replace(/\.json$/i, ""))
  if (!names.includes("Generale")) {
    names.push("Generale")
  }
  names.sort((a, b) => a.localeCompare(b, "it"))
  return names
}

app.get("/api/departments", (req, res) => {
  try {
    const deps = listDepartments()
    res.json(deps)
  } catch (e) {
    res.status(500).json({ error: "Errore nel leggere i reparti" })
  }
})

app.post("/api/departments", (req, res) => {
  const rawName = (req.body && req.body.name) || ""
  const trimmed = rawName.trim()
  if (!trimmed) {
    return res.status(400).json({ error: "Nome reparto obbligatorio" })
  }
  const safe = sanitizeDepartmentName(trimmed)
  const filePath = getDepartmentFilePath(trimmed)
  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: "Reparto già esistente", name: safe })
  }
  try {
    fs.writeFileSync(filePath, "[]", "utf-8")
    res.status(201).json({ ok: true, name: safe, originalName: trimmed })
  } catch (e) {
    res.status(500).json({ error: "Errore nella creazione del reparto" })
  }
})

app.delete("/api/departments/:name", (req, res) => {
  const dep = req.params.name
  const filePath = getDepartmentFilePath(dep)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Reparto non trovato" })
  }
  try {
    fs.unlinkSync(filePath)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: "Errore nell'eliminazione del reparto" })
  }
})

app.get("/api/projects/:department", (req, res) => {
  const dep = req.params.department
  try {
    const projects = readProjectsForDepartment(dep)
    res.json(projects)
  } catch (e) {
    res.status(500).json({ error: "Errore nel leggere i progetti" })
  }
})

app.post("/api/projects/:department", (req, res) => {
  const dep = req.params.department
  const body = req.body
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: "Formato non valido, atteso array di progetti" })
  }
  try {
    writeProjectsForDepartment(dep, body)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: "Errore nel salvataggio dei progetti" })
  }
})

const upload = multer({ storage: multer.memoryStorage() })

app.post("/api/upload/:department", upload.single("file"), (req, res) => {
  const dep = req.params.department
  if (!req.file) {
    return res.status(400).json({ error: "File mancante" })
  }
  try {
    const content = req.file.buffer.toString("utf-8")
    const json = JSON.parse(content)
    if (!Array.isArray(json)) {
      return res.status(400).json({ error: "JSON non valido: atteso un array di progetti" })
    }
    writeProjectsForDepartment(dep, json)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: "JSON non valido" })
  }
})

const locks = {}

app.post("/api/lock/:department/acquire", (req, res) => {
  const dep = decodeURIComponent(req.params.department || "")
  const userName = ((req.body && req.body.userName) || "").trim()
  if (!dep) {
    return res.status(400).json({ error: "Reparto mancante" })
  }
  if (!userName) {
    return res.status(400).json({ error: "userName mancante" })
  }
  const existing = locks[dep]
  if (!existing || existing.userName === userName) {
    locks[dep] = { userName, since: Date.now() }
    return res.json({ ok: true, department: dep, userName })
  } else {
    return res
      .status(423)
      .json({ ok: false, department: dep, lockedBy: existing.userName })
  }
})

app.post("/api/lock/:department/release", (req, res) => {
  const dep = decodeURIComponent(req.params.department || "")
  const userName = ((req.body && req.body.userName) || "").trim()
  if (!dep || !userName) {
    return res.status(400).json({ error: "Reparto o userName mancanti" })
  }
  const existing = locks[dep]
  if (existing && existing.userName === userName) {
    delete locks[dep]
  }
  res.json({ ok: true })
})

app.get("/api/lock/:department", (req, res) => {
  const dep = decodeURIComponent(req.params.department || "")
  if (!dep) {
    return res.status(400).json({ error: "Reparto mancante" })
  }
  const existing = locks[dep]
  if (!existing) {
    return res.json({ locked: false, lockedBy: null })
  }
  res.json({ locked: true, lockedBy: existing.userName, since: existing.since })
})

app.listen(PORT, () => {
  console.log("Server in ascolto su http://localhost:" + PORT)
})
