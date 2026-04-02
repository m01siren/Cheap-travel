import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const envPath = path.join(repoRoot, '.env')
const envExamplePath = path.join(repoRoot, '.env.example')

// Если `.env` не существует (например, после клонирования), создаём её из `.env.example`,
// чтобы Vite/Playwright могли стартовать без реальных секретов.
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath)
}

