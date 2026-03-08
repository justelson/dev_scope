import { app, dialog } from 'electron'
import log from 'electron-log'
import { clearAiDebugLogs, getAiDebugLogs } from '../../ai/ai-debug-log'
import { generateGeminiCommitMessage, testGeminiConnection } from '../../ai/gemini'
import { generateCommitMessage as generateGroqCommitMessage, testGroqConnection } from '../../ai/groq'

type CommitAIProvider = 'groq' | 'gemini'

export async function handleExportData(_event: Electron.IpcMainInvokeEvent, data: any) {
    log.info('IPC: exportData')

    try {
        const result = await dialog.showSaveDialog({
            title: 'Export DevScope Data',
            defaultPath: `devscope-export-${Date.now()}.json`,
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        })

        if (result.canceled || !result.filePath) {
            return { success: false, cancelled: true }
        }

        const { writeFile } = await import('fs/promises')
        await writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
        return { success: true, filePath: result.filePath }
    } catch (err: any) {
        log.error('Failed to export data:', err)
        return { success: false, error: err.message }
    }
}

export async function handleSetStartupSettings(_event: Electron.IpcMainInvokeEvent, settings: { openAtLogin: boolean; openAsHidden: boolean }) {
    log.info('IPC: setStartupSettings', settings)

    try {
        app.setLoginItemSettings({
            openAtLogin: settings.openAtLogin,
            openAsHidden: settings.openAsHidden
        })
        return { success: true }
    } catch (err: any) {
        log.error('Failed to set startup settings:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetStartupSettings() {
    log.info('IPC: getStartupSettings')

    try {
        const startupSettings = app.getLoginItemSettings()
        return {
            success: true,
            settings: {
                openAtLogin: startupSettings.openAtLogin,
                openAsHidden: startupSettings.openAsHidden
            }
        }
    } catch (err: any) {
        log.error('Failed to get startup settings:', err)
        return { success: false, error: err.message }
    }
}

export async function handleTestGroqConnection(_event: Electron.IpcMainInvokeEvent, apiKey: string) {
    log.info('IPC: testGroqConnection')
    return await testGroqConnection(apiKey)
}

export async function handleTestGeminiConnection(_event: Electron.IpcMainInvokeEvent, apiKey: string) {
    log.info('IPC: testGeminiConnection')
    return await testGeminiConnection(apiKey)
}

export async function handleGenerateCommitMessage(
    _event: Electron.IpcMainInvokeEvent,
    provider: CommitAIProvider,
    apiKey: string,
    diff: string
) {
    log.info('IPC: generateCommitMessage', { provider })

    if (provider === 'groq') {
        return await generateGroqCommitMessage(apiKey, diff)
    }

    return await generateGeminiCommitMessage(apiKey, diff)
}

export async function handleGetAiDebugLogs(_event: Electron.IpcMainInvokeEvent, limit?: number) {
    log.info('IPC: getAiDebugLogs', { limit })
    try {
        const logs = await getAiDebugLogs(limit)
        return { success: true, logs }
    } catch (err: any) {
        log.error('Failed to get AI debug logs:', err)
        return { success: false, error: err.message }
    }
}

export async function handleClearAiDebugLogs() {
    log.info('IPC: clearAiDebugLogs')
    try {
        await clearAiDebugLogs()
        return { success: true }
    } catch (err: any) {
        log.error('Failed to clear AI debug logs:', err)
        return { success: false, error: err.message }
    }
}
