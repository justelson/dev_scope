/**
 * DevScope - AI Runtime Inspector
 * ACCURATE DETECTION - Prioritizes correctness over speed
 * Performs thorough checks for each runtime, GPU, and framework
 */

import log from 'electron-log'
import { safeExec, commandExists, getCommandVersion } from '../safe-exec'
import type { AIRuntimeInfo, Capability } from '../types'

/**
 * Detect Ollama with comprehensive checks
 */
async function detectOllama(): Promise<AIRuntimeInfo> {
    const base = {
        tool: 'ollama',
        displayName: 'Ollama',
        category: 'ai_runtime' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['local-llm', 'inference'],
        description: 'Local LLM runtime. Install from ollama.com'
    }

    try {
        log.info('    → Checking if Ollama command exists...')
        const exists = await commandExists('ollama')
        if (!exists) {
            log.info('    ✗ Ollama command not found')
            return base
        }

        log.info('    → Getting Ollama version...')
        const version = await getCommandVersion('ollama', '--version')
        if (!version) {
            log.info('    ✗ Could not get Ollama version')
            return { ...base, installed: true, status: 'error', description: 'Installed but version check failed' }
        }

        log.info(`    ✓ Ollama v${version} found`)

        // Check if Ollama is running by trying to list models
        log.info('    → Checking if Ollama is running...')
        let running = false
        let models: string[] = []
        let port = 11434
        let endpoint = 'http://localhost:11434'

        try {
            const listResult = await safeExec('ollama', ['list'], { timeout: 5000 })
            if (listResult.stdout && !listResult.stderr.includes('connect')) {
                running = true
                // Parse model list
                const lines = listResult.stdout.split('\n').slice(1).filter(l => l.trim())
                models = lines.map(l => l.split(/\s+/)[0]).filter(Boolean).slice(0, 20)
                log.info(`    ✓ Ollama is running with ${models.length} models`)
            } else {
                log.info('    ✗ Ollama is not running')
            }
        } catch (err) {
            log.info('    ✗ Ollama is not running (connection failed)')
        }

        return {
            ...base,
            installed: true,
            version,
            status: running ? 'healthy' : 'warning',
            running,
            port,
            models,
            endpoint,
            description: running
                ? `Running with ${models.length} model${models.length !== 1 ? 's' : ''} available`
                : 'Installed but not running. Start with: ollama serve'
        }
    } catch (err) {
        log.error('    ✗ Ollama detection error:', err)
        return base
    }
}

/**
 * Detect LM Studio with thorough checks
 */
async function detectLMStudio(): Promise<AIRuntimeInfo> {
    const base = {
        tool: 'lmstudio',
        displayName: 'LM Studio',
        category: 'ai_runtime' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['local-llm', 'inference'],
        description: 'Not installed. Download from lmstudio.ai'
    }

    try {
        log.info('    → Checking for LM Studio installation...')
        let installed = false

        // Check Windows installation
        if (process.platform === 'win32') {
            const { existsSync } = await import('fs')
            const { join } = await import('path')
            const localAppData = process.env.LOCALAPPDATA || ''
            const lmStudioPath = join(localAppData, 'Programs', 'LM Studio')
            installed = existsSync(lmStudioPath)
            if (installed) {
                log.info(`    ✓ LM Studio found at ${lmStudioPath}`)
            }
        }

        // Check if server is running by attempting connection
        log.info('    → Checking if LM Studio server is running...')
        let running = false
        try {
            const testResult = await safeExec('curl', [
                '-s',
                '-o', 'nul',
                '-w', '%{http_code}',
                'http://localhost:1234/v1/models'
            ], { timeout: 3000 })
            
            if (testResult.stdout && testResult.stdout.includes('200')) {
                running = true
                installed = true // If server is running, it must be installed
                log.info('    ✓ LM Studio server is running')
            }
        } catch {
            log.info('    ✗ LM Studio server is not running')
        }

        if (!installed && !running) {
            log.info('    ✗ LM Studio not found')
            return base
        }

        return {
            ...base,
            installed,
            status: running ? 'healthy' : (installed ? 'warning' : 'not_installed'),
            running,
            port: 1234,
            endpoint: 'http://localhost:1234/v1',
            description: running
                ? 'Running and ready for inference'
                : (installed ? 'Installed but not running. Launch LM Studio to start server' : 'Not installed')
        }
    } catch (err) {
        log.error('    ✗ LM Studio detection error:', err)
        return base
    }
}

/**
 * Detect Jan.ai with thorough checks
 */
