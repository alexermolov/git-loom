# PowerShell Script to Create a Test Git Repository
# with multiple branches, commits, and merge conflicts

param(
    [string]$RepoPath = ".\test-repo",
    [switch]$Force
)

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "=== Git Test Repository Generator ==="
Write-Host ""

# Check if repo exists
if (Test-Path $RepoPath) {
    if ($Force) {
        Write-ColorOutput Yellow "Removing existing repository at $RepoPath..."
        Remove-Item -Path $RepoPath -Recurse -Force
    } else {
        Write-ColorOutput Red "Repository already exists at $RepoPath"
        Write-Host "Use -Force to overwrite"
        exit 1
    }
}

# Create repo directory
Write-ColorOutput Cyan "Creating repository at $RepoPath..."
New-Item -ItemType Directory -Path $RepoPath -Force | Out-Null
Set-Location $RepoPath

# Initialize git repo
Write-ColorOutput Cyan "Initializing Git repository..."
git init
git config user.name "Test User"
git config user.email "test@example.com"

# Create initial commit on main branch
Write-ColorOutput Cyan "Creating initial commit..."
@"
# Test Project

This is a test repository for debugging Git applications.

## Features
- Multiple branches
- Various commits
- Merge conflicts
"@ | Out-File -FilePath "README.md" -Encoding UTF8

@"
# Build artifacts
/dist
/build
/node_modules

# IDE
.vscode
.idea

# OS
.DS_Store
Thumbs.db
"@ | Out-File -FilePath ".gitignore" -Encoding UTF8

git add .
git commit -m "Initial commit: Add README and .gitignore"

# Create main source file
Write-ColorOutput Cyan "Creating source files..."
@"
// Main application file
const config = {
    version: '1.0.0',
    name: 'Test App',
    port: 3000
};

function main() {
    console.log('Application started');
    console.log('Version:', config.version);
}

main();
"@ | Out-File -FilePath "app.js" -Encoding UTF8

git add app.js
git commit -m "Add main application file"

@"
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f0f0f0;
}

h1 {
    color: #333;
}
"@ | Out-File -FilePath "styles.css" -Encoding UTF8

git add styles.css
git commit -m "Add basic styles"

# Create feature/user-authentication branch
Write-ColorOutput Cyan "Creating branch: feature/user-authentication..."
git checkout -b feature/user-authentication

@"
// User authentication module
class AuthService {
    constructor() {
        this.users = [];
    }

    login(username, password) {
        console.log('Attempting login for:', username);
        return true;
    }

    logout() {
        console.log('User logged out');
    }
}

module.exports = AuthService;
"@ | Out-File -FilePath "auth.js" -Encoding UTF8

git add auth.js
git commit -m "feat: Add authentication service"

# Update app.js in feature branch (will cause conflict later)
@"
// Main application file
const config = {
    version: '1.1.0',
    name: 'Test App with Auth',
    port: 3000,
    authEnabled: true
};

function main() {
    console.log('Application started with authentication');
    console.log('Version:', config.version);
    console.log('Auth enabled:', config.authEnabled);
}

main();
"@ | Out-File -FilePath "app.js" -Encoding UTF8

git add app.js
git commit -m "feat: Integrate authentication into main app"

# Add more commits to feature branch
@"
// User authentication module
class AuthService {
    constructor() {
        this.users = [];
        this.currentUser = null;
    }

    login(username, password) {
        console.log('Attempting login for:', username);
        // Add validation logic
        this.currentUser = username;
        return true;
    }

    logout() {
        console.log('User logged out:', this.currentUser);
        this.currentUser = null;
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }
}

module.exports = AuthService;
"@ | Out-File -FilePath "auth.js" -Encoding UTF8

git add auth.js
git commit -m "feat: Add user state tracking to auth service"

# Create feature/ui-improvements branch
Write-ColorOutput Cyan "Creating branch: feature/ui-improvements..."
git checkout main
git checkout -b feature/ui-improvements

@"
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

h1 {
    color: white;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
}
"@ | Out-File -FilePath "styles.css" -Encoding UTF8

git add styles.css
git commit -m "style: Improve UI with modern design"

# Update app.js in ui branch (will also cause conflict)
@"
// Main application file
const config = {
    version: '1.2.0',
    name: 'Test App - Modern UI',
    port: 3000,
    theme: 'dark'
};

function main() {
    console.log('Application started with modern UI');
    console.log('Version:', config.version);
    console.log('Theme:', config.theme);
    initUI();
}

function initUI() {
    console.log('Initializing UI components...');
}

main();
"@ | Out-File -FilePath "app.js" -Encoding UTF8

git add app.js
git commit -m "feat: Add UI initialization"

@"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to Test App</h1>
        <p>Modern UI Design</p>
    </div>
    <script src="app.js"></script>
</body>
</html>
"@ | Out-File -FilePath "index.html" -Encoding UTF8

git add index.html
git commit -m "feat: Add HTML template"

# Create bugfix/fix-memory-leak branch
Write-ColorOutput Cyan "Creating branch: bugfix/fix-memory-leak..."
git checkout main
git checkout -b bugfix/fix-memory-leak

