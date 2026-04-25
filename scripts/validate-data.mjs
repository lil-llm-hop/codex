import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
const requiredKeys = ['updated_at', 'source', 'status', 'errors'];
const allowedStatuses = new Set(['ok', 'degraded', 'unavailable']);

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(dataDir)) {
  fail('Директория data/ не найдена.');
  process.exit();
}

const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.json'));

if (files.length === 0) {
  fail('В data/ нет JSON-файлов для проверки.');
  process.exit();
}

for (const file of files) {
  const fullPath = path.join(dataDir, file);
  let payload;

  try {
    payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    fail(`${file}: невалидный JSON (${error.message}).`);
    continue;
  }

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
}

if (process.exitCode === 1) {
  process.exit(process.exitCode);
}

console.log(`✅ JSON schema check passed for ${files.length} file(s).`);
