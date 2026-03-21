import { app } from 'electron'
import log from 'electron-log'
import { clearAiDebugLogs, getAiDebugLogs } from '../../ai/ai-debug-log'
import { generateGitCommitMessageWithProvider, testGitTextProviderConnection } from '../../ai/git-text'
import type { DevScopeGitTextProvider } from '../../../shared/contracts/devscope-git-contracts'

type CommitAIProvider = DevScopeGitTextProvider

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
    return await testGitTextProviderConnection({ provider: 'groq', apiKey })
}

export async function handleTestGeminiConnection(_event: Electron.IpcMainInvokeEvent, apiKey: string) {
    log.info('IPC: testGeminiConnection')
    return await testGitTextProviderConnection({ provider: 'gemini', apiKey })
}

export async function handleTestCodexConnection(_event: Electron.IpcMainInvokeEvent, model?: string) {
    log.info('IPC: testCodexConnection')
    return await testGitTextProviderConnection({ provider: 'codex', model })
}

export async function handleGenerateCommitMessage(
    _event: Electron.IpcMainInvokeEvent,
    provider: CommitAIProvider,
    apiKey: string,
    diff: string,
    model?: string
) {
    log.info('IPC: generateCommitMessage', { provider, model })
    return await generateGitCommitMessageWithProvider({ provider, apiKey, diff, model })
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
