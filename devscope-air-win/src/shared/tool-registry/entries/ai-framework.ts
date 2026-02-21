import type { ToolDefinition } from '../types'

export const AI_FRAMEWORK_TOOLS: ToolDefinition[] = [
    {
            id: 'tensorflow',
            command: 'python',
            displayName: 'TensorFlow',
            description: 'TensorFlow is an end-to-end open source platform for machine learning. It has a comprehensive, flexible ecosystem of tools, libraries, and community resources that lets researchers push the state-of-the-art in ML.',
            themeColor: '#FF6F00',
            website: 'https://www.tensorflow.org',
            docsUrl: 'https://www.tensorflow.org/api_docs',
            category: 'ai_framework',
            usedFor: ['ai', 'ml', 'deep-learning', 'production'],
            capabilities: ['Tensors', 'Keras', 'Neural Networks', 'Edge AI'],
            detection: { strategy: 'custom', customDetector: 'tensorflow' },
            installCommand: 'pip install tensorflow'
        }
]
