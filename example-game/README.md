# Пример игры

Демоигра входит в pnpm workspace и использует локальную библиотеку через `workspace:*`.

Из корня репозитория:

```bash
pnpm install --frozen-lockfile
pnpm --filter example-game dev
pnpm --filter example-game build
```

Vite подключает исходники библиотеки напрямую: изменения видны без упаковки в `.tgz`.