async function detectJan(): Promise<AIRuntimeInfo> {
    const base = {
        tool: 'jan',
        displayName: 'Jan',
        category: 'ai_runtime' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['local-llm', 'inference', 'open-source'],
        description: 'Open-source ChatGPT alternative'
    }

    try {
        log.info('    → Checking for Jan installation...')
        let installed = false

        // Check Windows installation
        if (process.platform === 'win32') {
            const { existsSync } = await import('fs')
            const { join } = await import('path')
            const localAppData = process.env.LOCALAPPDATA || ''
            const janPath = join(localAppData, 'Programs', 'jan')
            installed = existsSync(janPath)
            if (installed) {
                log.info(`    ✓ Jan found at ${janPath}`)
            }
        }

        // Check if Jan server is running (default port 1337)
        log.info('    → Checking if Jan server is running...')
        let running = false
        try {
            const testResult = await safeExec('curl', [
                '-s',
                '-o', 'nul',
                '-w', '%{http_code}',
                'http://localhost:1337/v1/models'
            ], { timeout: 3000 })
            
            if (testResult.stdout && testResult.stdout.includes('200')) {
                running = true
                installed = true
                log.info('    ✓ Jan server is running')
            }
        } catch {
            log.info('    ✗ Jan server is not running')
        }

        if (!installed && !running) {
            log.info('    ✗ Jan not found')
            return base
        }

        return {
            ...base,
            installed,
            status: running ? 'healthy' : (installed ? 'warning' : 'not_installed'),
            running,
            port: 1337,
            endpoint: 'http://localhost:1337/v1',
            description: running
                ? 'Running and ready'
                : (installed ? 'Installed but not running' : 'Not installed')
        }
    } catch (err) {
        log.error('    ✗ Jan detection error:', err)
        return base
    }
}

/**
 * Detect CUDA with comprehensive GPU information
 */
async function detectCUDA(): Promise<Capability> {
    const base = {
        tool: 'cuda',
        displayName: 'NVIDIA CUDA',
        category: 'gpu_acceleration' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['gpu', 'ai', 'ml'],
        description: 'GPU acceleration not available'
    }

    try {
        log.info('    → Checking for NVIDIA GPU...')
        
        // Try nvidia-smi first (most reliable)
        const nvidiaSmiExists = await commandExists('nvidia-smi')
        if (nvidiaSmiExists) {
            log.info('    → Getting GPU details from nvidia-smi...')
            try {
                const result = await safeExec('nvidia-smi', [
                    '--query-gpu=driver_version,name,memory.total,compute_cap',
                    '--format=csv,noheader'
                ], { timeout: 5000 })

                if (result.stdout) {
                    const parts = result.stdout.trim().split(',').map(s => s.trim())
                    if (parts.length >= 3) {
                        const [driverVersion, gpuName, vram, computeCap] = parts
                        log.info(`    ✓ Found ${gpuName} with ${vram} VRAM`)
                        
                        return {
                            ...base,
                            installed: true,
                            version: driverVersion,
                            status: 'healthy',
                            description: `${gpuName} • ${vram} VRAM • Driver ${driverVersion}${computeCap ? ` • Compute ${computeCap}` : ''}`
                        }
                    }
                }
            } catch (err) {
                log.debug('    nvidia-smi query failed, trying basic check')
            }

            // Fallback: just check if nvidia-smi runs
            try {
                const basicResult = await safeExec('nvidia-smi', [], { timeout: 5000 })
                if (basicResult.stdout) {
                    log.info('    ✓ NVIDIA GPU detected (basic check)')
                    return {
                        ...base,
                        installed: true,
                        version: 'Detected',
                        status: 'healthy',
                        description: 'NVIDIA GPU detected and working'
                    }
                }
            } catch {
                log.info('    ✗ nvidia-smi failed to run')
            }
        }

        // Try nvcc (CUDA compiler)
        log.info('    → Checking for CUDA toolkit (nvcc)...')
        const nvccExists = await commandExists('nvcc')
        if (nvccExists) {
            const version = await getCommandVersion('nvcc', '--version')
            if (version) {
                log.info(`    ✓ CUDA Toolkit v${version} found`)
                return {
                    ...base,
                    installed: true,
                    version,
                    status: 'healthy',
                    description: `CUDA Toolkit v${version} installed`
                }
            }
        }

        log.info('    ✗ No NVIDIA GPU or CUDA found')
        return base
    } catch (err) {
        log.error('    ✗ CUDA detection error:', err)
        return base
    }
}

/**
 * Detect ROCm (AMD GPU acceleration)
 */
