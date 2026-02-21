import type { ToolDefinition } from '../types'

export const LANGUAGE_TOOLS: ToolDefinition[] = [
    {
            id: 'node',
            command: 'node',
            displayName: 'Node.js',
            description: 'Node.js is a powerful, asynchronous event-driven JavaScript runtime designed to build scalable network applications. It powers a vast ecosystem of server-side tools and libraries.',
            themeColor: '#339933',
            icon: 'nodedotjs',
            website: 'https://nodejs.org',
            docsUrl: 'https://nodejs.org/en/docs/',
            category: 'language',
            usedFor: ['web', 'backend', 'electron', 'scripting', 'api'],
            installCommand: 'winget install OpenJS.NodeJS.LTS',
            detection: { strategy: 'cli' }
        },

    {
            id: 'python',
            command: 'python',
            displayName: 'Python',
            description: 'Python is a high-level, interpreted programming language known for its easy-to-read syntax and versatility. It is a standard for data science, machine learning, and web development.',
            themeColor: '#3776AB',
            icon: 'python',
            website: 'https://www.python.org',
            docsUrl: 'https://docs.python.org/3/',
            category: 'language',
            usedFor: ['ai', 'ml', 'scripting', 'backend', 'data-science', 'automation'],
            alternateCommands: ['python3', 'py'],
            installCommand: 'winget install Python.Python.3.12'
        },

    {
            id: 'java',
            command: 'java',
            displayName: 'Java',
            description: 'Java is a class-based, object-oriented programming language designed to have as few implementation dependencies as possible. It is a workhorse for enterprise applications and Android development.',
            themeColor: '#007396',
            icon: 'openjdk',
            website: 'https://www.java.com',
            docsUrl: 'https://docs.oracle.com/en/java/',
            category: 'language',
            versionArg: '-version',
            usedFor: ['backend', 'android', 'enterprise', 'web'],
            installCommand: 'winget install Oracle.JDK.21'
        },

    {
            id: 'dotnet',
            command: 'dotnet',
            displayName: '.NET',
            description: '.NET is a free, cross-platform, open source developer platform for building many different types of applications. It supports multiple languages like C#, F#, and Visual Basic.',
            themeColor: '#512BD4',
            icon: 'dotnet',
            website: 'https://dotnet.microsoft.com',
            docsUrl: 'https://learn.microsoft.com/en-us/dotnet/',
            category: 'language',
            usedFor: ['backend', 'desktop', 'web', 'gaming', 'cloud', 'mobile'],
            installCommand: 'winget install Microsoft.DotNet.SDK.8'
        },

    {
            id: 'go',
            command: 'go',
            displayName: 'Go',
            description: 'Go is an open source programming language supported by Google. It is easy to learn and excellent for building high-performance, concurrent, and scalable network services.',
            themeColor: '#00ADD8',
            icon: 'go',
            website: 'https://go.dev',
            docsUrl: 'https://go.dev/doc/',
            category: 'language',
            versionArg: 'version',
            usedFor: ['backend', 'cli', 'cloud', 'microservices'],
            installCommand: 'winget install GoLang.Go'
        },

    {
            id: 'rust',
            command: 'rustc',
            displayName: 'Rust',
            description: 'Rust is a language empowering everyone to build reliable and efficient software. It guarantees memory safety and thread safety without a garbage collector.',
            themeColor: '#DEA584',
            icon: 'rust',
            website: 'https://www.rust-lang.org',
            docsUrl: 'https://doc.rust-lang.org/',
            category: 'language',
            usedFor: ['systems', 'cli', 'wasm', 'performance', 'embedded'],
            alternateCommands: ['rust'],
            installCommand: 'winget install Rustlang.Rustup'
        },

    {
            id: 'ruby',
            command: 'ruby',
            displayName: 'Ruby',
            description: 'Ruby is a dynamic, open source programming language with a focus on simplicity and productivity. It has an elegant syntax that is natural to read and easy to write, making it a favorite for web development (Rails) and scripting.',
            themeColor: '#CC342D',
            icon: 'ruby',
            website: 'https://www.ruby-lang.org',
            docsUrl: 'https://www.ruby-lang.org/en/documentation/',
            category: 'language',
            usedFor: ['web', 'scripting', 'devops', 'automation'],
            installCommand: 'winget install RubyInstallerTeam.Ruby.3.2'
        },

    {
            id: 'php',
            command: 'php',
            displayName: 'PHP',
            description: 'PHP is a popular general-purpose scripting language that is especially suited to web development. It is fast, flexible, and pragmatic, powering everything from your blog to the most popular websites in the world.',
            themeColor: '#777BB4',
            icon: 'php',
            website: 'https://www.php.net',
            docsUrl: 'https://www.php.net/docs.php',
            category: 'language',
            usedFor: ['web', 'backend', 'server-side'],
            installCommand: 'winget install PHP.PHP'
        }
]
