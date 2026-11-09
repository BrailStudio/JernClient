# Jern Client

Electron-based Minecraft launcher. Offline + Microsoft login, all Mojang versions, Modrinth + CurseForge
(mods, resource packs, shaders, modpacks), custom game folder, install/uninstall, optional performance mode.

## Run in development
    npm install
    npm start

## Build the installers (must be done on Windows 10/11)
1. Install Node.js 20+ and the WiX Toolset v3 (needed for .msi): https://github.com/wixtoolset/wix3/releases
2. `npm install`
3. `npm run dist`
Output in `dist/`: `Jern-Client-Setup-1.0.0.exe` (NSIS) and `Jern-Client-Setup-1.0.0.msi`.

## Icon
Drop your `icon.ico` (256x256+) into the `build/` folder before running `npm run dist`. It is picked up automatically.

## Accounts
Microsoft (saved + auto-refreshed), Ely.by (uses authlib-injector so Ely skins work; 2FA: enter `password:CODE`), Offline.
Tokens are encrypted with the OS keystore.

## Notes
- Installer .exe: choose install folder; final page has a "Create a desktop shortcut" checkbox.
- Installer .msi: also lets you pick a folder; it always creates the desktop shortcut.
- CurseForge needs a free API key (Settings). Some CurseForge files block third-party downloads.
- Each instance has its own mods/saves. Modpacks create a new instance. Fabric and Quilt are supported; Forge/NeoForge are not yet.
