import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
    main: {
        plugins: [
            externalizeDepsPlugin({
                include: ['node-pty']
            }),
            viteStaticCopy({
                targets: [
                    {
                        src: 'src/main/inspectors/batch-check-tools.ps1',
                        dest: 'inspectors'
                    }
                ]
            })
        ],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/main/index.ts')
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
        root: resolve(__dirname, 'src/renderer'),
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/renderer/index.html')
                }
            }
        },
        plugins: [react()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src/renderer/src'),
                '@shared': resolve(__dirname, 'src/shared')
            }
        },
        server: {
            port: 5174
        }
    }
})
