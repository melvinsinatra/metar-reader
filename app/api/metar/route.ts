import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id || !/^[A-Za-z0-9]{3,4}$/.test(id)) {
    return NextResponse.json({ error: 'Enter a valid 3-4 character airport code.' }, { status: 400 });
  }

  const url = `https://aviationweather.gov/api/data/metar?ids=${id.toUpperCase()}&hours=0&sep=true`;

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to reach aviation weather service.' }, { status: 502 });
    }

    const text = (await res.text()).trim();

    if (!text) {
      return NextResponse.json(
        { error: `No METAR data found for "${id.toUpperCase()}". Check the airport code and try again.` },
        { status: 404 },
      );
    }

    // Return only the first report (most recent)
    const raw = text.split('\n')[0].trim();
    return NextResponse.json({ raw });
  } catch {
    return NextResponse.json({ error: 'Network error — could not fetch weather data.' }, { status: 500 });
  }
}
