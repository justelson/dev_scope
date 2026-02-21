import type { ToolDefinition } from '../types'

export const AI_RUNTIME_TOOLS: ToolDefinition[] = [
    {
            id: 'ollama',
            command: 'ollama',
            displayName: 'Ollama',
            description: 'Ollama is a lightweight framework for running large language models locally. It provides a simple API for creating, running, and managing LLMs, making it easy to run models like Llama, Mistral, and more on your own hardware.',
            themeColor: '#FFFFFF',
            website: 'https://ollama.ai',
            docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/README.md',
            category: 'ai_runtime',
            usedFor: ['local-llm', 'inference', 'ai', 'ml'],
            capabilities: ['Local Inference', 'Model Management', 'Open API'],
            detectRunning: true,
            installCommand: 'winget install Ollama.Ollama',
            detection: { strategy: 'process', processName: 'ollama' }
        },

    {
            id: 'lmstudio',
            command: 'lmstudio',
            displayName: 'LM Studio',
            description: 'LM Studio is a desktop application for discovering, downloading, and running local LLMs. It provides a user-friendly interface for managing models and includes an OpenAI-compatible API server.',
            themeColor: '#4A90D9',
            website: 'https://lmstudio.ai',
            docsUrl: 'https://lmstudio.ai/docs',
            category: 'ai_runtime',
            usedFor: ['local-llm', 'inference', 'ai', 'gui'],
            capabilities: ['GUI', 'Model Discovery', 'Local Inference'],
            detectRunning: true,
            installCommand: 'Download from https://lmstudio.ai',
            detection: { strategy: 'process', processName: 'LM Studio' }
        },

    {
            id: 'jan',
            command: 'jan',
            displayName: 'Jan',
            description: 'Jan is an open-source alternative to ChatGPT that runs 100% offline on your computer. It provides a clean, user-friendly interface for chatting with local LLMs.',
            themeColor: '#7C3AED',
            website: 'https://jan.ai',
            docsUrl: 'https://jan.ai/docs',
            category: 'ai_runtime',
            usedFor: ['local-llm', 'inference', 'ai', 'gui', 'offline'],
            capabilities: ['GUI', 'Offline AI', 'Private Chat'],
            detectRunning: true,
            installCommand: 'Download from https://jan.ai',
            detection: { strategy: 'process', processName: 'Jan' }
        },

    {
            id: 'gpt4all',
            command: 'gpt4all',
            displayName: 'GPT4All',
            description: 'GPT4All is an ecosystem of open-source chatbots that run locally on consumer grade CPUs and any GPU. It allows you to chat with models, use your own documents as private data, and more.',
            themeColor: '#000000',
            website: 'https://gpt4all.io',
            docsUrl: 'https://docs.gpt4all.io',
            category: 'ai_runtime',
            usedFor: ['local-llm', 'inference', 'ai', 'cpu-optimized'],
            capabilities: ['CPU Inference', 'Local Documents', 'Chat GUI'],
            installCommand: 'Download from https://gpt4all.io'
        },

    {
            id: 'open-webui',
            command: 'open-webui',
            displayName: 'Open WebUI',
            description: 'Open WebUI is an extensible, self-hosted interface for LLMs. It supports Ollama, OpenAI-compatible APIs, and more, providing a rich, ChatGPT-like experience with full control.',
            themeColor: '#3B82F6',
            website: 'https://openwebui.com',
            docsUrl: 'https://docs.openwebui.com',
            category: 'ai_runtime',
            usedFor: ['web-gui', 'self-hosted', 'ollama', 'frontend'],
            capabilities: ['Web Interface', 'Multi-Model Support', 'RAG Support'],
            installCommand: 'docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main'
        },

    {
            id: 'cuda',
            command: 'nvcc',
            displayName: 'NVIDIA CUDA',
            description: 'CUDA is a parallel computing platform and programming model developed by NVIDIA for general computing on GPUs. It enables dramatic increases in computing performance by harnessing the power of the GPU for AI and ML workloads.',
            themeColor: '#76B900',
            website: 'https://developer.nvidia.com/cuda-toolkit',
            docsUrl: 'https://docs.nvidia.com/cuda/',
            category: 'ai_runtime',
            usedFor: ['gpu', 'ai', 'ml', 'deep-learning', 'parallel-computing'],
            capabilities: ['GPU Acceleration', 'Parallel Computing', 'Deep Learning'],
            alternateCommands: ['nvidia-smi'],
            installCommand: 'Download from https://developer.nvidia.com/cuda-downloads'
        },

    {
            id: 'pytorch',
            command: 'python',
            displayName: 'PyTorch',
            description: 'PyTorch is an open source machine learning framework based on the Torch library. It provides tensor computation with strong GPU acceleration and deep neural networks built on a tape-based autograd system.',
            themeColor: '#EE4C2C',
            website: 'https://pytorch.org',
            docsUrl: 'https://pytorch.org/docs/stable/index.html',
            category: 'ai_runtime',
            usedFor: ['gpu', 'ai', 'ml', 'deep-learning'],
            capabilities: ['Model Training', 'Production ML', 'Data Pipeline'],
            detection: { strategy: 'cli', versionRegex: '(\\d+\\.\\d+\\.\\d+)' },
            installCommand: 'pip install torch torchvision torchaudio'
        },

    {
            id: 'vllm',
            command: 'vllm',
            displayName: 'vLLM',
            description: 'vLLM is a high-throughput and memory-efficient inference and serving engine for LLMs. It uses PagedAttention to efficiently manage attention key and value memory, delivering state-of-the-art serving performance.',
            themeColor: '#4C51BF',
            website: 'https://vllm.ai',
            docsUrl: 'https://docs.vllm.ai/',
            category: 'ai_runtime',
            usedFor: ['serving', 'inference', 'performance', 'gpu'],
            capabilities: ['High Throughput', 'PagedAttention', 'API Serving'],
            installCommand: 'pip install vllm'
        }
]
