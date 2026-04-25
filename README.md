# codex

ChatGPT Codex Sandbox

## scripts/fetch-news.mjs

Обновляет `data/news.json` из внешнего JSON-источника новостей и делает перевод на русский язык через выбранный API-провайдер.

### Обязательные переменные окружения

- `NEWS_SOURCE_URL` — URL JSON-эндпоинта новостей.

### Опциональные переменные окружения

- `NEWS_SOURCE_TOKEN` — токен для источника новостей.
- `NEWS_SOURCE_TOKEN_HEADER` — заголовок для токена (по умолчанию `Authorization`).
- `NEWS_SOURCE_REGION` — регион по умолчанию (по умолчанию `global`).
- `TRANSLATOR_PROVIDER` — `openai`, `deepl`, `libretranslate` или `none` (по умолчанию `none`).
- `TRANSLATOR_TARGET_LANG` — язык перевода (по умолчанию `ru`).

#### OpenAI

- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL` (опционально, по умолчанию `gpt-4.1-mini`)

#### DeepL

- `DEEPL_API_KEY`
- `DEEPL_API_URL` (опционально)

#### LibreTranslate

- `LIBRETRANSLATE_URL` (опционально)
- `LIBRETRANSLATE_API_KEY` (опционально)

### Запуск

```bash
node scripts/fetch-news.mjs
```

В `data/news.json` сохраняются поля:

- `title_ru`
- `summary_ru`
- `region`
- `source_name`
- `source_url`
- `published_at`
- `translation_status`
