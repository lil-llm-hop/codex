import { useCallback, useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 60_000;

type CryptoAsset = {
  id: string;
  symbol: 'BTC' | 'ETH' | 'SOL';
  usd: number;
  rub: number;
  change24hPct: number;
  updatedAt: string;
};

type CryptoResponse = {
  assets: CryptoAsset[];
};

function formatCurrency(value: number, currency: 'USD' | 'RUB'): string {
  return value.toLocaleString('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  });
}

export function CryptoPanel() {
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/data/crypto.json?ts=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as CryptoResponse;
      setAssets(payload.assets ?? []);
    } catch (loadError) {
      setError('Не удалось загрузить криптовалютные котировки.');
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
      <h2>Криптовалюты</h2>
      {loading && <p>Загрузка…</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Актив</th>
              <th>USD</th>
              <th>RUB</th>
              <th>24ч</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.symbol}</td>
                <td>{formatCurrency(asset.usd, 'USD')}</td>
                <td>{formatCurrency(asset.rub, 'RUB')}</td>
                <td>{asset.change24hPct.toFixed(2)}%</td>
                <td>{new Date(asset.updatedAt).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
