# CrewMove frontend

React 19 + Vite + TanStack Router/Query. The same build ships as a website (Railway) and as a Windows desktop app (Electron, see «Десктоп-приложение» in README.md).

## Rules

- **Every merge into `main` reaches users automatically.** `.github/workflows/release.yml` builds the installer, publishes a GitHub Release, and installed apps update themselves. Push to `main` also redeploys the website on Railway. So only checked code goes into `main`: work in a branch, open a PR, wait for the PR build to pass, and never push to `main` directly.
- An update cannot roll an installed app back. A bad release is fixed by releasing a fix with a higher version, not by deleting the release alone.
- Frontend packages go into `devDependencies` (`npm install -D`). `dependencies` holds only what the Electron main process needs at runtime (`electron-updater`, `electron-log`): electron-builder ships everything in `dependencies` inside the exe.
- CI runs `npm ci` with the newest npm that ships with Node 24, and newer npm versions validate the lockfile more strictly than older ones. After changing dependencies, check the lockfile with `npx -y npm@11 ci --ignore-scripts` in a clean copy of the repo before pushing.
- Do not add a `start` script to `package.json`: Railpack would stop serving the site as a static Vite build.
- Files in `electron/` are CommonJS (`.cjs`) because the package is `"type": "module"`. A missing runtime dependency there crashes the installed app on start, and a crashed app can no longer update itself, so run `npm run electron:pack` and launch `release/win-unpacked/CrewMove.exe` after changing `electron/` or `dependencies`.
- The desktop app calls the API from Origin `app://crewmove`. It must stay in the backend's `CORS_ORIGINS`.
