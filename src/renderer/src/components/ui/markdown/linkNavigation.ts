import type { PreviewOpenOptions } from '../file-preview/types'

type MarkdownPathTarget = {
    path: string
    anchor?: string
}

type MarkdownLinkNavigationOptions = {
    href: string
    filePath?: string
    navigate?: (to: string) => void
    openPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void>
}

function normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/')
}

function denormalizePath(pathValue: string, sourcePath?: string): string {
    if (sourcePath?.includes('\\')) {
        return pathValue.replace(/\//g, '\\')
    }
    return pathValue
}

function isExternalHref(href: string): boolean {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)
}

function splitHrefAnchor(href: string): { pathname: string; anchor?: string } {
    const hashIndex = href.indexOf('#')
    if (hashIndex < 0) return { pathname: href }
    return {
        pathname: href.slice(0, hashIndex),
        anchor: href.slice(hashIndex + 1) || undefined
    }
}

function toFileUrlPath(pathname: string): string | null {
    try {
        const url = new URL(pathname)
        if (url.protocol !== 'file:') return null
        const decodedPath = decodeURIComponent(url.pathname || '')
        if (/^\/[a-zA-Z]:\//.test(decodedPath)) {
            return decodedPath.slice(1)
        }
        return decodedPath
    } catch {
        return null
    }
}

export function resolveMarkdownLinkTarget(href: string, filePath?: string): MarkdownPathTarget | null {
    const rawHref = String(href || '').trim()
    if (!rawHref || rawHref.startsWith('#') || isExternalHref(rawHref) && !rawHref.startsWith('file://')) {
        return null
    }

    const { pathname, anchor } = splitHrefAnchor(rawHref)
    let decodedPathname = pathname
    try {
        decodedPathname = pathname ? decodeURIComponent(pathname) : ''
    } catch {
        decodedPathname = pathname
    }

    if (rawHref.startsWith('file://')) {
        const resolvedFilePath = toFileUrlPath(rawHref)
        if (!resolvedFilePath) return null
        return { path: denormalizePath(normalizePath(resolvedFilePath), filePath), anchor }
    }

    if (!filePath) return null

    const normalizedSourcePath = normalizePath(filePath)
    const lastSlashIndex = normalizedSourcePath.lastIndexOf('/')
    const sourceDirectory = lastSlashIndex >= 0 ? normalizedSourcePath.slice(0, lastSlashIndex) : normalizedSourcePath

    let normalizedTargetPath = ''
    if (/^[a-zA-Z]:[\\/]/.test(decodedPathname) || decodedPathname.startsWith('\\\\')) {
        normalizedTargetPath = normalizePath(decodedPathname)
    } else if (decodedPathname.startsWith('/')) {
        const driveMatch = /^[a-zA-Z]:\//.exec(normalizedSourcePath)
        normalizedTargetPath = driveMatch ? `${driveMatch[0]}${decodedPathname.slice(1)}` : decodedPathname
    } else {
        const sourceParts = sourceDirectory.split('/')
        const minSegments = sourceParts[0]?.endsWith(':') ? 1 : 0
        for (const segment of normalizePath(decodedPathname).split('/')) {
            if (!segment || segment === '.') continue
            if (segment === '..') {
                if (sourceParts.length > minSegments) sourceParts.pop()
                continue
            }
            sourceParts.push(segment)
        }
        normalizedTargetPath = sourceParts.join('/')
    }

    if (!normalizedTargetPath) return null

    return {
        path: denormalizePath(normalizedTargetPath, filePath),
        anchor
    }
}

function splitFileNameAndExtension(targetPath: string): { name: string; extension: string } {
    const normalizedPath = normalizePath(targetPath)
    const name = normalizedPath.split('/').pop() || targetPath
    const dotIndex = name.lastIndexOf('.')
    if (dotIndex <= 0 || dotIndex === name.length - 1) {
        return { name, extension: '' }
    }
    return {
        name,
        extension: name.slice(dotIndex + 1).toLowerCase()
    }
}

export async function navigateMarkdownLink({
    href,
    filePath,
    navigate,
    openPreview
}: MarkdownLinkNavigationOptions): Promise<boolean> {
    const target = resolveMarkdownLinkTarget(href, filePath)
    if (!target) return false

    const pathInfo = await window.devscope.getPathInfo(target.path)
    if (!pathInfo.success || !pathInfo.exists) {
        return false
    }

    if (pathInfo.type === 'directory') {
        if (navigate) {
            navigate(`/folder-browse/${encodeURIComponent(pathInfo.path)}`)
            return true
        }
        const explorerResult = await window.devscope.openInExplorer(pathInfo.path)
        return Boolean(explorerResult?.success)
    }

    const { extension, name } = splitFileNameAndExtension(pathInfo.path)
    if (openPreview) {
        await openPreview({ name, path: pathInfo.path }, extension)
        return true
    }

    const openResult = await window.devscope.openFile(pathInfo.path)
    return Boolean(openResult?.success)
}
