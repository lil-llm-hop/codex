import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
const requiredKeys = ['updated_at', 'source', 'status', 'errors', 'items'];
const allowedStatuses = new Set(['ok', 'degraded', 'unavailable']);
const requiredFiles = ['forex.json', 'crypto.json', 'news.json'];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function validateCommon(file, payload) {
  for (const key of requiredKeys) {
    if (!(key in payload)) {
      fail(`${file}: отсутствует обязательное поле "${key}".`);
    }
  }

  if (typeof payload.updated_at !== 'string' || Number.isNaN(Date.parse(payload.updated_at))) {
    fail(`${file}: поле "updated_at" должно быть валидной ISO-датой.`);
  }

  if (typeof payload.source !== 'string' || payload.source.length === 0) {
    fail(`${file}: поле "source" должно быть непустой строкой.`);
  }

  if (!allowedStatuses.has(payload.status)) {
    fail(
      `${file}: поле "status" должно быть одним из значений: ${Array.from(allowedStatuses).join(', ')}.`
    );
  }

  if (!Array.isArray(payload.errors)) {
    fail(`${file}: поле "errors" должно быть массивом.`);
  }

  if (!Array.isArray(payload.items)) {
    fail(`${file}: поле "items" должно быть массивом.`);
  }
}

function validateRateItem(file, item, index) {
  if (typeof item.title !== 'string' || item.title.length === 0) {
    fail(`${file}: items[${index}].title должен быть непустой строкой.`);
  }

  if (item.value === undefined || item.value === null || `${item.value}`.length === 0) {
    fail(`${file}: items[${index}].value должен быть непустым.`);
  }
}

function validateNewsItem(file, item, index) {
  const requiredStringFields = ['region', 'title_ru', 'summary_ru', 'source_url', 'published_at'];

  for (const field of requiredStringFields) {
    if (typeof item[field] !== 'string' || item[field].length === 0) {
      fail(`${file}: items[${index}].${field} должен быть непустой строкой.`);
    }
  }

  if (Number.isNaN(Date.parse(item.published_at))) {
    fail(`${file}: items[${index}].published_at должен быть валидной ISO-датой.`);
  }

  if (!/^https?:\/\//.test(item.source_url)) {
    fail(`${file}: items[${index}].source_url должен начинаться с http:// или https://.`);
  }
}

if (!fs.existsSync(dataDir)) {
  fail('Директория data/ не найдена.');
  process.exit();
}

for (const file of requiredFiles) {
  const fullPath = path.join(dataDir, file);

  if (!fs.existsSync(fullPath)) {
    fail(`Отсутствует обязательный файл ${file}.`);
    continue;
  }

  let payload;

  try {
    payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    fail(`${file}: невалидный JSON (${error.message}).`);
    continue;
  }

  validateCommon(file, payload);

  if (!Array.isArray(payload.items)) {
    continue;
  }

  payload.items.forEach((item, index) => {
    if (file === 'news.json') {
      validateNewsItem(file, item, index);
    } else {
      validateRateItem(file, item, index);
    }
  });
}

if (process.exitCode === 1) {
  process.exit(process.exitCode);
}

console.log(`✅ JSON schema check passed for ${requiredFiles.length} required file(s).`);
