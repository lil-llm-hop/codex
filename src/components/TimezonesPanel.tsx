import { useCallback, useEffect, useMemo, useState } from 'react';

const REFRESH_INTERVAL_MS = 60_000;

type TimezoneCity = {
  id: string;
  city: string;
  timezone: string;
};

type TimezonesResponse = {
  cities: TimezoneCity[];
};

function formatCityTime(timezone: string, locale = 'ru-RU'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    hour12: false,
  }).format(new Date());
}

export function TimezonesPanel() {
  const [cities, setCities] = useState<TimezoneCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/data/timezones.json?ts=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as TimezonesResponse;
      setCities(payload.cities ?? []);
    } catch (loadError) {
      setError('Не удалось загрузить список часовых поясов.');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const refreshId = window.setInterval(() => {
      setTick((value) => value + 1);
      void loadData();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshId);
  }, [loadData]);

  const rows = useMemo(
    () =>
      cities.map((entry) => ({
        ...entry,
        localTime: formatCityTime(entry.timezone),
      })),
    [cities, tick],
  );

  return (
    <section>
      <h2>Часовые пояса</h2>
      {loading && <p>Загрузка…</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Город</th>
              <th>Таймзона</th>
              <th>Локальное время</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.city}</td>
                <td>{row.timezone}</td>
                <td>{row.localTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