@"
// Main application file
const config = {
    version: '1.0.1',
    name: 'Test App',
    port: 3000
};

function main() {
    console.log('Application started');
    console.log('Version:', config.version);
    cleanup();
}

function cleanup() {
    // Fix memory leak by clearing intervals
    console.log('Cleaning up resources...');
}

main();
"@ | Out-File -FilePath "app.js" -Encoding UTF8

git add app.js
git commit -m "fix: Fix memory leak in main loop"

@"
# Test Project

This is a test repository for debugging Git applications.

## Features
- Multiple branches
- Various commits
- Merge conflicts

## Bug Fixes
- Fixed memory leak in v1.0.1
"@ | Out-File -FilePath "README.md" -Encoding UTF8

git add README.md
git commit -m "docs: Update README with bug fix notes"

# Create hotfix/security-patch branch
Write-ColorOutput Cyan "Creating branch: hotfix/security-patch..."
git checkout main
git checkout -b hotfix/security-patch

@"
// Security configuration
const security = {
    enabled: true,
    csrfProtection: true,
    xssProtection: true,
    httpsOnly: true
};

module.exports = security;
"@ | Out-File -FilePath "security.js" -Encoding UTF8

git add security.js
git commit -m "security: Add security configuration"

# Create experimental/new-api branch
Write-ColorOutput Cyan "Creating branch: experimental/new-api..."
git checkout main
git checkout -b experimental/new-api

@"
// API Routes
const express = require('express');
const router = express.Router();

router.get('/api/users', (req, res) => {
    res.json({ users: [] });
});

router.post('/api/users', (req, res) => {
    res.json({ success: true });
});

module.exports = router;
"@ | Out-File -FilePath "api.js" -Encoding UTF8

git add api.js
git commit -m "feat: Add REST API endpoints"

@"
{
    "name": "test-app",
    "version": "2.0.0",
    "description": "Test application with new API",
    "main": "app.js",
    "scripts": {
        "start": "node app.js",
        "test": "echo \"No tests yet\""
    }
}
"@ | Out-File -FilePath "package.json" -Encoding UTF8

git add package.json
git commit -m "feat: Add package.json for new API"

# Create some tags
Write-ColorOutput Cyan "Creating tags..."
git checkout main
git tag -a v1.0.0 -m "Release version 1.0.0"
git tag -a v1.0.1 -m "Patch release 1.0.1"

# Go back to main and make conflicting changes
Write-ColorOutput Cyan "Creating conflicting changes on main branch..."
git checkout main

@"
// Main application file - Production version
const config = {
    version: '1.5.0',
    name: 'Test App - Production',
    port: 8080,
    environment: 'production'
};

function main() {
    console.log('Production application started');
    console.log('Version:', config.version);
    console.log('Environment:', config.environment);
    console.log('Port:', config.port);
}

main();
"@ | Out-File -FilePath "app.js" -Encoding UTF8

git add app.js
git commit -m "chore: Update to production configuration"

@"
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #ffffff;
}

h1 {
    color: #0066cc;
    font-size: 2em;
}

.alert {
    padding: 10px;
    background-color: #ff6b6b;
    color: white;
}
"@ | Out-File -FilePath "styles.css" -Encoding UTF8

git add styles.css
git commit -m "style: Update production styles"

# Create develop branch
Write-ColorOutput Cyan "Creating develop branch..."
git checkout -b develop

# Merge some branches into develop (some will have conflicts)
Write-ColorOutput Cyan "Merging hotfix/security-patch into develop..."
git merge hotfix/security-patch --no-edit

# Try to create a stash
Write-ColorOutput Cyan "Creating stash entry..."
@"
// Temporary work in progress
const temp = 'This is temporary code';
console.log(temp);
"@ | Out-File -FilePath "temp.js" -Encoding UTF8

git add temp.js
git stash save "WIP: Temporary experimental code"

# Add more commits to develop
@"
# Test Project

This is a test repository for debugging Git applications.

## Features
- Multiple branches
- Various commits  
- Merge conflicts
- Stash entries
- Tags

## Branches
- main: Production branch
- develop: Development branch
- feature/*: Feature branches
- bugfix/*: Bug fix branches
- hotfix/*: Hot fix branches
"@ | Out-File -FilePath "README.md" -Encoding UTF8

git add README.md
git commit -m "docs: Update README with branch information"

# Go back to main
git checkout main

Write-ColorOutput Green ""
Write-ColorOutput Green "=== Repository created successfully! ==="
Write-Host ""
Write-ColorOutput Cyan "Repository location: $RepoPath"
Write-Host ""
Write-ColorOutput Yellow "Available branches:"
git branch -a
Write-Host ""
Write-ColorOutput Yellow "Tags:"
git tag
Write-Host ""
Write-ColorOutput Yellow "To test merge conflicts, try:"
Write-ColorOutput White "  git merge feature/user-authentication"
Write-ColorOutput White "  git merge feature/ui-improvements"
Write-Host ""
Write-ColorOutput Green "Happy debugging!"
