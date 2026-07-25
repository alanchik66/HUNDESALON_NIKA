import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(process.argv[2] || '.')
const PORT = Number(process.argv[3] || 8765)

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (reqPath === '/' || reqPath.endsWith('/')) reqPath += 'index.html'
  const filePath = path.join(ROOT, reqPath)
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      return res.end('Not found: ' + filePath)
    }
    const ext = path.extname(filePath).toLowerCase()
    const type = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream'
    res.writeHead(200, { 'content-type': type })
    res.end(data)
  })
})

server.listen(PORT, () => console.log(`image-server ${ROOT} http://127.0.0.1:${PORT}`))
