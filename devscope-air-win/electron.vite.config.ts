import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const rendererRoot = resolve(__dirname, 'src/renderer')

export default defineConfig({
    main: {
        plugins: [
            externalizeDepsPlugin({
                include: ['node-pty']
            })
        ],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/main/index.ts'),
                    'system-metrics-collector': resolve(__dirname, 'src/main/system-metrics/collector.ts')
                }
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/preload/index.ts')
                }
            }
        }
    },
    renderer: {
        root: rendererRoot,
        worker: {
            format: 'es'
        },
        build: {
            rollupOptions: {
                input: {
                    index: resolve(rendererRoot, 'index.html')
                }
            }
        },
        plugins: [react()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src/renderer/src'),
                '@shared': resolve(__dirname, 'src/shared'),
                react: resolve(__dirname, 'node_modules/react'),
                'react-dom': resolve(__dirname, 'node_modules/react-dom'),
                'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
                'react/jsx-dev-runtime': resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js')
            }
        },
        server: {
            port: 5174,
            fs: {
                allow: [
                    rendererRoot
                ]
            }
        }
    }
})

