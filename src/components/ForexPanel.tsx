import { useCallback, useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 60_000;

type ForexPair = {
  id: string;
  base: string;
  quote: string;
  value: number;
  change24hPct: number;
  updatedAt: string;
};

type ForexResponse = {
  pairs: ForexPair[];
};

function formatRate(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 4 });
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function ForexPanel() {
  const [pairs, setPairs] = useState<ForexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/data/forex.json?ts=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ForexResponse;
      setPairs(payload.pairs ?? []);
    } catch (loadError) {
      setError('Не удалось загрузить курсы валют.');
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
      <h2>Forex</h2>
      {loading && <p>Загрузка…</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <ul>
          {pairs.map((pair) => (
            <li key={pair.id}>
              <strong>
                {pair.base}/{pair.quote}
              </strong>{' '}
              — {formatRate(pair.value)} ({formatPercent(pair.change24hPct)}) · обновлено{' '}
              {new Date(pair.updatedAt).toLocaleString('ru-RU')}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
