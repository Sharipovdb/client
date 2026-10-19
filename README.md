Welcome to your new TanStack Start app! 

# Getting Started

To run this application:

```bash
npm install
npm run dev
```

# Building For Production

To build this application for production:

```bash
npm run build
```

# Десктоп-приложение (Electron)

CrewMove также выпускается как Windows-приложение. Внутри exe лежит собранный фронтенд (`dist/`), а данные он берёт с того же бэкенда на Railway, что и сайт. Веб-сборка (`npm run dev`, `npm run build`) и деплой сайта на Railway от этого не меняются.

## Как это устроено

| Файл | Назначение |
|---|---|
| `electron/main.cjs` | Основной процесс: окно, протокол `app://`, внешние ссылки, один экземпляр, логи |
| `electron/dist-protocol.cjs` | Отдаёт файлы из `dist/` с SPA-fallback на `index.html` и защитой от выхода за `dist` |
| `electron/updater.cjs` | Автообновление из GitHub Releases |
| `electron/menu.cjs` | Меню: Правка, Вид, Справка → «Проверить обновления…», «Открыть папку логов», «О программе» |
| `package.json` → `build` | Настройки electron-builder (NSIS x64, публикация в `Sharipovdb/client`) |
| `.github/workflows/release.yml` | Сборка и публикация релиза |

- Фронтенд открывается по адресу `app://crewmove/`, а не `file://`. Поэтому `base` в Vite менять не нужно, F5 на вложенной странице работает, а запросы к API приходят с Origin `app://crewmove`. **Этот Origin должен быть в `CORS_ORIGINS` у бэкенда на Railway**, иначе приложение не сможет войти.
- Если приложение запущено не из установщика (`electron:dev`), оно открывает `http://localhost:3000`, а автообновление выключено.
- Файлы `electron/*.cjs` написаны на CommonJS, потому что в `package.json` указано `"type": "module"`.

## Локальный запуск

```bash
npm run electron:dev    # vite dev + окно Electron с hot reload
npm run electron:pack   # сборка в release/win-unpacked/CrewMove.exe без установщика
npm run electron:dist   # установщик release/CrewMove-Setup-<версия>.exe
```

`electron:pack` и `electron:dist` встраивают адрес API в момент сборки. Без `VITE_API_BASE_URL` приложение будет ходить на `http://localhost:8080`. В PowerShell:

```powershell
$env:VITE_API_BASE_URL = "https://server-production-c599.up.railway.app"; npm run electron:pack
```

Если Electron падает с `Cannot read properties of undefined (reading 'isPackaged')`, в окружении задана переменная `ELECTRON_RUN_AS_NODE`. Так бывает в терминалах, запущенных из некоторых расширений VS Code. Удалите её: `Remove-Item Env:ELECTRON_RUN_AS_NODE`.

## Как выходит релиз

1. PR в `main`: GitHub Actions только **собирает** установщик. Если сборка сломана, это видно в PR.
2. Merge в `main`: job `build` собирает установщик версии `0.1.<номер запуска>`, а job `publish` создаёт релиз `v0.1.N` в [Releases](https://github.com/Sharipovdb/client/releases) с файлами `CrewMove-Setup-0.1.N.exe`, `.blockmap` и `latest.yml`. Релиз сначала создаётся черновиком и публикуется только после загрузки всех файлов.
3. Установленные приложения проверяют обновления при запуске и затем каждые 4 часа. Новая версия скачивается в фоне, после чего появляется окно «Доступна новая версия X.Y.Z» с кнопками «Перезапустить» и «Позже». При «Позже» обновление установится при выходе из приложения.

Изменения, попавшие в `main`, сами доходят до всех пользователей, поэтому мержить в `main` можно только проверенный код.

Что нужно в настройках репозитория:
- Variable `VITE_API_BASE_URL` (Settings → Secrets and variables → Actions → Variables) — адрес бэкенда. Если она пустая, сборка падает.
- Токен не нужен: репозиторий публичный, и релиз публикуется встроенным `GITHUB_TOKEN`.
- Чтобы публиковать релизы только после ручного подтверждения, создайте environment с Required reviewers (Settings → Environments) и раскомментируйте `environment:` в job `publish`.

## Установка у пользователя

- Установщик не подписан, поэтому при первом запуске Windows SmartScreen покажет «Windows защитила ваш компьютер». Нужно нажать «Подробнее» → «Выполнить в любом случае». Обновления ставятся уже без этого предупреждения.
- По умолчанию приложение ставится для текущего пользователя в `%LOCALAPPDATA%\Programs\CrewMove`, права администратора не нужны.

## Логи

- Файл лога: `%APPDATA%\CrewMove\logs\main.log`. Туда пишутся запуск, загрузка страниц, ошибки и вся работа автообновления.
- Открыть папку с логом можно в самом приложении: «Справка → Открыть папку логов». Путь также виден в «Справка → О программе».
- Ошибки автообновления пользователю не показываются, только пишутся в лог. Исключение — ручная проверка «Справка → Проверить обновления…».

## Если вышла плохая версия

- **Основной путь — выпустить исправление.** Сделайте revert или fix, откройте PR и смержите его. Новая версия получит больший номер, и приложения обновятся на неё сами. Откатиться на более старую версию автообновление не умеет.
- **Чтобы плохую версию не получили те, кто ещё не обновился,** удалите этот релиз в GitHub (Releases → релиз → Delete) вместе с тегом. Приложения снова будут видеть последним предыдущий релиз. Тем, кто уже обновился, это не поможет: им нужно исправление (см. выше) или ручная установка нужного `CrewMove-Setup-*.exe` из Releases.

## Решения, которые стоит сохранить

- Библиотеки фронтенда лежат в `devDependencies`. electron-builder кладёт в exe всё из `dependencies`, а Vite уже собрал фронтенд в `dist/`. Поэтому в `dependencies` только то, что нужно основному процессу: `electron-updater` и `electron-log`. Новые фронтенд-пакеты ставьте через `npm install -D`.
- Версия `wait-on` зафиксирована на 9.1.0: более новые требуют `axios ^1.20` и подняли бы axios сайта.
- Сайт на Railway собирается через Railpack как статический Vite-сайт (Caddy). Поле `"main"` в `package.json` на это не влияет. Не добавляйте скрипт `start`: тогда Railpack перестанет раздавать статику.
- Иконки пока нет: `public/logo512.png` — это логотип React из шаблона. Нужен квадратный PNG от 512×512.

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
npm run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Uninstall the packages: `npm install @tailwindcss/vite tailwindcss -D`

## Linting & Formatting


This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
npm run lint
npm run format
npm run check
```



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
