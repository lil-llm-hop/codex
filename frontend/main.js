const STALE_HOURS = 2;
const REFRESH_INTERVAL_MS = 60 * 1000;
const TIMEZONES = [
  { label: 'Москва', tz: 'Europe/Moscow' },
  { label: 'Нью-Йорк', tz: 'America/New_York' },
  { label: 'Лондон', tz: 'Europe/London' },
  { label: 'Токио', tz: 'Asia/Tokyo' }
];

const SOURCES = [
  { name: 'Валюты (Forex)', path: '../data/forex.json', kind: 'forex' },
  { name: 'Криптовалюты', path: '../data/crypto.json', kind: 'crypto' },
  { name: 'Мировые новости', path: '../data/news.json', kind: 'news' }
];

const template = document.querySelector('#source-template');
const sourcesContainer = document.querySelector('#sources');
const globalIndicator = document.querySelector('#global-indicator');
const timezoneList = document.querySelector('#timezone-list');

function formatTimestamp(isoTimestamp) {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Некорректный timestamp';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function isStale(isoTimestamp) {
  const updatedAt = new Date(isoTimestamp);
  if (Number.isNaN(updatedAt.getTime())) {
    return true;
  }

  const staleMs = STALE_HOURS * 60 * 60 * 1000;
  return Date.now() - updatedAt.getTime() > staleMs;
}

function renderTimezones() {
  timezoneList.innerHTML = '';

  for (const zone of TIMEZONES) {
    const li = document.createElement('li');
    const current = new Intl.DateTimeFormat('ru-RU', {
      timeZone: zone.tz,
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(new Date());

    li.textContent = `${zone.label}: ${current}`;
    timezoneList.appendChild(li);
  }
}

function renderUnavailableCard(sourceName, reason) {
  const fragment = template.content.cloneNode(true);
  fragment.querySelector('.source-name').textContent = sourceName;

  const statusPill = fragment.querySelector('.status-pill');
  statusPill.textContent = 'unavailable';
  statusPill.classList.add('unavailable');

  fragment.querySelector('.updated-at').textContent = 'Последнее обновление: недоступно';

  const content = fragment.querySelector('.content');
  content.innerHTML = `
    <div class="empty-state">
      Источник временно недоступен.<br />
      Причина: ${reason}
    </div>
  `;

  sourcesContainer.appendChild(fragment);
}

function renderItems(content, payload, kind) {
  const hasItems = Array.isArray(payload.items) && payload.items.length > 0;
  if (!hasItems) {
    content.innerHTML = '<div class="empty-state">Источник вернул пустой набор данных.</div>';
    return;
  }

  const list = document.createElement('ul');

  for (const item of payload.items) {
    const li = document.createElement('li');

    if (kind === 'news') {
      const link = document.createElement('a');
      link.href = item.source_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.title_ru || item.title || 'Без заголовка';

      const meta = document.createElement('div');
      meta.classList.add('news-meta');
      meta.textContent = `${item.region ?? 'Мир'} · ${formatTimestamp(item.published_at)}`;

      li.appendChild(link);
      if (item.summary_ru) {
        const summary = document.createElement('p');
        summary.textContent = item.summary_ru;
        li.appendChild(summary);
      }
      li.appendChild(meta);
    } else {
      li.textContent = `${item.title}: ${item.value}`;
    }

    list.appendChild(li);
  }

  content.appendChild(list);
}

function renderSourceCard(sourceName, payload, kind) {
  const fragment = template.content.cloneNode(true);
  fragment.querySelector('.source-name').textContent = sourceName;

  const statusPill = fragment.querySelector('.status-pill');
  const status = payload.status ?? 'unknown';
  statusPill.textContent = status;
  if (status === 'ok') {
    statusPill.classList.add('ok');
  } else if (status === 'unavailable') {
    statusPill.classList.add('unavailable');
  } else {
    statusPill.classList.add('degraded');
  }

  fragment.querySelector('.updated-at').textContent =
    `Последнее обновление: ${formatTimestamp(payload.updated_at)}`;

  const content = fragment.querySelector('.content');
  renderItems(content, payload, kind);

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const errorsTitle = document.createElement('p');
    errorsTitle.textContent = 'Ошибки источника:';

    const errorList = document.createElement('ul');
    errorList.classList.add('error-list');
    for (const error of payload.errors) {
      const li = document.createElement('li');
      li.textContent = error;
      errorList.appendChild(li);
    }

    content.appendChild(errorsTitle);
    content.appendChild(errorList);
  }

  sourcesContainer.appendChild(fragment);
}

async function loadSource(source) {
  try {
    const response = await fetch(source.path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    return { source, payload, error: null };
  } catch (error) {
    return { source, payload: null, error: error.message };
  }
}

async function refreshDashboard() {
  const results = await Promise.all(SOURCES.map(loadSource));
  const staleOrUnavailable = [];
  sourcesContainer.innerHTML = '';

  for (const result of results) {
    if (result.error) {
      staleOrUnavailable.push(`${result.source.name}: недоступен`);
      renderUnavailableCard(result.source.name, result.error);
      continue;
    }

    renderSourceCard(result.source.name, result.payload, result.source.kind);

    if (isStale(result.payload.updated_at) || result.payload.status !== 'ok') {
      staleOrUnavailable.push(`${result.source.name}: данные могут быть устаревшими`);
    }
  }

  if (staleOrUnavailable.length > 0) {
    globalIndicator.classList.remove('hidden');
    globalIndicator.classList.add('warning');
    globalIndicator.textContent =
      `⚠ Данные могут быть устаревшими или частично недоступными (${staleOrUnavailable.join('; ')}).`;
  } else {
    globalIndicator.classList.add('hidden');
    globalIndicator.textContent = '';
  }
}

async function main() {
  renderTimezones();
  await refreshDashboard();

  setInterval(renderTimezones, 1000);
  setInterval(refreshDashboard, REFRESH_INTERVAL_MS);
}

main();
