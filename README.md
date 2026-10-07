# Synaq MVP

Прод: https://synaq-pi.vercel.app (Vercel, проект `synaq` в команде stingersonx-s-projects, автодеплой из `main`).

Образовательная игра: ИИ-стажёр Алибек решает задачу по алгебре с заранее заложенной ошибкой (каталог: 18 задач 8-10 классов, 16 типов ошибок). Ученик находит строку, объясняет причину и доказывает ошибку контрпримером. Сдачу стажёра решает детерминированная проверка (mathjs), а не LLM.

## Запуск

```bash
npm install
cp .env.example .env.local   # все переменные необязательны
npm run dev
```

Без ключей игра полностью работает: шаблонные реплики, судья по ключевым словам, результаты в localStorage.

| Команда | Что делает |
|---|---|
| `npm run verify` | проверка каталога кейсов (падает при нарушении) |
| `npm test` | vitest |
| `npm run lint` / `npm run build` | линтер / сборка |

## Сценарий для сцены

- `/play?case=pct-01&offline=1` — один кейс без сети: строка 2 → объяснение → `20000` → Алибек сдаётся. `0` → «оба выражения равны».
- `/play?case=lin-ok&offline=1` — чистый кейс: «Ошибок нет» = победа.
- `/teacher/demo` — панель учителя на демо-данных (с плашкой «ДЕМО-ДАННЫЕ»).
- Кнопка «Запасной стажёр» мгновенно меняет задачу без сети.

## Переменные окружения

`ANTHROPIC_API_KEY`, `LLM_MODEL` (по умолчанию `claude-haiku-4-5-20251001`), `LLM_DISABLED=1` (шаблонный режим), `LLM_CALLS_PER_HOUR` (60), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (только сервер).

## Supabase

Рабочая база: проект `synaq` (ref `ydjlnbfrmccnrdkceftl`, регион eu-central-1, Франкфурт) в организации NagyzDoner. Миграция `supabase/migrations/0001_init.sql` уже применена. Серверные функции Vercel работают в том же регионе (`vercel.json` → `fra1`).

В Vercel нужны две переменные:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://ydjlnbfrmccnrdkceftl.supabase.co` (уже задана);
- `SUPABASE_SERVICE_ROLE_KEY` (задана): секретный ключ из Supabase → Project Settings → API Keys (`service_role` или `sb_secret_…`), тип Sensitive, только сервер.

Новая база с нуля: создать проект, выполнить `supabase/migrations/0001_init.sql` в SQL Editor и задать те же две переменные.

RLS включён на всех таблицах без политик, а у ролей `anon` и `authenticated` отозваны все права: доступ только через серверные route handlers с service-role ключом.

## Деплой на Vercel

Проект `synaq` подключён к GitHub-репозиторию `stingersonx228/synaq`: каждый push в `main` автоматически выкатывается на https://synaq-pi.vercel.app, push в другие ветки создаёт preview-деплой.

Ручной деплой из локальной папки (если нужно выкатить без коммита):

```bash
npx vercel deploy --prod --scope stingersonx-s-projects
```

Переменные окружения задаются в Vercel → Project → Settings → Environment Variables (список выше), после чего нужен повторный деплой.

## Известные ограничения

- Каталог с ответами лежит на клиенте, доказательство проверяется в браузере. Для тренажёра без ставок это приемлемо; рейтинг и дуэли потребуют серверной проверки.
- Без Supabase лимит LLM-вызовов считается в памяти процесса (на serverless — на инстанс).
- Объяснения учеников не сохраняются в БД и не логируются.
