# Jern Client

Electron-based Minecraft launcher. Offline + Microsoft login, all Mojang versions, Modrinth + CurseForge
(mods, resource packs, shaders, modpacks), custom game folder, install/uninstall, optional performance mode.

## Run in development
    npm install
    npm start

## Build the installers (must be done on Windows 10/11)
1. Install Node.js 20+ (the WiX tools for the .msi are downloaded automatically by electron-builder).
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

## Interface (v1.2)
Black + orange layout with a left rail, custom title bar (back/forward), Instances grid/list, instance pages
(Mods, Resource Packs, Shaders, Schematics, Worlds), Discover with filters + pagination, Accounts with skins and capes,
Logs and Settings. Fonts (Outfit, Inter, JetBrains Mono) are bundled in `renderer/fonts` under the SIL Open Font License.
Skin/cape changes use Mojang's API and only work for Microsoft accounts.

## Mod loaders
Vanilla, Fabric, Quilt, NeoForge and Forge (Minecraft 1.13+). Forge/NeoForge are installed with the official installer
the first time you launch an instance (it needs a few minutes and an internet connection), then reused.
Boost's FPS mods (Sodium etc.) are Fabric-only; the tuned Java flags apply to every loader.
Forge/NeoForge modpacks (.mrpack and CurseForge zips) now import too.

## Updating the launcher (installer upgrade, data is kept)
Run a newer `Jern-Client-Setup-x.y.z.exe` (or `.msi`) and choose the same install folder - it is pre-filled automatically.
- The installer shows a **Game data folder** page. If Jern Client data already exists it says so and keeps it as-is.
- Only the launcher's own files are replaced (the .exe, Electron files, `resources`, `locales`).
  Versions, instances, mods, worlds, skins and settings are never touched - they live in the data folder.
- Default data folder: `%APPDATA%\.jern` (outside the install folder). You can pick another one in the installer or in Settings.
  A data folder is never allowed to be the launcher's own folder; if you pick it, `JernData` inside it is used instead.
- Uninstalling keeps your data by default and asks first before offering to delete it.
- Settings > Game folder only changes where the launcher looks; it does not move existing files.
- The .msi upgrades in place the Windows-Installer way (replaces only its own files) and has no data-folder page.

## Publishing the installers on GitHub (no Windows PC needed)
The workflow in `.github/workflows/release.yml` builds `Jern-Client-Setup-x.y.z.exe` and `.msi` on a GitHub Windows
machine and attaches them (plus `SHA256SUMS.txt`) to a Release.

One-time setup
1. Create an empty repository on github.com (do not add a README there).
2. In this folder run:
       git init
       git add .
       git commit -m "Jern Client"
       git branch -M main
       git remote add origin https://github.com/<your-name>/<your-repo>.git
       git push -u origin main
3. On GitHub: Settings > Actions > General > Workflow permissions is fine as is (the workflow asks for `contents: write`).

Test build (no release): GitHub > Actions > "Build installers" > Run workflow. When it finishes, download the files from
the run's "Artifacts" section. Do this first - it is the quickest way to see whether the .msi builds.

Release a version
1. Set `"version"` in `package.json` (e.g. `1.3.1`), commit and push.
2. Tag it - the tag must be `v` + the same version:
       git tag v1.3.1
       git push origin v1.3.1
3. Wait ~5-10 minutes. The installers appear under GitHub > Releases. The build fails early with a clear message
   if the tag and `package.json` version do not match.

Updating: people download the newer installer from Releases and run it - your data folder is kept (see above).
Keep the repository private or public as you like; public repositories get free build minutes.

Code signing: not set up. Without a certificate Windows SmartScreen shows "unknown publisher". To add one later,
store the certificate as a repository secret and set `CSC_LINK` / `CSC_KEY_PASSWORD` in the workflow (remove
`CSC_IDENTITY_AUTO_DISCOVERY`).
