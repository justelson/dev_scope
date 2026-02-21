import type { ToolDefinition } from '../types'

export const BUILD_TOOL_TOOLS: ToolDefinition[] = [
    {
            id: 'cmake',
            command: 'cmake',
            displayName: 'CMake',
            description: 'CMake is an open-source, cross-platform family of tools designed to build, test and package software. It is used to control the software compilation process using simple platform and compiler independent configuration files.',
            themeColor: '#064F8C',
            website: 'https://cmake.org',
            docsUrl: 'https://cmake.org/documentation/',
            category: 'build_tool',
            usedFor: ['c++', 'native', 'build-system'],
            installCommand: 'winget install Kitware.CMake'
        },

    {
            id: 'make',
            command: 'make',
            displayName: 'Make',
            description: 'GNU Make is a tool which controls the generation of executables and other non-source files of a program from the program\'s source files. It is the gold standard for build automation in Unix-like environments.',
            themeColor: '#000000',
            website: 'https://www.gnu.org/software/make/',
            docsUrl: 'https://www.gnu.org/software/make/manual/',
            category: 'build_tool',
            usedFor: ['c', 'c++', 'native', 'automation'],
            installCommand: 'winget install GnuWin32.Make',
            detection: { strategy: 'cli' }
        },

    {
            id: 'gradle',
            command: 'gradle',
            displayName: 'Gradle',
            description: 'Gradle is a build automation tool for multi-language software development. It controls the development process in the tasks of compilation and packaging to testing, deployment, and publishing. It is the official build tool for Android.',
            themeColor: '#02303A',
            website: 'https://gradle.org',
            docsUrl: 'https://docs.gradle.org/',
            category: 'build_tool',
            usedFor: ['java', 'android', 'kotlin', 'automation'],
            installCommand: 'winget install Gradle.Gradle',
            detection: { strategy: 'cli' }
        },

    {
            id: 'maven',
            command: 'mvn',
            displayName: 'Maven',
            description: 'Maven is a build automation tool used primarily for Java projects. It addresses two aspects of building software: how software is built, and its dependencies. It uses an XML file (pom.xml) to describe the software project being built.',
            themeColor: '#C71A36',
            website: 'https://maven.apache.org',
            docsUrl: 'https://maven.apache.org/guides/',
            category: 'build_tool',
            usedFor: ['java', 'dependency-management'],
            alternateCommands: ['maven'],
            installCommand: 'winget install Apache.Maven',
            detection: { strategy: 'cli' }
        },

    {
            id: 'msbuild',
            command: 'msbuild',
            displayName: 'MSBuild',
            description: 'MSBuild (Microsoft Build Engine) is a platform for building applications. It provides an XML schema for a project file that controls how the build platform processes and builds software. It is the build system for Visual Studio.',
            themeColor: '#9363D8',
            website: 'https://github.com/dotnet/msbuild',
            docsUrl: 'https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild',
            category: 'build_tool',
            usedFor: ['dotnet', 'windows', 'visual-studio'],
            installCommand: 'Included with Visual Studio or .NET SDK',
            detection: { strategy: 'cli' }
        }
]
