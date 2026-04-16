import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css'

type MonacoGlobal = typeof globalThis & {
    MonacoEnvironment?: {
        getWorker: (_moduleId: string, label: string) => Worker
    }
    __DEVSCOPE_MONACO_LOADER_READY__?: boolean
}

const globalWithMonaco = globalThis as MonacoGlobal

export function ensureMonacoRuntime() {
    if (!globalWithMonaco.MonacoEnvironment) {
        globalWithMonaco.MonacoEnvironment = {
            getWorker: (_moduleId: string, label: string) => {
                if (label === 'json') return new jsonWorker()
                if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
                if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
                if (label === 'typescript' || label === 'javascript') return new tsWorker()
                return new editorWorker()
            }
        }
    }

    if (!globalWithMonaco.__DEVSCOPE_MONACO_LOADER_READY__) {
        loader.config({ monaco })
        globalWithMonaco.__DEVSCOPE_MONACO_LOADER_READY__ = true
    }
}

ensureMonacoRuntime()

export { monaco }
