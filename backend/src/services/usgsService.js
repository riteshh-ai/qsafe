// src/services/usgsService.js

// Bounding box coordinates for the Nepal region
const NEPAL_BOUNDS = {
  minLat: 26.0,
  maxLat: 31.0,
  minLon: 80.0,
  maxLon: 89.0,
};

// In-memory telemetry state for real-time RAG context injection
let cachedTelemetry = {
  hasTremor: false,
  count: 0,
  summary: "No significant tremors (M ≥ 3.0) detected in the Nepal region in the past 24 hours.",
  lastUpdated: new Date().toISOString(),
  latestEvent: null,
  events: []
};

/**
 * Getter to expose cached telemetry synchronously to ragService.js
 */
export const getCachedTelemetry = () => cachedTelemetry;

/**
 * Fetches USGS 24-hour earthquake feed, filters for events within Nepal,
 * and updates the internal cache for RAG injection.
 */
export const fetchNepalSeismicData = async () => {
  const USGS_FEED_URL =
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

  try {
    const response = await fetch(USGS_FEED_URL);
    if (!response.ok) {
      throw new Error(`USGS API responded with status ${response.status}`);
    }

    const geoJson = await response.json();

    // Filter features within Nepal's spatial bounding box
    const nepalEarthquakes = geoJson.features
      .filter((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        return (
          latitude >= NEPAL_BOUNDS.minLat &&
          latitude <= NEPAL_BOUNDS.maxLat &&
          longitude >= NEPAL_BOUNDS.minLon &&
          longitude <= NEPAL_BOUNDS.maxLon
        );
      })
      .map((feature) => ({
        id: feature.id,
        magnitude: feature.properties.mag,
        location: feature.properties.place,
        time: new Date(feature.properties.time).toISOString(),
        updated: new Date(feature.properties.updated).toISOString(),
        url: feature.properties.url,
        coordinates: {
          longitude: feature.geometry.coordinates[0],
          latitude: feature.geometry.coordinates[1],
          depthKm: feature.geometry.coordinates[2],
        },
        alertLevel: feature.properties.alert || 'none',
        status: feature.properties.status,
      }));

    // Sort by most recent timestamp
    nepalEarthquakes.sort((a, b) => new Date(b.time) - new Date(a.time));

    const hasEvents = nepalEarthquakes.length > 0;
    const latest = hasEvents ? nepalEarthquakes[0] : null;

    // Update in-memory telemetry cache
    cachedTelemetry = {
      hasTremor: hasEvents,
      count: nepalEarthquakes.length,
      lastUpdated: new Date().toISOString(),
      latestEvent: latest,
      events: nepalEarthquakes,
      summary: hasEvents
        ? `ALERT: ${nepalEarthquakes.length} tremor(s) recorded in Nepal in past 24h. Latest: M${latest.magnitude} at ${latest.location} on ${new Date(latest.time).toLocaleString()}.`
        : "No significant tremors (M ≥ 3.0) detected in the Nepal region in the past 24 hours."
    };

    return {
      success: true,
      ...cachedTelemetry
    };
  } catch (error) {
    console.error('Error in usgsService:', error.message);
    return {
      success: false,
      error: error.message,
      ...cachedTelemetry // Fallback to last known cache state
    };
  }
};