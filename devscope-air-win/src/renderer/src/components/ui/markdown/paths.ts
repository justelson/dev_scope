function getFileUrl(path: string): string {
    if (path.startsWith('http') || path.startsWith('data:')) return path

    const normalizedPath = path.replace(/\\/g, '/')
    const encodedPath = normalizedPath
        .split('/')
        .map((part) => {
            if (part.endsWith(':')) return part
            return encodeURIComponent(part)
        })
        .join('/')

    return `file:///${encodedPath}`
}

export function resolveImageSrc(src: string, filePath?: string): string {
    if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('file:')) {
        return src
    }

    if (!filePath) return src

    const normalizePath = (path: string) => path.replace(/\\/g, '/')
    const normalizedFilePath = normalizePath(filePath)
    const fileDir = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'))

    if (src.match(/^[a-zA-Z]:/) || src.startsWith('/')) {
        return getFileUrl(src)
    }

    const parts = fileDir.split('/')
    const srcParts = normalizePath(src).split('/')

    for (const part of srcParts) {
        if (part === '.') continue
        if (part === '..') {
            parts.pop()
        } else {
            parts.push(part)
        }
    }

    return getFileUrl(parts.join('/'))
}
