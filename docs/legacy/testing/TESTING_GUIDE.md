# DevScope Terminal Testing Guide

## Quick Test Commands

### Basic Functionality Tests

#### 1. Version Checks (Should work in both PowerShell and CMD)
```bash
node --version
npm --version
python --version
git --version
```

#### 2. Directory Operations
```bash
# List current directory
dir
ls

# Show current path
pwd
cd

# Navigate
cd src
cd ..
```

#### 3. Package Manager Commands
```bash
# NPM
npm list --depth=0
npm config list

# Python
pip list
pip --version

# Git
git status
git log --oneline -5
```

### Advanced Tests

#### 4. Multi-line Output
```bash
# Should display full tree
npm list

# Should show all files recursively
dir /s /b

# Git log with details
git log --graph --oneline --all
```

#### 5. Error Handling
```bash
# These should show proper error messages
invalid-command
npm run nonexistent-script
python -c "raise Exception('Test error')"
```

#### 6. Environment Variables (PowerShell)
```powershell
# Display environment
$env:PATH
Get-ChildItem Env:

# Set and use variable
$test = "Hello"
Write-Output $test
```

#### 7. Environment Variables (CMD)
```cmd
# Display environment
echo %PATH%
set

# Set and use variable
set TEST=Hello
echo %TEST%
```

#### 8. UTF-8 and Special Characters
```bash
# Python with UTF-8
python -c "print('Hello 世界 🌍')"

# Echo special characters
echo "Testing: àéîôù ñ ü"
```

#### 9. Command Chaining (PowerShell)
```powershell
# Multiple commands
Write-Output "First"; Write-Output "Second"

# Conditional execution
Test-Path "package.json" -and (Write-Output "Found")

# Pipeline
Get-Process | Select-Object -First 5
```

#### 10. Command Chaining (CMD)
```cmd
# Multiple commands
echo First & echo Second

# Conditional execution
if exist package.json echo Found

# Pipe
dir | find "src"
```

### Project-Specific Tests

#### 11. Node.js Projects
```bash
# Install dependencies
npm install

# Run scripts
npm run dev
npm run build
npm test

# Check outdated packages
npm outdated
```

#### 12. Python Projects
```bash
# Create virtual environment
python -m venv venv

# Activate (PowerShell)
.\venv\Scripts\Activate.ps1

# Activate (CMD)
venv\Scripts\activate.bat

# Install requirements
pip install -r requirements.txt

# Run Python script
python main.py
```

#### 13. Git Operations
```bash
# Status and diff
git status
git diff

# Branch operations
git branch
git branch -a

# Log with graph
git log --graph --oneline --decorate --all

# Show specific commit
git show HEAD
```

### Performance Tests

#### 14. Large Output
```bash
# Should handle large output smoothly
npm list --all
dir /s C:\Windows\System32

# Long-running command
ping localhost -n 10
```

#### 15. Interactive Commands (Should work or show proper message)
```bash
# These might need special handling
npm init
python
node
```

## Expected Behaviors

### ✅ Should Work:
- All version checks
- Directory navigation
- File operations
- Package manager commands
- Git operations
- Environment variable access
- Command chaining
- Error messages display properly
- UTF-8 characters render correctly
- ANSI colors display
- Command history (up/down arrows)

### ⚠️ Known Limitations:
- Interactive prompts (npm init, python REPL) may not work in embedded terminal
- Very long-running processes should be run in external terminal
- Some GUI applications won't launch from embedded terminal

### ❌ Should Show Error:
- Invalid commands should display error message
- Missing dependencies should show clear error
- Syntax errors should be caught and displayed

## UI Verification Checklist

### Icons and Display:
- [ ] Project type icons display correctly (no broken images)
- [ ] Tool icons in DevTools page render properly
- [ ] AI Agent icons show correctly
- [ ] Terminal tab names don't show emoji boxes
- [ ] Health score shows "Perfect" text (not emoji)
- [ ] Git status indicators use proper icons
- [ ] Framework badges display correctly

### Terminal UI:
- [ ] Terminal opens and closes smoothly
- [ ] Multiple terminal sessions work
- [ ] Session switching is instant
- [ ] Output scrolls automatically
- [ ] Command history works (up/down arrows)
- [ ] Copy/paste works
- [ ] Terminal resizing works
- [ ] ANSI colors display correctly

### Project Details:
- [ ] Project icons display
- [ ] Framework badges show
- [ ] File tree icons render
- [ ] Git status colors work
- [ ] Action buttons have proper icons

## Troubleshooting

### If commands don't execute:
1. Check if the tool is installed: `where <command>`
2. Verify PATH environment variable
3. Try running in external terminal first
4. Check terminal output for error messages

### If output looks wrong:
1. Verify UTF-8 encoding is working
2. Check if ANSI colors are enabled
3. Try clearing terminal and re-running
4. Check console for JavaScript errors

### If icons don't display:
1. Check internet connection (Simple Icons CDN)
2. Verify browser console for 404 errors
3. Check if fallback Lucide icons appear
4. Clear browser cache and reload

## Performance Benchmarks

### Expected Response Times:
- Simple commands (version checks): < 100ms
- Directory listings: < 500ms
- Package manager operations: 1-5s
- Git operations: < 1s
- Large output commands: 2-10s

### Memory Usage:
- Idle terminal: ~50MB
- Active terminal with output: ~100-200MB
- Multiple terminals (3-5): ~300-500MB

## Reporting Issues

When reporting terminal issues, include:
1. Command that was run
2. Expected output
3. Actual output
4. Shell type (PowerShell or CMD)
5. Windows version
6. Node.js version
7. Screenshot if UI-related
8. Console errors if any
