import { Check, ChevronDown, Edit3, Eye, Save, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { cn } from '@/lib/utils'

const MENU_ANIMATION_MS = 240

type PreviewHeaderEditMenuProps = {
    previewModeEnabled: boolean
    isEditable: boolean
    isEditMode: boolean
    isDirty: boolean
    isSaving: boolean
    loadingEditableContent?: boolean
    onModeChange: (mode: 'preview' | 'edit') => void
    onSave: () => void
    onRevert: () => void
}

export function PreviewHeaderEditMenu({
    previewModeEnabled,
    isEditable,
    isEditMode,
    isDirty,
    isSaving,
    loadingEditableContent,
    onModeChange,
    onSave,
    onRevert
}: PreviewHeaderEditMenuProps) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuVisible, setMenuVisible] = useState(false)
    const controlRef = useRef<HTMLDivElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const closeTimerRef = useRef<number | null>(null)

    const canSave = isEditable && isDirty && !isSaving
    const canRevert = isEditable && isDirty && !isSaving
    const canSwitchToEdit = isEditable && !loadingEditableContent
    const canToggleMode = previewModeEnabled && (isEditMode || canSwitchToEdit)
    const canOpenMenuFromPrimary = !previewModeEnabled

    const ActiveModeIcon = isEditMode ? Edit3 : Eye
    const activeModeLabel = isEditMode ? 'Edit' : 'Preview'
    const saveStatusLabel = isSaving ? 'Saving' : isDirty ? 'Unsaved' : 'Saved'
    const saveStatusClassName = isSaving
        ? 'text-sky-200/80'
        : isDirty
            ? 'text-amber-200/80'
            : 'text-emerald-200/80'

    const openMenu = () => {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
        }
        setMenuVisible(true)
        window.requestAnimationFrame(() => setMenuOpen(true))
    }

    const closeMenu = () => {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current)
        }
        setMenuOpen(false)
        closeTimerRef.current = window.setTimeout(() => {
            setMenuVisible(false)
            closeTimerRef.current = null
        }, MENU_ANIMATION_MS)
    }

    useEffect(() => {
        if (!menuVisible) return

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null
            if (menuRef.current?.contains(target) || controlRef.current?.contains(target)) return
            closeMenu()
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu()
        }

        document.addEventListener('pointerdown', handlePointerDown, true)
        window.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true)
            window.removeEventListener('keydown', handleEscape)
        }
    }, [menuVisible])

    useEffect(() => () => {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current)
        }
    }, [])

    const handlePrimaryAction = () => {
        if (!previewModeEnabled) {
            if (menuVisible && menuOpen) {
                closeMenu()
            } else {
                openMenu()
            }
            return
        }
        if (isEditMode) {
            onModeChange('preview')
            return
        }
        if (!canSwitchToEdit) return
        onModeChange('edit')
    }

    return (
        <div className="relative inline-flex" ref={controlRef}>
            <div
                className={cn(
                    'inline-flex overflow-hidden rounded-md border border-white/[0.07] bg-[#111927] transition-[border-color,background-color,box-shadow,border-radius] duration-200',
                    menuVisible && 'rounded-b-none border-b-transparent border-white/20 shadow-[0_10px_24px_rgba(0,0,0,0.16)]'
                )}
            >
                <button
                    type="button"
                    onClick={handlePrimaryAction}
                    disabled={!canToggleMode && !canOpenMenuFromPrimary}
                    className={cn(
                        'inline-flex h-6 min-w-[112px] items-center gap-1.5 px-2.5 text-[11px] transition-colors',
                        canToggleMode || canOpenMenuFromPrimary
                            ? 'text-white/84 hover:bg-white/[0.03] hover:text-white'
                            : 'cursor-not-allowed text-white/32'
                    )}
                    title={previewModeEnabled ? `Switch to ${isEditMode ? 'preview' : 'edit'} mode` : 'Edit actions'}
                >
                    <ActiveModeIcon size={12} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{activeModeLabel}</span>
                    {isDirty ? <span className="size-1.5 shrink-0 rounded-full bg-amber-300/85" aria-hidden="true" /> : null}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (menuVisible && menuOpen) {
                            closeMenu()
                            return
                        }
                        openMenu()
                    }}
                    className="inline-flex h-6 w-7 items-center justify-center border-l border-white/[0.08] text-white/48 transition-colors hover:bg-white/[0.03] hover:text-white"
                    title="Edit menu"
                    aria-label="Edit menu"
                    aria-haspopup="menu"
                    aria-expanded={menuVisible && menuOpen}
                >
                    <ChevronDown className={cn('size-3.5 transition-transform', menuVisible && menuOpen && 'rotate-180')} />
                </button>
            </div>

            {menuVisible ? (
                <div
                    ref={menuRef}
                    className={cn(
                        'absolute left-0 top-full z-[160] -mt-px w-full overflow-hidden',
                        menuVisible ? 'pointer-events-auto' : 'pointer-events-none'
                    )}
                >
                    <AnimatedHeight isOpen={menuOpen} duration={MENU_ANIMATION_MS}>
                        <div className="relative rounded-b-lg border border-white/[0.08] border-t-transparent bg-[#111927] p-1 shadow-2xl shadow-black/60">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.08]" />
                            {previewModeEnabled ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onModeChange('preview')
                                            closeMenu()
                                        }}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                                            !isEditMode
                                                ? 'bg-sky-500/14 text-sky-100'
                                                : 'text-white/72 hover:bg-white/[0.05] hover:text-white'
                                        )}
                                    >
                                        <Eye size={12} />
                                        <span className="min-w-0 flex-1 truncate">Preview</span>
                                        {!isEditMode ? <Check size={12} className="shrink-0" /> : null}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!canSwitchToEdit) return
                                            onModeChange('edit')
                                            closeMenu()
                                        }}
                                        disabled={!canSwitchToEdit}
                                        className={cn(
                                            'mt-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                                            isEditMode
                                                ? 'bg-sky-500/14 text-sky-100'
                                                : 'text-white/72 hover:bg-white/[0.05] hover:text-white',
                                            !canSwitchToEdit && 'cursor-not-allowed text-white/28 hover:bg-transparent hover:text-white/28'
                                        )}
                                    >
                                        <Edit3 size={12} />
                                        <span className="min-w-0 flex-1 truncate">Edit</span>
                                        {isEditMode ? <Check size={12} className="shrink-0" /> : null}
                                    </button>
                                    <div className="my-1 h-px bg-white/[0.07]" />
                                </>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => {
                                    if (!canSave) return
                                    onSave()
                                    closeMenu()
                                }}
                                disabled={!canSave}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                                    canSave
                                        ? 'text-white/78 hover:bg-white/[0.05] hover:text-white'
                                        : 'cursor-not-allowed text-white/28 hover:bg-transparent hover:text-white/28'
                                )}
                            >
                                <Save size={12} />
                                <span className="min-w-0 flex-1 truncate">{isSaving ? 'Saving...' : 'Save'}</span>
                                <span className={cn('shrink-0 text-[10px] uppercase tracking-[0.12em]', saveStatusClassName)}>
                                    {saveStatusLabel}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canRevert) return
                                    onRevert()
                                    closeMenu()
                                }}
                                disabled={!canRevert}
                                className={cn(
                                    'mt-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                                    canRevert
                                        ? 'text-white/78 hover:bg-white/[0.05] hover:text-white'
                                        : 'cursor-not-allowed text-white/28 hover:bg-transparent hover:text-white/28'
                                )}
                            >
                                <Undo2 size={12} />
                                <span className="min-w-0 flex-1 truncate">Revert</span>
                            </button>
                        </div>
                    </AnimatedHeight>
                </div>
            ) : null}
        </div>
    )
}