async function detectROCm(): Promise<Capability> {
    const base = {
        tool: 'rocm',
        displayName: 'AMD ROCm',
        category: 'gpu_acceleration' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['gpu', 'ai', 'ml', 'amd'],
        description: 'AMD GPU acceleration not available'
    }

    try {
        log.info('    → Checking for AMD ROCm...')
        const exists = await commandExists('rocm-smi')
        if (exists) {
            try {
                const result = await safeExec('rocm-smi', ['--showproductname'], { timeout: 5000 })
                if (result.stdout) {
                    log.info('    ✓ AMD ROCm detected')
                    return {
                        ...base,
                        installed: true,
                        version: 'Detected',
                        status: 'healthy',
                        description: 'AMD ROCm GPU acceleration available'
                    }
                }
            } catch {
                log.info('    ✗ rocm-smi failed')
            }
        }

        log.info('    ✗ AMD ROCm not found')
        return base
    } catch (err) {
        log.error('    ✗ ROCm detection error:', err)
        return base
    }
}

/**
 * Detect PyTorch with thorough version check
 */
async function detectPyTorch(): Promise<Capability> {
    const base = {
        tool: 'pytorch',
        displayName: 'PyTorch',
        category: 'ai_framework' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'ml', 'deep-learning']
    }

    try {
        log.info('    → Checking for PyTorch...')
        const pipExists = await commandExists('pip')
        if (!pipExists) {
            log.info('    ✗ pip not found, cannot check PyTorch')
            return base
        }

        const result = await safeExec('pip', ['show', 'torch'], { timeout: 5000 })
        if (result.stdout && result.stdout.includes('Name: torch')) {
            const versionMatch = result.stdout.match(/Version: ([^\s]+)/)
            const version = versionMatch ? versionMatch[1] : 'Unknown'
            log.info(`    ✓ PyTorch v${version} found`)
            
            return {
                ...base,
                installed: true,
                version,
                status: 'healthy',
                description: `PyTorch v${version} installed`
            }
        }

        log.info('    ✗ PyTorch not found')
        return base
    } catch (err) {
        log.error('    ✗ PyTorch detection error:', err)
        return base
    }
}

/**
 * Detect TensorFlow with thorough version check
 */
async function detectTensorFlow(): Promise<Capability> {
    const base = {
        tool: 'tensorflow',
        displayName: 'TensorFlow',
        category: 'ai_framework' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'ml', 'deep-learning']
    }

    try {
        log.info('    → Checking for TensorFlow...')
        const pipExists = await commandExists('pip')
        if (!pipExists) {
            log.info('    ✗ pip not found, cannot check TensorFlow')
            return base
        }

        const result = await safeExec('pip', ['show', 'tensorflow'], { timeout: 5000 })
        if (result.stdout && result.stdout.includes('Name: tensorflow')) {
            const versionMatch = result.stdout.match(/Version: ([^\s]+)/)
            const version = versionMatch ? versionMatch[1] : 'Unknown'
            log.info(`    ✓ TensorFlow v${version} found`)
            
            return {
                ...base,
                installed: true,
                version,
                status: 'healthy',
                description: `TensorFlow v${version} installed`
            }
        }

        log.info('    ✗ TensorFlow not found')
        return base
    } catch (err) {
        log.error('    ✗ TensorFlow detection error:', err)
        return base
    }
}

/**
 * Get all AI runtime information with THOROUGH detection
 * NO CACHING - Always performs fresh, accurate checks
 */
export async function detectAIRuntimes(): Promise<{
    llmRuntimes: AIRuntimeInfo[]
    gpuAcceleration: Capability[]
    aiFrameworks: Capability[]
}> {
    log.info('🔍 Starting THOROUGH AI runtime detection (accuracy-first)...')
    const startTime = Date.now()

    // Detect LLM Runtimes sequentially for accuracy
    log.info('  📦 Detecting LLM Runtimes...')
    const ollama = await detectOllama()
    const lmstudio = await detectLMStudio()
    const jan = await detectJan()

    // Detect GPU Acceleration
    log.info('  ⚡ Detecting GPU Acceleration...')
    const cuda = await detectCUDA()
    const rocm = await detectROCm()

    // Detect AI Frameworks
    log.info('  🧠 Detecting AI Frameworks...')
    const pytorch = await detectPyTorch()
    const tensorflow = await detectTensorFlow()

    const duration = Date.now() - startTime
    const llmRuntimes = [ollama, lmstudio, jan]
    const gpuAcceleration = [cuda, rocm]
    const aiFrameworks = [pytorch, tensorflow]

    const runningCount = llmRuntimes.filter(r => r.running).length
    const installedGPU = gpuAcceleration.filter(g => g.installed).length
    const installedFrameworks = aiFrameworks.filter(f => f.installed).length

    log.info(`✅ AI runtime detection complete (${duration}ms):`)
    log.info(`   • LLM Runtimes: ${runningCount} running, ${llmRuntimes.filter(r => r.installed).length} installed`)
    log.info(`   • GPU Acceleration: ${installedGPU} available`)
    log.info(`   • AI Frameworks: ${installedFrameworks} installed`)

    return {
        llmRuntimes,
        gpuAcceleration,
        aiFrameworks
    }
}
