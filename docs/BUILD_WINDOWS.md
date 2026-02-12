# Building for Windows

This guide explains how to build the OpenAPI Mock Server application for Windows.

## Prerequisites

You need one of the following environments to build Windows apps:

### Option 1: Windows Machine (Recommended)
- Windows 10 or later
- Node.js 18+ installed
- Git installed

### Option 2: macOS with Wine (Alternative)
You can build Windows apps from macOS using Wine:
```bash
brew install wine
```

### Option 3: CI/CD (GitHub Actions)
Build automatically on every push to GitHub.

## Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Windows App

#### Build NSIS Installer (Recommended)
Creates a standard Windows installer (.exe):
```bash
npm run build:win
```

Output locations:
- `dist/OpenAPI Mock Server Setup 1.0.0.exe` - Windows installer
- `dist/OpenAPI Mock Server 1.0.0.exe` - Portable version

#### Build All Platforms
```bash
npm run build:all
```
This builds for both macOS and Windows.

## Build Targets

The Windows build creates two types of packages:

1. **NSIS Installer** (`target: "nsis"`)
   - Standard Windows installer
   - Installs to Program Files
   - Creates Start Menu shortcuts
   - Supports auto-updates
   - Both x64 (64-bit) and ia32 (32-bit) architectures

2. **Portable** (`target: "portable"`)
   - Single .exe file
   - No installation required
   - Run directly from USB or any folder
   - x64 only

## Configuration

Windows build settings are in `package.json`:

```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64", "ia32"]
    },
    {
      "target": "portable",
      "arch": ["x64"]
    }
  ]
}
```

### Customizing the Build

You can modify the build configuration in `package.json`:

- Change icon: Add `"icon": "build/icon.ico"` to win config
- Publisher info: Add `"publisherName": "Your Name"`
- Certificate signing: Add certificate configuration for code signing

## Distribution

After building, distribute these files:

1. **For Installation**: `OpenAPI Mock Server Setup 1.0.0.exe`
2. **For Portable Use**: `OpenAPI Mock Server 1.0.0.exe`

## Troubleshooting

### Build Fails on macOS
If building on macOS without Wine:
```bash
# Install Wine
brew install wine

# Then build
npm run build:win
```

### Wine Issues
If Wine fails, use GitHub Actions or build directly on Windows.

### Missing Dependencies
Ensure all npm packages are installed:
```bash
rm -rf node_modules
npm install
```

## GitHub Actions (Automated Builds)

Create `.github/workflows/build.yml` for automatic Windows builds:

```yaml
name: Build Windows App

on:
  push:
    branches: [ master ]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm install
    - run: npm run build:win
    - uses: actions/upload-artifact@v3
      with:
        name: windows-build
        path: dist/*.exe
```

This automatically builds Windows installers on every push to master.
