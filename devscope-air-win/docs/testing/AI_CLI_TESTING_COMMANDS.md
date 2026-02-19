# AI CLI Tools - Quick Testing Commands

## ✅ Terminal is Working!
Your DevScope terminal successfully displayed the banner and ran the `gemini` command. Here are commands to test all AI tools:

---

## 🤖 AI Model Runtimes

### Ollama
```bash
# Check if installed
ollama --version

# List models
ollama list

# Start server (long-running)
ollama serve

# Run a model (interactive)
ollama run llama2

# Pull a model
ollama pull codellama
```

### LM Studio
```bash
# Check if installed (Windows)
where lmstudio

# LM Studio is typically GUI-based
# Launch from Start Menu or:
start lmstudio
```

### CUDA/GPU
```bash
# Check NVIDIA driver
nvidia-smi

# Check CUDA version
nvcc --version

# GPU details
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
```

---

## 🎯 AI Coding Assistants

### Gemini CLI (Already Working! ✅)
```bash
# Interactive mode
gemini

# With prompt
gemini --prompt "Explain async/await in JavaScript"

# Code generation
gemini --prompt "Write a Python function to sort a list"

# Help
gemini --help
```

### Claude Code
```bash
# Check if installed
claude --version

# Interactive mode
claude

# With prompt
claude "Help me debug this code"

# Help
claude --help
```

### GitHub Copilot CLI
```bash
# Check if installed
gh copilot --version

# Suggest shell command
gh copilot suggest "list all files recursively"

# Explain command
gh copilot explain "git rebase -i HEAD~3"

# Help
gh copilot --help
```

### Aider
```bash
# Check if installed
aider --version

# Start in current directory
aider

# With specific files
aider src/main.py

# List models
aider --list-models

# Help
aider --help
```

### Continue
```bash
# Check if installed
continue --version

# Start
continue

# Help
continue --help
```

### Open Interpreter
```bash
# Check if installed
interpreter --version

# Start interactive mode
interpreter

# Run specific command
interpreter --prompt "Create a Python script to analyze CSV"

# Help
interpreter --help
```

### ShellGPT
```bash
# Check if installed
sgpt --version

# Ask a question
sgpt "How to find large files in Linux"

# Generate shell command
sgpt --shell "compress all jpg files"

# Code generation
sgpt --code "Python function to read JSON"

# Help
sgpt --help
```

### Fabric
```bash
# Check if installed
fabric --version

# List patterns
fabric --list

# Extract wisdom from text
echo "Your text here" | fabric --pattern extract_wisdom

# Summarize
cat article.txt | fabric --pattern summarize

# Help
fabric --help
```

---

## 📦 Package Manager AI Tools

### NPM-based Tools
```bash
# Install Gemini CLI globally
npm install -g @google/gemini-cli

# Install ChatGPT CLI
npm install -g chatgpt

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Check installed global packages
npm list -g --depth=0
```

### Python-based Tools
```bash
# Install Aider
pip install aider-chat

# Install Open Interpreter
pip install open-interpreter

# Install ShellGPT
pip install shell-gpt

# Install Fabric
pipx install fabric-ai

# List installed packages
pip list | grep -i "aider\|interpreter\|shell-gpt\|fabric"
```

---

## 🧪 Testing Scenarios

### 1. Code Generation
```bash
# Gemini
gemini --prompt "Create a React component for a todo list"

# Claude
claude "Write a REST API endpoint in Node.js"

# Aider
aider --message "Add error handling to this function"
```

### 2. Code Explanation
```bash
# GitHub Copilot
gh copilot explain "docker-compose up -d"

# ShellGPT
sgpt "Explain what this command does: awk '{print $1}' file.txt"
```

### 3. Shell Commands
```bash
# GitHub Copilot
gh copilot suggest "find all Python files modified in last 7 days"

# ShellGPT
sgpt --shell "compress folder and upload to S3"
```

### 4. Interactive Coding
```bash
# Aider (best for multi-file edits)
cd your-project
aider

# Open Interpreter (can execute code)
interpreter

# Continue (IDE integration)
continue
```

### 5. Content Processing
```bash
# Fabric - Extract wisdom
cat article.md | fabric --pattern extract_wisdom

# Fabric - Summarize
curl https://example.com/article | fabric --pattern summarize

# Fabric - Create summary
fabric --pattern create_summary < input.txt
```

