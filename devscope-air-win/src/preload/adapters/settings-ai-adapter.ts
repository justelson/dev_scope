import { ipcRenderer } from 'electron'

export function createSettingsAndAiAdapter() {
    return {
        exportData: (data: any) => ipcRenderer.invoke('devscope:exportData', data),
        setStartupSettings: (settings: { openAtLogin: boolean; openAsHidden: boolean }) =>
            ipcRenderer.invoke('devscope:setStartupSettings', settings),
        getStartupSettings: () => ipcRenderer.invoke('devscope:getStartupSettings'),
        getAiDebugLogs: (limit?: number) => ipcRenderer.invoke('devscope:getAiDebugLogs', limit),
        clearAiDebugLogs: () => ipcRenderer.invoke('devscope:clearAiDebugLogs'),
        testGroqConnection: (apiKey: string) => ipcRenderer.invoke('devscope:testGroqConnection', apiKey),
        testGeminiConnection: (apiKey: string) => ipcRenderer.invoke('devscope:testGeminiConnection', apiKey),
        generateCommitMessage: (provider: 'groq' | 'gemini', apiKey: string, diff: string) =>
            ipcRenderer.invoke('devscope:generateCommitMessage', provider, apiKey, diff)
    }
}
