import { decodeMETAR } from '@/lib/metar-decoder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand: decode and return the full result */
const decode = (raw: string) => decodeMETAR(raw);

// ---------------------------------------------------------------------------
// Wind
// ---------------------------------------------------------------------------

describe('Wind parsing', () => {
  test('calm wind (00000KT)', () => {
    const d = decode('KLAX 010000Z 00000KT 10SM CLR 20/10 A2992');
    expect(d.wind.speed).toBe(0);
    expect(d.wind.description).toMatch(/calm/i);
  });

  test('standard directional wind', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 20/10 A2992');
    expect(d.wind.direction).toBe(270);
    expect(d.wind.speed).toBe(15);
    expect(d.wind.cardinal).toBe('W');
    expect(d.wind.speedMph).toBe(17); // 15kt * 1.15078 ≈ 17mph
    expect(d.wind.gust).toBeUndefined();
  });

  test('gusting wind', () => {
    const d = decode('KJFK 010000Z 34012G20KT 10SM FEW080 17/06 A3007');
    expect(d.wind.speed).toBe(12);
    expect(d.wind.gust).toBe(20);
    expect(d.wind.gustMph).toBe(23);
    expect(d.wind.description).toMatch(/gusting/i);
  });

  test('variable wind direction (VRB)', () => {
    const d = decode('KSFO 010000Z VRB04KT 10SM CLR 18/08 A2990');
    expect(d.wind.direction).toBe('VRB');
    expect(d.wind.description).toMatch(/variable/i);
  });

  test('variable wind range token (230V310)', () => {
    const d = decode('KORD 010000Z 27010KT 230V310 10SM CLR 15/05 A2985');
    expect(d.wind.variableFrom).toBe(230);
    expect(d.wind.variableTo).toBe(310);
    expect(d.wind.description).toMatch(/230.*310/);
  });

  test('wind in MPS (meters per second)', () => {
    const d = decode('UUDD 010000Z 09010MPS 9999 CLR 05/M02 Q1020');
    expect(d.wind.unit).toBe('MPS');
    expect(d.wind.speed).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe('Visibility parsing', () => {
  test('statute miles (10SM)', () => {
    const d = decode('KLAX 010000Z 00000KT 10SM CLR 20/10 A2992');
    expect(d.visibility.value).toBe(10);
    expect(d.visibility.description).toMatch(/10\+/);
  });

  test('fractional statute miles (1/4SM)', () => {
    const d = decode('KORD 010000Z 18005KT 1/4SM FG OVC002 08/08 A2980');
    expect(d.visibility.value).toBeCloseTo(0.25);
    expect(d.visibility.description).toMatch(/0\.25/);
  });

  test('metric visibility (9999)', () => {
    const d = decode('WIII 010000Z 25008KT 9999 FEW020 32/25 Q1006');
    expect(d.visibility.value).toBeGreaterThan(5); // 9999m ≈ 6.2mi
    expect(d.visibility.description).toMatch(/10\+ km/);
  });

  test('reduced metric visibility (6000m)', () => {
    const d = decode('EGLL 010000Z 22010KT 6000 SCT015 12/09 Q1015');
    expect(d.visibility.description).toMatch(/6000 meters/);
  });

  test('CAVOK', () => {
    const d = decode('EGLL 010000Z 22010KT CAVOK 18/10 Q1018');
    expect(d.visibility.isCAVOK).toBe(true);
    expect(d.visibility.description).toMatch(/ceiling and visibility ok/i);
    expect(d.flightCategory).toBe('VFR');
  });
});

// ---------------------------------------------------------------------------
// Weather phenomena
// ---------------------------------------------------------------------------

describe('Weather phenomena parsing', () => {
  test('light rain (-RA)', () => {
    const d = decode('KORD 010000Z 18010KT 3SM -RA BR OVC015 14/12 A2989');
    const rain = d.weather.find(w => w.code === '-RA');
    expect(rain).toBeDefined();
    expect(rain!.description).toMatch(/light/i);
    expect(rain!.description).toMatch(/rain/i);
  });

  test('heavy rain (+RA)', () => {
    const d = decode('KORD 010000Z 18010KT 2SM +RA OVC010 14/12 A2980');
    const rain = d.weather.find(w => w.code === '+RA');
    expect(rain!.description).toMatch(/heavy/i);
  });

  test('thunderstorm (TS)', () => {
    const d = decode('KATL 010000Z 20015KT 5SM TSRA SCT040CB BKN080 25/18 A2975');
    const ts = d.weather.find(w => w.code === 'TSRA');
    expect(ts).toBeDefined();
    expect(ts!.description).toMatch(/thunderstorm/i);
  });

  test('snow (SN)', () => {
    const d = decode('KDEN 010000Z 00000KT 2SM SN OVC010 M02/M05 A2970');
    const snow = d.weather.find(w => w.code === 'SN');
    expect(snow!.description).toMatch(/snow/i);
  });

  test('mist (BR)', () => {
    const d = decode('KORD 010000Z 18010KT 3SM BR OVC015 14/12 A2989');
    const mist = d.weather.find(w => w.code === 'BR');
    expect(mist!.description).toMatch(/mist/i);
  });

  test('fog (FG)', () => {
    const d = decode('KSFO 010000Z 00000KT 1/4SM FG OVC002 12/12 A3000');
    const fog = d.weather.find(w => w.code === 'FG');
    expect(fog!.description).toMatch(/fog/i);
  });

  test('no weather phenomena when sky is clear', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/08 A2992');
    expect(d.weather).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Sky / cloud conditions
// ---------------------------------------------------------------------------

describe('Cloud / sky condition parsing', () => {
  test('clear (CLR)', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/08 A2992');
    expect(d.clouds[0].coverage).toBe('CLR');
    expect(d.skyCondition).toMatch(/clear/i);
  });

  test('few clouds (FEW030)', () => {
    const d = decode('KJFK 010000Z 34012KT 10SM FEW030 17/06 A3007');
    expect(d.clouds[0].coverage).toBe('FEW');
    expect(d.clouds[0].altitude).toBe(3000);
  });

  test('scattered clouds (SCT050)', () => {
    const d = decode('EGLL 010000Z 22015KT 9999 SCT050 18/12 Q1018');
    expect(d.clouds[0].coverage).toBe('SCT');
    expect(d.clouds[0].altitude).toBe(5000);
  });

  test('broken ceiling (BKN008)', () => {
    const d = decode('KORD 010000Z 18010KT 3SM BKN008 14/12 A2989');
    expect(d.clouds[0].coverage).toBe('BKN');
    expect(d.clouds[0].altitude).toBe(800);
    expect(d.skyCondition).toMatch(/broken/i);
  });

  test('overcast (OVC015)', () => {
    const d = decode('KORD 010000Z 18010KT 3SM OVC015 14/12 A2989');
    expect(d.clouds[0].coverage).toBe('OVC');
    expect(d.clouds[0].altitude).toBe(1500);
    expect(d.skyCondition).toMatch(/overcast/i);
  });

  test('multiple cloud layers — worst layer drives skyCondition', () => {
    const d = decode('KJFK 010000Z 34012KT 10SM FEW080 BKN250 17/06 A3007');
    expect(d.clouds).toHaveLength(2);
    expect(d.skyCondition).toMatch(/broken/i); // BKN is the worst layer
  });

  test('cumulonimbus flag (CB)', () => {
    const d = decode('KATL 010000Z 20015KT 5SM TSRA SCT040CB BKN080 25/18 A2975');
    const cb = d.clouds.find(c => c.type === 'CB');
    expect(cb).toBeDefined();
    expect(cb!.description).toMatch(/cumulonimbus/i);
  });
});

// ---------------------------------------------------------------------------
// Temperature & dewpoint
// ---------------------------------------------------------------------------

describe('Temperature and dewpoint parsing', () => {
  test('positive temperature and dewpoint', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.temperature.celsius).toBe(22);
    expect(d.temperature.fahrenheit).toBe(72);
    expect(d.dewpoint.celsius).toBe(10);
    expect(d.dewpoint.fahrenheit).toBe(50);
  });

  test('negative temperature (M prefix)', () => {
    const d = decode('KDEN 010000Z 00000KT 2SM SN OVC010 M02/M05 A2970');
    expect(d.temperature.celsius).toBe(-2);
    expect(d.temperature.fahrenheit).toBe(28);
    expect(d.dewpoint.celsius).toBe(-5);
  });

  test('zero degrees', () => {
    const d = decode('CYYZ 010000Z 00000KT 5SM OVC020 00/M03 A2990');
    expect(d.temperature.celsius).toBe(0);
    expect(d.temperature.fahrenheit).toBe(32);
  });

  test('humidity is calculated and within range', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.humidity).toBeGreaterThan(0);
    expect(d.humidity).toBeLessThanOrEqual(100);
  });

  test('100% humidity when temp equals dewpoint', () => {
    const d = decode('KSFO 010000Z 00000KT 1/4SM FG OVC002 12/12 A3000');
    expect(d.humidity).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Altimeter
// ---------------------------------------------------------------------------

describe('Altimeter parsing', () => {
  test('US format (A2992)', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.altimeter.inHg).toBeCloseTo(29.92);
    expect(d.altimeter.hPa).toBeGreaterThan(1000);
  });

  test('international format (Q1006)', () => {
    const d = decode('WIII 010000Z 25008KT 9999 FEW020 32/25 Q1006');
    expect(d.altimeter.hPa).toBe(1006);
    expect(d.altimeter.inHg).toBeGreaterThan(29);
  });
});

// ---------------------------------------------------------------------------
// Flight category
// ---------------------------------------------------------------------------

describe('Flight category', () => {
  test('VFR — clear skies, good visibility', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.flightCategory).toBe('VFR');
  });

  test('MVFR — broken ceiling at 2500ft', () => {
    const d = decode('KORD 010000Z 18010KT 4SM BKN025 14/12 A2989');
    expect(d.flightCategory).toBe('MVFR');
  });

  test('IFR — ceiling 800ft', () => {
    const d = decode('KORD 010000Z 18010KT 2SM OVC008 12/11 A2985');
    expect(d.flightCategory).toBe('IFR');
  });

  test('LIFR — ceiling below 500ft', () => {
    const d = decode('KORD 010000Z 00000KT 1/4SM FG OVC002 08/08 A2980');
    expect(d.flightCategory).toBe('LIFR');
  });

  test('CAVOK is always VFR', () => {
    const d = decode('EGLL 010000Z 22010KT CAVOK 18/10 Q1018');
    expect(d.flightCategory).toBe('VFR');
  });
});

// ---------------------------------------------------------------------------
// Station & time parsing
// ---------------------------------------------------------------------------

describe('Station and time parsing', () => {
  test('station code is extracted', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.station).toBe('KLAX');
  });

  test('time fields are parsed correctly', () => {
    const d = decode('KLAX 171853Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.time.day).toBe(17);
    expect(d.time.hour).toBe(18);
    expect(d.time.minute).toBe(53);
    expect(d.time.formatted).toMatch(/Day 17/);
    expect(d.time.formatted).toMatch(/18:53 UTC/);
  });

  test('AUTO flag is detected', () => {
    const d = decode('KLAX 010000Z AUTO 27015KT 10SM CLR 22/10 A2992');
    expect(d.isAuto).toBe(true);
  });

  test('non-AUTO station', () => {
    const d = decode('KLAX 010000Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.isAuto).toBe(false);
  });

  test('METAR prefix is stripped', () => {
    const d = decode('METAR KLAX 010000Z 27015KT 10SM CLR 22/10 A2992');
    expect(d.station).toBe('KLAX');
  });

  test('raw string is preserved', () => {
    const raw = 'KLAX 010000Z 27015KT 10SM CLR 22/10 A2992';
    expect(decode(raw).raw).toBe(raw);
  });
});

// ---------------------------------------------------------------------------
// Real-world METAR samples
// ---------------------------------------------------------------------------

describe('Real-world METAR samples', () => {
  test('KLAX — Los Angeles, clear conditions', () => {
    const d = decode('METAR KLAX 170853Z 08005KT 10SM CLR 16/12 A2983 RMK AO2 SLP098 T01560122 58011');
    expect(d.station).toBe('KLAX');
    expect(d.flightCategory).toBe('VFR');
    expect(d.weather).toHaveLength(0);
    expect(d.temperature.celsius).toBe(16);
  });

  test('WIII — Jakarta, tropical humidity', () => {
    const d = decode('METAR WIII 170900Z 25008KT 9999 FEW020 32/25 Q1006 NOSIG');
    expect(d.station).toBe('WIII');
    expect(d.temperature.celsius).toBe(32);
    expect(d.altimeter.hPa).toBe(1006);
    expect(d.humidity).toBeGreaterThan(60);
  });

  test('KJFK — New York, multiple cloud layers', () => {
    const d = decode('METAR KJFK 171851Z 34012G20KT 10SM FEW080 BKN250 17/06 A3007 RMK AO2 SLP187');
    expect(d.station).toBe('KJFK');
    expect(d.wind.gust).toBe(20);
    expect(d.clouds).toHaveLength(2);
    expect(d.flightCategory).toBe('VFR');
  });

  test('KORD — Chicago, IFR rain and mist', () => {
    const d = decode('METAR KORD 171852Z 18010KT 2SM -RA BR OVC008 14/12 A2989 RMK AO2 SLP119');
    expect(d.station).toBe('KORD');
    expect(d.flightCategory).toBe('IFR');
    expect(d.weather.length).toBeGreaterThan(0);
    expect(d.weather.some(w => w.description.match(/rain/i))).toBe(true);
  });
});
