# METAR Reader

A web app that fetches live aviation weather reports (METAR) and decodes them into plain English. Type in any ICAO airport code and get a human-readable weather summary — temperature, wind, visibility, sky conditions, pressure, and flight category.

## Tech Stack

- **Next.js 16** (App Router)
- **Tailwind CSS v4**
- **TypeScript**
- **Jest** for unit tests

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

Enter a 3–4 character ICAO airport code (e.g. `KLAX`, `EGLL`, `WIII`) and press **Search**. The app will fetch the latest METAR from [aviationweather.gov](https://aviationweather.gov) and display:

- Plain-English summary
- Flight category (VFR / MVFR / IFR / LIFR)
- Temperature (°F and °C), dew point, humidity
- Wind direction, speed, and gusts
- Visibility
- Cloud layers
- Altimeter / pressure
- Raw METAR string

## Running Tests

```bash
npm test             # Run all tests once
npm run test:watch   # Re-run on file save
```

All tests are unit tests targeting the METAR decoder (`lib/metar-decoder.ts`) — a pure function with no network or browser dependencies. **47 tests** across 8 groups:

| Group | Tests | What's verified |
|---|---|---|
| Wind | 6 | Calm, directional, gusting, variable (VRB), variable range (e.g. 230V310), MPS unit |
| Visibility | 5 | Statute miles, fractional SM (1/4SM), metric (9999 / 6000m), CAVOK |
| Weather phenomena | 7 | Light/heavy rain, thunderstorm, snow, mist, fog, clear (no phenomena) |
| Cloud / sky condition | 7 | CLR, FEW, SCT, BKN, OVC, multiple layers, cumulonimbus (CB) |
| Temperature & dewpoint | 5 | Positive, negative (M prefix), zero °C, humidity range, 100% when temp = dewpoint |
| Altimeter | 2 | US format (`A####` inHg), international format (`Q####` hPa) |
| Flight category | 5 | VFR, MVFR, IFR, LIFR thresholds, CAVOK → VFR |
| Station & time | 6 | Station extraction, time fields, AUTO flag, METAR prefix stripping, raw string preservation |
| Real-world samples | 4 | KLAX (clear), WIII (tropical), KJFK (multi-layer), KORD (IFR rain) |

## Data Source

Live METAR data is fetched from the [Aviation Weather Center API](https://aviationweather.gov/api/data/metar). Reports are updated every 30–60 minutes.
