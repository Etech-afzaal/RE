import { NextResponse } from "next/server";

const REVERSE_GEOCODER_URL = process.env.GEOCODING_REVERSE_URL || "https://nominatim.openstreetmap.org/reverse";
function coordinate(value, min, max) { const number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? number : null; }

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 }); }
  const latitude = coordinate(body?.latitude, -90, 90); const longitude = coordinate(body?.longitude, -180, 180);
  if (latitude === null || longitude === null) return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  try {
    const url = new URL(REVERSE_GEOCODER_URL);
    url.searchParams.set("lat", String(latitude)); 
    url.searchParams.set("lon", String(longitude)); 
    url.searchParams.set("format", "jsonv2"); 
    url.searchParams.set("addressdetails", "1");
    
    // 🔥 FIX: Forces Nominatim / OpenStreetMap to return names in English
    url.searchParams.set("accept-language", "en");

    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Dhalahore-Location-Matching/1.0" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Reverse geocoder returned ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ address: data?.address || {}, display_name: data?.display_name || "" });
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return NextResponse.json({ error: "Unable to resolve location." }, { status: 502 });
  }
}
