const STALE_HOURS = 24;
const SOURCES = [
  { name: 'Source A', path: '../data/source-a.json' },
  { name: 'Source B', path: '../data/source-b.json' },
  { name: 'Source C (пример недоступного)', path: '../data/source-c.json' }
];

const template = document.querySelector('#source-template');
const sourcesContainer = document.querySelector('#sources');
const globalIndicator = document.querySelector('#global-indicator');

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
      Источник временно недоступен. Показываем пустое состояние, чтобы интерфейс оставался понятным.<br />
      Причина: ${reason}
    </div>
  `;

  sourcesContainer.appendChild(fragment);
}

function renderSourceCard(sourceName, payload) {
  const fragment = template.content.cloneNode(true);
  fragment.querySelector('.source-name').textContent = sourceName;

  const statusPill = fragment.querySelector('.status-pill');
  const status = payload.status ?? 'unknown';
  statusPill.textContent = status;
  statusPill.classList.add(status === 'ok' ? 'ok' : 'degraded');

  fragment.querySelector('.updated-at').textContent =
    `Последнее обновление: ${formatTimestamp(payload.updated_at)}`;

  const content = fragment.querySelector('.content');
  const hasItems = Array.isArray(payload.items) && payload.items.length > 0;

  if (!hasItems) {
    content.innerHTML = `
      <div class="empty-state">
        Данные от источника пока отсутствуют. Это не ошибка интерфейса — источник вернул пустой набор.
      </div>
    `;
  } else {
    const list = document.createElement('ul');
    for (const item of payload.items) {
      const li = document.createElement('li');
      li.textContent = `${item.title}: ${item.value}`;
      list.appendChild(li);
    }
    content.appendChild(list);
  }

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
    const response = await fetch(source.path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    return { source: source.name, payload, error: null };
  } catch (error) {
    return { source: source.name, payload: null, error: error.message };
  }
}

async function main() {
  const results = await Promise.all(SOURCES.map(loadSource));
  const staleOrUnavailable = [];

  for (const result of results) {
    if (result.error) {
      staleOrUnavailable.push(`${result.source}: недоступен`);
      renderUnavailableCard(result.source, result.error);
      continue;
    }

    renderSourceCard(result.source, result.payload);

    if (isStale(result.payload.updated_at) || result.payload.status !== 'ok') {
      staleOrUnavailable.push(`${result.source}: данные могут быть устаревшими`);
    }
  }

  if (staleOrUnavailable.length > 0) {
    globalIndicator.classList.remove('hidden');
    globalIndicator.classList.add('warning');
    globalIndicator.textContent =
      `⚠ Данные могут быть устаревшими или частично недоступными (${staleOrUnavailable.join('; ')}).`;
  }
}

main();
