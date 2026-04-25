#!/usr/bin/env node

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEWS_SOURCE_URL = process.env.NEWS_SOURCE_URL;
const NEWS_SOURCE_TOKEN = process.env.NEWS_SOURCE_TOKEN;
const NEWS_SOURCE_TOKEN_HEADER = process.env.NEWS_SOURCE_TOKEN_HEADER || 'Authorization';
const NEWS_SOURCE_REGION = process.env.NEWS_SOURCE_REGION || 'global';

const TRANSLATOR_PROVIDER = (process.env.TRANSLATOR_PROVIDER || 'none').toLowerCase();
const TRANSLATOR_TARGET_LANG = process.env.TRANSLATOR_TARGET_LANG || 'ru';

function ensureEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function buildNewsSourceHeaders() {
  const headers = { Accept: 'application/json' };

  if (NEWS_SOURCE_TOKEN) {
    headers[NEWS_SOURCE_TOKEN_HEADER] = NEWS_SOURCE_TOKEN;
  }

  return headers;
}

function normalizeArticles(payload) {
  const list = Array.isArray(payload?.articles)
    ? payload.articles
    : Array.isArray(payload)
      ? payload
      : [];

  return list.map((item) => ({
    title: item?.title || '',
    summary: item?.description || item?.summary || '',
    region: item?.region || NEWS_SOURCE_REGION,
    source_name: item?.source?.name || item?.source_name || 'Unknown source',
    source_url: item?.url || item?.source_url || '',
    published_at: item?.publishedAt || item?.published_at || new Date().toISOString(),
  }));
}

async function fetchNews() {
  ensureEnv('NEWS_SOURCE_URL', NEWS_SOURCE_URL);

  const response = await fetch(NEWS_SOURCE_URL, {
    method: 'GET',
    headers: buildNewsSourceHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`News source request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return normalizeArticles(payload);
}

async function translateWithOpenAI(text) {
  ensureEnv('OPENAI_API_KEY', process.env.OPENAI_API_KEY);

  const model = process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4.1-mini';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'Translate user text to Russian. Return translation only, with no commentary or quotes.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI translation request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return payload?.output_text?.trim() || text;
}

async function translateWithDeepL(text) {
  ensureEnv('DEEPL_API_KEY', process.env.DEEPL_API_KEY);

  const endpoint = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('target_lang', TRANSLATOR_TARGET_LANG.toUpperCase());

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepL translation request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return payload?.translations?.[0]?.text?.trim() || text;
}

async function translateWithLibreTranslate(text) {
  const endpoint = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/translate';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.LIBRETRANSLATE_API_KEY
        ? { Authorization: `Bearer ${process.env.LIBRETRANSLATE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      q: text,
      source: 'auto',
      target: TRANSLATOR_TARGET_LANG,
      format: 'text',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LibreTranslate request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return payload?.translatedText?.trim() || text;
}

async function translateText(text) {
  if (!text) {
    return { text: '', status: 'skipped_empty' };
  }

  if (TRANSLATOR_PROVIDER === 'none') {
    return { text, status: 'skipped_no_provider' };
  }

  try {
    let translated = text;

    if (TRANSLATOR_PROVIDER === 'openai') {
      translated = await translateWithOpenAI(text);
    } else if (TRANSLATOR_PROVIDER === 'deepl') {
      translated = await translateWithDeepL(text);
    } else if (TRANSLATOR_PROVIDER === 'libretranslate') {
      translated = await translateWithLibreTranslate(text);
    } else {
      throw new Error(`Unsupported TRANSLATOR_PROVIDER: ${TRANSLATOR_PROVIDER}`);
    }

    return {
      text: translated,
      status: 'translated',
    };
  } catch (error) {
    return {
      text,
      status: 'failed_fallback_original',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function translateArticle(article) {
  const [titleResult, summaryResult] = await Promise.all([
    translateText(article.title),
    translateText(article.summary),
  ]);

  const statusList = [titleResult.status, summaryResult.status];
  const translation_status = statusList.every((s) => s === 'translated')
    ? 'translated'
    : statusList.some((s) => s === 'failed_fallback_original')
      ? 'fallback_original'
      : statusList.includes('skipped_no_provider')
        ? 'skipped_no_provider'
        : 'partial';

  return {
    title_ru: titleResult.text,
    summary_ru: summaryResult.text,
    region: article.region,
    source_name: article.source_name,
    source_url: article.source_url,
    published_at: article.published_at,
    translation_status,
  };
}

async function run() {
  const articles = await fetchNews();

  const translated = [];
  for (const article of articles) {
    translated.push(await translateArticle(article));
  }

  const outputPath = path.resolve(__dirname, '../data/news.json');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(translated, null, 2), 'utf-8');

  console.log(`Saved ${translated.length} records to ${outputPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
