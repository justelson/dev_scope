import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join, relative } from 'path'

const ROOT = process.cwd()
const SRC_DIR = join(ROOT, 'src')
const WARN_LIMIT = 300
const HARD_LIMIT = 500
const INCLUDED_EXTENSIONS = new Set(['.ts', '.tsx'])
const EXCLUDED_DIRS = new Set(['node_modules', 'out', 'dist', '.git'])
const strictMode = process.argv.includes('--strict')

function walk(dir, bucket) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue
            walk(join(dir, entry.name), bucket)
            continue
        }

        const fullPath = join(dir, entry.name)
        const extension = extname(fullPath).toLowerCase()
        if (!INCLUDED_EXTENSIONS.has(extension)) continue

        const lineCount = readFileSync(fullPath, 'utf8').split(/\r?\n/).length
        bucket.push({
            path: relative(ROOT, fullPath).replace(/\\/g, '/'),
            lineCount
        })
    }
}

function printTable(rows) {
    for (const row of rows) {
        const lineText = String(row.lineCount).padStart(4, ' ')
        console.log(`${lineText}  ${row.path}`)
    }
}

const allFiles = []
walk(SRC_DIR, allFiles)

allFiles.sort((a, b) => b.lineCount - a.lineCount)
const warningFiles = allFiles.filter((item) => item.lineCount > WARN_LIMIT)
const hardLimitFiles = allFiles.filter((item) => item.lineCount > HARD_LIMIT)

console.log(`LOC Policy: warn>${WARN_LIMIT}, hard>${HARD_LIMIT}`)
console.log(`Scanned ${allFiles.length} files under src/`)
console.log('')

if (warningFiles.length === 0) {
    console.log('No files above warning threshold.')
} else {
    console.log('Files above warning threshold:')
    printTable(warningFiles)
}

console.log('')
if (hardLimitFiles.length === 0) {
    console.log('No files above hard limit.')
} else {
    console.log('Files above hard limit:')
    printTable(hardLimitFiles)
}

if (strictMode && hardLimitFiles.length > 0) {
    console.error('')
    console.error(`Strict mode failed: ${hardLimitFiles.length} files exceed hard limit.`)
    process.exit(1)
}

