import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilePreviewModal } from '@/components/ui/FilePreviewModal'
import { ServerScriptRunModal } from './ServerScriptRunModal'

export interface ProjectDetailsTransientUiProps {
    [key: string]: any
}

export function ProjectDetailsTransientUi(props: ProjectDetailsTransientUiProps) {
    const {
        pendingScriptRun,
        scriptPortInput,
        setScriptPortInput,
        setScriptRunError,
        scriptExposeNetwork,
        setScriptExposeNetwork,
        scriptAdvancedOpen,
        setScriptAdvancedOpen,
        scriptExtraArgsInput,
        setScriptExtraArgsInput,
        scriptEnvInput,
        setScriptEnvInput,
        scriptRunError,
        scriptCommandPreview,
        scriptRunner,
        closeScriptRunModal,
        handleConfirmScriptRun,
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        closePreview,
        toast,
        navigate,
        setToast
    } = props

    return (
        <>
            <ServerScriptRunModal
                pendingScriptRun={pendingScriptRun}
                scriptPortInput={scriptPortInput}
                setScriptPortInput={(value) => {
                    setScriptPortInput(value)
                    setScriptRunError(null)
                }}
                scriptExposeNetwork={scriptExposeNetwork}
                setScriptExposeNetwork={(value) => {
                    setScriptExposeNetwork(value)
                    setScriptRunError(null)
                }}
                scriptAdvancedOpen={scriptAdvancedOpen}
                setScriptAdvancedOpen={setScriptAdvancedOpen}
                scriptExtraArgsInput={scriptExtraArgsInput}
                setScriptExtraArgsInput={(value) => {
                    setScriptExtraArgsInput(value)
                    setScriptRunError(null)
                }}
                scriptEnvInput={scriptEnvInput}
                setScriptEnvInput={(value) => {
                    setScriptEnvInput(value)
                    setScriptRunError(null)
                }}
                scriptRunError={scriptRunError}
                scriptCommandPreview={scriptCommandPreview}
                scriptRunner={scriptRunner}
                onClose={closeScriptRunModal}
                onConfirm={handleConfirmScriptRun}
            />

            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    content={previewContent}
                    loading={loadingPreview}
                    truncated={previewTruncated}
                    size={previewSize}
                    previewBytes={previewBytes}
                    onClose={closePreview}
                />
            )}

            {toast && (
                <div
                    className={cn(
                        'fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 shadow-lg backdrop-blur-md transition-all duration-300',
                        toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
                    )}
                >
                    <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-1">
                            <span>{toast.message}</span>
                            {toast.actionTo && toast.actionLabel && (
                                <button
                                    onClick={() => {
                                        navigate(toast.actionTo!)
                                        setToast(null)
                                    }}
                                    className="text-left text-xs font-medium text-amber-200 underline underline-offset-2 hover:text-amber-100 transition-colors"
                                >
                                    {toast.actionLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
