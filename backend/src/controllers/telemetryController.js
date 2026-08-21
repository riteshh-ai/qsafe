// backend/src/controllers/telemetryController.js
import { getCachedTelemetry } from '../services/usgsService.js';

export async function getLiveTelemetry(req, res) {
  try {
    const telemetry = getCachedTelemetry();

    // Map features to structures matching frontend expectations
    const events = (telemetry?.features || []).map(item => ({
      id: item.id,
      title: item.properties.title,
      magnitude: item.properties.mag,
      place: item.properties.place,
      time: new Date(item.properties.time).toLocaleString(),
      latitude: item.geometry.coordinates[1], // Latitude
      longitude: item.geometry.coordinates[0] // Longitude
    }));

    return res.json({
      success: true,
      count: events.length,
      events: events
    });
  } catch (error) {
    console.error("Telemetry Map API Error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch map coordinates." });
  }
}