import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, join, relative } from 'path'

const ROOT = process.cwd()
const SRC_DIR = join(ROOT, 'src')
const WARN_LIMIT = 300
const HARD_LIMIT = 500
const INCLUDED_EXTENSIONS = new Set(['.ts', '.tsx'])
const EXCLUDED_DIRS = new Set(['node_modules', 'out', 'dist', '.git'])
const strictMode = process.argv.includes('--strict')
const LOC_EXEMPTIONS = [
    {
        id: 'assistant-in-progress',
        reason: 'Assistant implementation is still being actively built out.',
        prefixes: [
            'src/main/assistant/',
            'src/shared/assistant/',
            'src/renderer/src/pages/assistant/',
            'src/renderer/src/lib/assistant/'
        ],
        exactPaths: [
            'src/main/ipc/handlers/assistant-handlers.ts',
            'src/preload/adapters/assistant-adapter.ts',
            'src/renderer/src/pages/Assistant.tsx'
        ]
    }
]

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

function getLocExemption(filePath) {
    for (const exemption of LOC_EXEMPTIONS) {
        if (exemption.exactPaths?.includes(filePath)) return exemption
        if (exemption.prefixes?.some((prefix) => filePath.startsWith(prefix))) return exemption
    }

    return null
}

const allFiles = []
walk(SRC_DIR, allFiles)

allFiles.sort((a, b) => b.lineCount - a.lineCount)
const classifiedFiles = allFiles.map((item) => ({
    ...item,
    exemption: getLocExemption(item.path)
}))
const trackedFiles = classifiedFiles.filter((item) => !item.exemption)
const exemptFiles = classifiedFiles.filter((item) => item.exemption)
const warningFiles = trackedFiles.filter((item) => item.lineCount > WARN_LIMIT)
const hardLimitFiles = trackedFiles.filter((item) => item.lineCount > HARD_LIMIT)
const exemptWarningFiles = exemptFiles.filter((item) => item.lineCount > WARN_LIMIT)
const exemptHardLimitFiles = exemptFiles.filter((item) => item.lineCount > HARD_LIMIT)

console.log(`LOC Policy: warn>${WARN_LIMIT}, hard>${HARD_LIMIT}`)
console.log(`Scanned ${allFiles.length} files under src/`)
if (exemptFiles.length > 0) {
    console.log(`Exempt files: ${exemptFiles.length}`)
}
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

if (exemptFiles.length > 0) {
    console.log('')
    console.log('Exempt paths (reported, not enforced):')
    for (const exemption of LOC_EXEMPTIONS) {
        const matches = exemptFiles.filter((item) => item.exemption?.id === exemption.id)
        if (matches.length === 0) continue
        const warningCount = matches.filter((item) => item.lineCount > WARN_LIMIT).length
        const hardCount = matches.filter((item) => item.lineCount > HARD_LIMIT).length
        console.log(`- ${exemption.id}: ${exemption.reason}`)
        console.log(`  matched ${matches.length} files, ${warningCount} above warning, ${hardCount} above hard`)
    }
}

if (exemptWarningFiles.length > 0) {
    console.log('')
    console.log('Exempt files above warning threshold:')
    printTable(exemptWarningFiles)
}

if (exemptHardLimitFiles.length > 0) {
    console.log('')
    console.log('Exempt files above hard limit:')
    printTable(exemptHardLimitFiles)
}

if (strictMode && hardLimitFiles.length > 0) {
    console.error('')
    console.error(`Strict mode failed: ${hardLimitFiles.length} files exceed hard limit.`)
    process.exit(1)
}
