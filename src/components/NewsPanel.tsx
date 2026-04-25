import { useCallback, useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 60_000;

type NewsItem = {
  id: string;
  region: string;
  title: string;
  translatedRu: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
};

type NewsResponse = {
  items: NewsItem[];
};

export function NewsPanel() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/data/news.json?ts=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as NewsResponse;
      setItems(payload.items ?? []);
    } catch (loadError) {
      setError('Не удалось загрузить новости.');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const refreshId = window.setInterval(() => {
      void loadData();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshId);
  }, [loadData]);

  return (
    <section>
      <h2>Новости по регионам</h2>
      {loading && <p>Загрузка…</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <p>
                <strong>{item.region}:</strong> {item.translatedRu}
              </p>
              <p>
                <small>
                  Оригинал: “{item.title}” ({item.sourceName}) ·{' '}
                  {new Date(item.publishedAt).toLocaleString('ru-RU')}
                </small>
              </p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Первоисточник
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
