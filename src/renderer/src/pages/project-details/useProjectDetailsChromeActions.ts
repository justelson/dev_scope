import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { trackRecentProject } from '@/lib/recentProjects'
import { getParentFolderPath } from './projectDetailsPageHelpers'

type UseProjectDetailsChromeActionsParams = {
    decodedPath: string
    navigate: (to: string) => void
    projectPath?: string
    projectRootPath: string
    toast: {
        message: string
        visible: boolean
        actionLabel?: string
        actionTo?: string
        tone?: 'success' | 'error' | 'info'
    } | null
    setToast: Dispatch<SetStateAction<{
        message: string
        visible: boolean
        actionLabel?: string
        actionTo?: string
        tone?: 'success' | 'error' | 'info'
    } | null>>
    setCopiedPath: Dispatch<SetStateAction<boolean>>
    setInstalledIdes: Dispatch<SetStateAction<any[]>>
    setLoadingInstalledIdes: Dispatch<SetStateAction<boolean>>
    setOpeningIdeId: Dispatch<SetStateAction<string | null>>
}

export function useProjectDetailsChromeActions({
    decodedPath,
    navigate,
    projectPath,
    projectRootPath,
    toast,
    setToast,
    setCopiedPath,
    setInstalledIdes,
    setLoadingInstalledIdes,
    setOpeningIdeId
}: UseProjectDetailsChromeActionsParams) {
    const showToast = useCallback((
        message: string,
        actionLabel?: string,
        actionTo?: string,
        tone: 'success' | 'error' | 'info' = 'success'
    ) => {
        setToast({ message, visible: false, actionLabel, actionTo, tone })
        window.setTimeout(() => {
            setToast((prev) => prev ? { ...prev, visible: true } : prev)
        }, 10)
    }, [setToast])

    useEffect(() => {
        if (!toast?.visible) return
        const hideTimer = window.setTimeout(() => {
            setToast((prev) => prev ? { ...prev, visible: false } : prev)
        }, 2600)
        const removeTimer = window.setTimeout(() => {
            setToast(null)
        }, 3000)
        return () => {
            window.clearTimeout(hideTimer)
            window.clearTimeout(removeTimer)
        }
    }, [toast?.visible, setToast])

    const loadInstalledIdes = useCallback(async () => {
        setLoadingInstalledIdes(true)
        try {
            const result = await window.devscope.listInstalledIdes()
            if (result.success) {
                setInstalledIdes(result.ides)
                return
            }
            setInstalledIdes([])
        } catch (err) {
            console.error('Failed to load installed IDEs:', err)
            setInstalledIdes([])
        } finally {
            setLoadingInstalledIdes(false)
        }
    }, [setInstalledIdes, setLoadingInstalledIdes])

    useEffect(() => {
        if (!decodedPath) return
        trackRecentProject(decodedPath, 'project')
        void loadInstalledIdes()
    }, [decodedPath, loadInstalledIdes])

    const handleCopyPath = useCallback(async () => {
        if (!projectRootPath) return
        try {
            if (window.devscope.copyToClipboard) {
                await window.devscope.copyToClipboard(projectRootPath)
            } else {
                await navigator.clipboard.writeText(projectRootPath)
            }
            setCopiedPath(true)
            showToast('Copied project path')
            window.setTimeout(() => setCopiedPath(false), 2000)
        } catch (err) {
            console.error('Failed to copy path:', err)
            showToast('Failed to copy path to clipboard', undefined, undefined, 'error')
        }
    }, [projectRootPath, setCopiedPath, showToast])

    const handleOpenProjectInIde = useCallback(async (ideId: string) => {
        if (!projectRootPath) return

        setOpeningIdeId(ideId)
        try {
            const result = await window.devscope.openProjectInIde(projectRootPath, ideId)
            if (!result.success) {
                showToast(result.error || 'Failed to open project in IDE', undefined, undefined, 'error')
                return
            }
            showToast(`Opening in ${result.ide.name}`)
        } catch (err: any) {
            showToast(err?.message || 'Failed to open project in IDE', undefined, undefined, 'error')
        } finally {
            setOpeningIdeId(null)
        }
    }, [projectRootPath, setOpeningIdeId, showToast])

    const goBack = useCallback(() => {
        const parentPath = getParentFolderPath(projectPath || decodedPath)
        if (parentPath) {
            navigate(`/folder-browse/${encodeURIComponent(parentPath)}`)
            return
        }
        navigate('/projects')
    }, [decodedPath, navigate, projectPath])

    const formatRelTime = useCallback((ts?: number) => {
        if (!ts) return ''
        const days = Math.floor((Date.now() - ts) / 86400000)
        return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
    }, [])

    return {
        showToast,
        loadInstalledIdes,
        handleCopyPath,
        handleOpenProjectInIde,
        goBack,
        formatRelTime
    }
}