---

## 🚀 DevScope Terminal Features

### Long-Running Processes (Now Supported!)
```bash
# These will run in background properly:
npm run dev
yarn start
ollama serve
python manage.py runserver
webpack --watch
vite
next dev
```

### Multiple Terminal Sessions
1. Click "+" to create new terminal
2. Switch between sessions in sidebar
3. Each session maintains its own state
4. Sessions persist until closed

### Terminal Shortcuts
- **Ctrl+C**: Stop current process
- **Up/Down Arrow**: Command history
- **Tab**: Auto-complete (if supported by shell)
- **Ctrl+L** or `cls`/`clear`: Clear screen

---

## 📊 Expected Outputs

### ✅ Success Indicators
```bash
# Ollama
ollama version is 0.1.17

# Gemini
Gemini CLI v1.0.0

# Aider
Aider v0.20.0

# CUDA
CUDA Version: 12.2
```

### ⚠️ Not Installed
```bash
# Command not found
'ollama' is not recognized as an internal or external command

# Python package not found
No module named 'aider'

# NPM package not found
npm ERR! 404 Not Found
```

### 🔧 Installation Needed
If you see "not found" errors, install using:
```bash
# Windows Package Manager
winget install Ollama.Ollama

# NPM
npm install -g @google/gemini-cli

# Python
pip install aider-chat

# Chocolatey
choco install ollama
```

---

## 🎯 Quick Test Script

Run this to test multiple tools at once:

```bash
# PowerShell
echo "=== Testing AI CLI Tools ==="
echo ""
echo "Gemini:"
gemini --version
echo ""
echo "Ollama:"
ollama --version
echo ""
echo "GitHub Copilot:"
gh copilot --version
echo ""
echo "Aider:"
aider --version
echo ""
echo "CUDA:"
nvidia-smi --version
```

```bash
# CMD
echo === Testing AI CLI Tools ===
echo.
echo Gemini:
gemini --version
echo.
echo Ollama:
ollama --version
echo.
echo GitHub Copilot:
gh copilot --version
echo.
echo Aider:
aider --version
echo.
echo CUDA:
nvidia-smi --version
```

---

## 💡 Pro Tips

1. **Use `--help`** on any command to see all options
2. **Check versions** to ensure tools are up to date
3. **Set API keys** as environment variables:
   ```bash
   # PowerShell
   $env:ANTHROPIC_API_KEY="your-key"
   $env:OPENAI_API_KEY="your-key"
   $env:GOOGLE_API_KEY="your-key"
   
   # CMD
   set ANTHROPIC_API_KEY=your-key
   set OPENAI_API_KEY=your-key
   set GOOGLE_API_KEY=your-key
   ```

4. **Create aliases** for frequently used commands:
   ```bash
   # PowerShell profile
   Set-Alias -Name ai -Value gemini
   Set-Alias -Name code-help -Value aider
   ```

5. **Use project context**: Run AI tools from your project directory for better context awareness

---

## 🐛 Troubleshooting

### Command Not Found
- Check if tool is installed: `where <command>` (Windows) or `which <command>` (Linux/Mac)
- Verify PATH includes installation directory
- Restart terminal after installation

### API Key Issues
- Ensure environment variables are set
- Check key format and validity
- Some tools need keys in config files

### Permission Errors
- Run terminal as Administrator if needed
- Check file permissions
- Verify network access for API calls

### Slow Responses
- Check internet connection
- Verify API service status
- Try local models (Ollama) for faster responses

---

## 📚 Additional Resources

- **Ollama**: https://ollama.ai/docs
- **Gemini**: https://ai.google.dev/docs
- **Claude**: https://docs.anthropic.com
- **GitHub Copilot**: https://docs.github.com/copilot
- **Aider**: https://aider.chat/docs
- **Open Interpreter**: https://docs.openinterpreter.com
- **Fabric**: https://github.com/danielmiessler/fabric

---

## ✨ Your Terminal is Ready!

The DevScope terminal successfully displayed the banner and ran Gemini CLI. You can now:
- ✅ Run AI coding assistants
- ✅ Start dev servers in background
- ✅ Use multiple terminal sessions
- ✅ Execute long-running processes
- ✅ Access AI models and runtimes

Happy coding with AI! 🚀
