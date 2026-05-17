export interface MetarDecoded {
  raw: string;
  station: string;
  time: {
    day: number;
    hour: number;
    minute: number;
    formatted: string;
  };
  isAuto: boolean;
  wind: {
    direction: number | 'VRB' | 'CALM';
    cardinal: string;
    speed: number;
    speedMph: number;
    gust?: number;
    gustMph?: number;
    unit: string;
    variableFrom?: number;
    variableTo?: number;
    description: string;
  };
  visibility: {
    value: number;
    description: string;
    isCAVOK: boolean;
  };
  weather: { code: string; description: string }[];
  clouds: { coverage: string; altitude?: number; type?: string; description: string }[];
  skyCondition: string;
  temperature: { celsius: number; fahrenheit: number };
  dewpoint: { celsius: number; fahrenheit: number };
  humidity: number;
  altimeter: { inHg: number; hPa: number };
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  summary: string;
}

function toFahrenheit(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

function knotsToMph(kt: number): number {
  return Math.round(kt * 1.15078);
}

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function cardinalToFull(cardinal: string): string {
  const map: Record<string, string> = {
    N: 'North', NNE: 'North-Northeast', NE: 'Northeast', ENE: 'East-Northeast',
    E: 'East', ESE: 'East-Southeast', SE: 'Southeast', SSE: 'South-Southeast',
    S: 'South', SSW: 'South-Southwest', SW: 'Southwest', WSW: 'West-Southwest',
    W: 'West', WNW: 'West-Northwest', NW: 'Northwest', NNW: 'North-Northwest',
  };
  return map[cardinal] ?? cardinal;
}

function parseTemperature(token: string): number {
  if (token.startsWith('M')) return -parseInt(token.slice(1));
  return parseInt(token);
}

function humidity(tempC: number, dewC: number): number {
  const rh = 100 * Math.exp((17.368 * dewC) / (238.83 + dewC)) / Math.exp((17.368 * tempC) / (238.83 + tempC));
  return Math.min(100, Math.max(0, Math.round(rh)));
}

const WEATHER_CODES: Record<string, string> = {
  // Intensity
  '-': 'Light', '+': 'Heavy',
  // Descriptor
  MI: 'Shallow', PR: 'Partial', BC: 'Patches of', DR: 'Low drifting', BL: 'Blowing',
  SH: 'Showers', TS: 'Thunderstorm', FZ: 'Freezing',
  // Precipitation
  DZ: 'Drizzle', RA: 'Rain', SN: 'Snow', SG: 'Snow grains', IC: 'Ice crystals',
  PL: 'Ice pellets', GR: 'Hail', GS: 'Small hail',
  // Obscuration
  BR: 'Mist', FG: 'Fog', FU: 'Smoke', VA: 'Volcanic ash', DU: 'Dust',
  SA: 'Sand', HZ: 'Haze', PY: 'Spray',
  // Other
  PO: 'Dust whirls', SQ: 'Squalls', FC: 'Funnel cloud', SS: 'Sandstorm', DS: 'Dust storm',
};

function decodeWeatherCode(code: string): string {
  let result = '';
  let remaining = code;

  if (remaining.startsWith('VC')) {
    result += 'In vicinity: ';
    remaining = remaining.slice(2);
  } else if (remaining.startsWith('+')) {
    result += 'Heavy ';
    remaining = remaining.slice(1);
  } else if (remaining.startsWith('-')) {
    result += 'Light ';
    remaining = remaining.slice(1);
  } else {
    result += 'Moderate ';
  }

  const descriptors = ['MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ'];
  for (const d of descriptors) {
    if (remaining.startsWith(d)) {
      result += (WEATHER_CODES[d] ?? d) + ' ';
      remaining = remaining.slice(2);
      break;
    }
  }

  while (remaining.length >= 2) {
    const chunk = remaining.slice(0, 2);
    result += (WEATHER_CODES[chunk] ?? chunk) + ' ';
    remaining = remaining.slice(2);
  }

  return result.trim();
}

const COVERAGE_MAP: Record<string, string> = {
  SKC: 'Clear skies', CLR: 'Clear skies', CAVOK: 'Clear skies, visibility OK',
  FEW: 'Few clouds', SCT: 'Scattered clouds', BKN: 'Broken clouds', OVC: 'Overcast',
  VV: 'Sky obscured',
};

function cloudAltFeet(code: string): number {
  return parseInt(code) * 100;
}

const WEATHER_TOKEN = /^(VC|[-+])?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/;
const CLOUD_TOKEN = /^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$|^(SKC|CLR|NSC|NCD)$/;
const WIND_TOKEN = /^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/;
const WIND_VAR_TOKEN = /^(\d{3})V(\d{3})$/;
const TEMP_TOKEN = /^(M?\d{1,2})\/(M?\d{1,2})$/;
const ALT_TOKEN_A = /^A(\d{4})$/;
const ALT_TOKEN_Q = /^Q(\d{4})$/;
const VIS_SM = /^(\d+(?:\/\d+)?)(SM)$/;
const VIS_M = /^\d{4}$/;

function determineFlightCategory(
  visibilityMiles: number,
  clouds: MetarDecoded['clouds'],
  isCAVOK: boolean,
): MetarDecoded['flightCategory'] {
  if (isCAVOK) return 'VFR';

  const ceilingLayer = clouds.find(c => c.coverage === 'BKN' || c.coverage === 'OVC');
  const ceiling = ceilingLayer?.altitude ?? Infinity;

  if (ceiling < 500 || visibilityMiles < 1) return 'LIFR';
  if (ceiling < 1000 || visibilityMiles < 3) return 'IFR';
  if (ceiling <= 3000 || visibilityMiles <= 5) return 'MVFR';
  return 'VFR';
}

function buildSummary(decoded: Omit<MetarDecoded, 'summary'>): string {
  const parts: string[] = [];

  // Sky / weather conditions
  if (decoded.weather.length > 0) {
    parts.push(decoded.weather.map(w => w.description).join(', '));
  } else {
    parts.push(decoded.skyCondition);
  }

  // Temperature
  parts.push(`${decoded.temperature.fahrenheit}°F (${decoded.temperature.celsius}°C)`);

  // Wind
  parts.push(decoded.wind.description);

  // Visibility (only if reduced)
  if (!decoded.visibility.isCAVOK && decoded.visibility.value < 10) {
    parts.push(`Visibility ${decoded.visibility.description}`);
  }

  return parts.join(' · ');
}

export function decodeMETAR(raw: string): MetarDecoded {
  // Strip METAR/SPECI prefix if present
  const cleaned = raw.trim().replace(/^(METAR|SPECI)\s+/, '');
  const tokens = cleaned.split(/\s+/);
  let i = 0;

  const station = tokens[i++] ?? 'UNKNOWN';

  // Date/time: DDHHmmZ
  const timeToken = tokens[i] ?? '';
  let day = 0, hour = 0, minute = 0, timeFormatted = '';
  if (/^\d{6}Z$/.test(timeToken)) {
    day = parseInt(timeToken.slice(0, 2));
    hour = parseInt(timeToken.slice(2, 4));
    minute = parseInt(timeToken.slice(4, 6));
    timeFormatted = `Day ${day}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC`;
    i++;
  }

  // AUTO / COR
  let isAuto = false;
  if (tokens[i] === 'AUTO' || tokens[i] === 'COR') {
    isAuto = tokens[i] === 'AUTO';
    i++;
  }

  // Wind
  let wind: MetarDecoded['wind'] = {
    direction: 'CALM', cardinal: '', speed: 0, speedMph: 0, unit: 'KT', description: 'Calm winds',
  };

  if (WIND_TOKEN.test(tokens[i] ?? '')) {
    const m = tokens[i].match(WIND_TOKEN)!;
    i++;
    const dir = m[1] === 'VRB' ? 'VRB' : parseInt(m[1]);
    const speed = parseInt(m[2]);
    const gust = m[4] ? parseInt(m[4]) : undefined;
    const unit = m[5] as 'KT' | 'MPS';

    let cardinal = '';
    let dirLabel = '';
    if (dir === 'VRB') {
      dirLabel = 'Variable';
      cardinal = 'VRB';
    } else if (speed === 0) {
      dirLabel = 'Calm';
    } else {
      cardinal = degreesToCardinal(dir as number);
      dirLabel = `from the ${cardinalToFull(cardinal)}`;
    }

    const speedMph = unit === 'KT' ? knotsToMph(speed) : Math.round(speed * 2.237);
    const gustMph = gust ? (unit === 'KT' ? knotsToMph(gust) : Math.round(gust * 2.237)) : undefined;

    let desc = '';
    if (speed === 0) {
      desc = 'Calm winds';
    } else {
      desc = `Winds ${dirLabel} at ${speed} ${unit === 'KT' ? 'knots' : 'm/s'} (${speedMph} mph)`;
      if (gust) desc += `, gusting to ${gust} ${unit === 'KT' ? 'knots' : 'm/s'} (${gustMph} mph)`;
    }

    wind = { direction: dir, cardinal, speed, speedMph, gust, gustMph, unit, description: desc };

    // Variable wind direction (e.g., 230V310)
    if (WIND_VAR_TOKEN.test(tokens[i] ?? '')) {
      const vm = tokens[i].match(WIND_VAR_TOKEN)!;
      wind.variableFrom = parseInt(vm[1]);
      wind.variableTo = parseInt(vm[2]);
      wind.description += ` (variable ${wind.variableFrom}°–${wind.variableTo}°)`;
      i++;
    }
  }

  // Visibility
  let visibility: MetarDecoded['visibility'] = { value: 10, description: '10+ miles', isCAVOK: false };

  if (tokens[i] === 'CAVOK') {
    visibility = { value: 10, description: 'Ceiling and visibility OK (10+ km)', isCAVOK: true };
    i++;
  } else if (VIS_SM.test(tokens[i] ?? '')) {
    const m = tokens[i].match(VIS_SM)!;
    i++;
    let val = 0;
    if (m[1].includes('/')) {
      const [num, den] = m[1].split('/');
      val = parseInt(num) / parseInt(den);
    } else {
      val = parseFloat(m[1]);
    }
    // Handle "1 1/2SM" — current token was "1", next might be "1/2SM"
    if (tokens[i] && VIS_SM.test(tokens[i])) {
      const fm = tokens[i].match(VIS_SM)!;
      const [fn, fd] = fm[1].split('/');
      val += parseInt(fn) / parseInt(fd);
      i++;
    }
    const desc = val >= 10 ? '10+ miles' : val === 1 ? '1 mile' : `${val} miles`;
    visibility = { value: val, description: desc, isCAVOK: false };
  } else if (VIS_M.test(tokens[i] ?? '')) {
    const meters = parseInt(tokens[i]);
    i++;
    const miles = meters / 1609.34;
    const desc = meters >= 9999 ? '10+ km' : `${meters} meters`;
    visibility = { value: miles, description: desc, isCAVOK: false };
  }

  // Skip RVR (R28L/2400FT etc)
  while (/^R\d{2}[LCR]?\//.test(tokens[i] ?? '')) i++;

  // Weather phenomena
  const weather: MetarDecoded['weather'] = [];
  while (WEATHER_TOKEN.test(tokens[i] ?? '')) {
    const code = tokens[i];
    weather.push({ code, description: decodeWeatherCode(code) });
    i++;
  }

  // Sky / clouds
  const clouds: MetarDecoded['clouds'] = [];
  while (CLOUD_TOKEN.test(tokens[i] ?? '')) {
    const token = tokens[i];
    i++;
    const sm = token.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/);
    if (sm) {
      const coverage = sm[1];
      const alt = cloudAltFeet(sm[2]);
      const type = sm[3];
      let desc = `${COVERAGE_MAP[coverage] ?? coverage} at ${alt.toLocaleString()} ft`;
      if (type === 'CB') desc += ' (Cumulonimbus — thunderstorm)';
      if (type === 'TCU') desc += ' (Towering cumulus)';
      clouds.push({ coverage, altitude: alt, type, description: desc });
    } else {
      // SKC / CLR / NSC / NCD
      clouds.push({ coverage: token, description: COVERAGE_MAP[token] ?? token });
    }
  }

  // Overall sky condition
  let skyCondition = 'Clear skies';
  if (clouds.length > 0) {
    const worst = clouds.reduce((prev, cur) => {
      const order = ['FEW', 'SCT', 'BKN', 'OVC', 'VV'];
      return order.indexOf(cur.coverage) > order.indexOf(prev.coverage) ? cur : prev;
    });
    skyCondition = COVERAGE_MAP[worst.coverage] ?? worst.coverage;
    if (worst.altitude) skyCondition += ` at ${worst.altitude.toLocaleString()} ft`;
  }

  // Temperature / Dewpoint
  let temperature = { celsius: 0, fahrenheit: 32 };
  let dewpoint = { celsius: 0, fahrenheit: 32 };

  if (TEMP_TOKEN.test(tokens[i] ?? '')) {
    const m = tokens[i].match(TEMP_TOKEN)!;
    i++;
    const tc = parseTemperature(m[1]);
    const dc = parseTemperature(m[2]);
    temperature = { celsius: tc, fahrenheit: toFahrenheit(tc) };
    dewpoint = { celsius: dc, fahrenheit: toFahrenheit(dc) };
  }

  // Altimeter
  let altimeter = { inHg: 29.92, hPa: 1013 };
  if (ALT_TOKEN_A.test(tokens[i] ?? '')) {
    const inHg = parseInt(tokens[i].slice(1)) / 100;
    altimeter = { inHg, hPa: Math.round(inHg * 33.8639) };
    i++;
  } else if (ALT_TOKEN_Q.test(tokens[i] ?? '')) {
    const hPa = parseInt(tokens[i].slice(1));
    altimeter = { inHg: Math.round(hPa / 33.8639 * 100) / 100, hPa };
    i++;
  }

  const rh = humidity(temperature.celsius, dewpoint.celsius);
  const flightCategory = determineFlightCategory(visibility.value, clouds, visibility.isCAVOK);

  const partial = {
    raw, station, time: { day, hour, minute, formatted: timeFormatted },
    isAuto, wind, visibility, weather, clouds, skyCondition,
    temperature, dewpoint, humidity: rh, altimeter, flightCategory,
  };

  return { ...partial, summary: buildSummary(partial) };
}
