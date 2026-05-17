'use client';

import { useState, useRef } from 'react';
import { decodeMETAR, type MetarDecoded } from '@/lib/metar-decoder';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  VFR:  { bg: 'bg-green-100',  text: 'text-green-800',  label: 'VFR — Visual Flight Rules' },
  MVFR: { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'MVFR — Marginal VFR' },
  IFR:  { bg: 'bg-red-100',    text: 'text-red-800',    label: 'IFR — Instrument Flight Rules' },
  LIFR: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'LIFR — Low IFR' },
};

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-base font-semibold text-slate-800">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [decoded, setDecoded] = useState<MetarDecoded | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchMetar(code: string) {
    setLoading(true);
    setError('');
    setDecoded(null);

    try {
      const res = await fetch(`/api/metar?id=${encodeURIComponent(code.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        return;
      }

      setDecoded(decodeMETAR(data.raw));
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = input.trim();
    if (code) fetchMetar(code);
  }

  const cat = decoded ? CATEGORY_STYLES[decoded.flightCategory] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-slate-100 px-4 py-12">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-3 text-5xl">✈️</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">METAR Reader</h1>
          <p className="mt-2 text-slate-500">Enter an airport code to get a plain-English weather report.</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="e.g. KLAX, EGLL, WIII"
            maxLength={4}
            autoFocus
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-mono font-semibold uppercase tracking-widest text-slate-800 shadow-sm placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Search'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {decoded && (
          <div className="mt-6 space-y-4">

            {/* Summary header */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{decoded.station}</h2>
                  <p className="text-sm text-slate-500">
                    {decoded.time.formatted}{decoded.isAuto ? ' · Automated station' : ''}
                  </p>
                </div>
                {cat && (
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>
                )}
              </div>
              <p className="mt-4 text-slate-700 leading-relaxed">{decoded.summary}</p>
            </div>

            {/* Weather grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                icon="🌡️"
                label="Temperature"
                value={`${decoded.temperature.fahrenheit}°F / ${decoded.temperature.celsius}°C`}
                sub={`Dew point ${decoded.dewpoint.fahrenheit}°F · Humidity ${decoded.humidity}%`}
              />
              <StatCard
                icon="💨"
                label="Wind"
                value={
                  decoded.wind.speed === 0
                    ? 'Calm'
                    : `${decoded.wind.cardinal} at ${decoded.wind.speed} kt (${decoded.wind.speedMph} mph)`
                }
                sub={
                  decoded.wind.gust
                    ? `Gusting to ${decoded.wind.gust} kt (${decoded.wind.gustMph} mph)`
                    : decoded.wind.variableFrom !== undefined
                    ? `Variable ${decoded.wind.variableFrom}°–${decoded.wind.variableTo}°`
                    : undefined
                }
              />
              <StatCard
                icon="👁️"
                label="Visibility"
                value={decoded.visibility.description}
                sub={decoded.visibility.isCAVOK ? 'CAVOK — ceiling & visibility OK' : undefined}
              />
              <StatCard
                icon="☁️"
                label="Sky Condition"
                value={decoded.skyCondition}
                sub={decoded.clouds.length > 1 ? `${decoded.clouds.length} cloud layers reported` : undefined}
              />
              <StatCard
                icon="📊"
                label="Altimeter / Pressure"
                value={`${decoded.altimeter.inHg.toFixed(2)} inHg`}
                sub={`${decoded.altimeter.hPa} hPa`}
              />
              {decoded.weather.length > 0 && (
                <StatCard
                  icon="🌧️"
                  label="Weather"
                  value={decoded.weather.map(w => w.description).join(', ')}
                />
              )}
            </div>

            {/* Cloud layer detail */}
            {decoded.clouds.length > 1 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Cloud Layers</p>
                <ul className="space-y-1">
                  {decoded.clouds.map((c, idx) => (
                    <li key={idx} className="text-sm text-slate-700">• {c.description}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Raw METAR */}
            <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900">
                Raw METAR
              </summary>
              <div className="border-t border-slate-100 px-4 py-3">
                <code className="break-all font-mono text-sm text-slate-700">{decoded.raw}</code>
              </div>
            </details>

          </div>
        )}

        <p className="mt-12 text-center text-xs text-slate-400">
          Data from <span className="font-medium">aviationweather.gov</span> · METAR reports update every 30–60 min
        </p>
      </div>
    </div>
  );
}
