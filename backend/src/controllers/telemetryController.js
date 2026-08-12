// src/controllers/telemetryController.js
import { fetchNepalSeismicData } from '../services/usgsService.js';

/**
 * GET /api/telemetry/live
 * Controller to fetch and return real-time USGS seismic telemetry for Nepal
 */
export const getLiveTelemetry = async (req, res) => {
  try {
    const data = await fetchNepalSeismicData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error: Unable to fetch live telemetry',
      error: error.message,
    });
  }
};