import dotenv from 'dotenv';
import app from './src/app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 QSAFE Nepal Backend listening on port ${PORT}`);
  console.log(`📡 USGS Telemetry Endpoint: http://localhost:${PORT}/api/telemetry/live`);
});
