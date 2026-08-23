// Memory stores (In-memory cache; persist to database in production)
let rawReportsQueue = [];
let hazardClusters = [];

const CLUSTER_RADIUS_METERS = 250;

// Haversine Distance Calculator (Meters)
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 250m Spatial Clustering Engine
function processReportIntoCluster(report) {
    let matchedCluster = null;

    for (const cluster of hazardClusters) {
        if (cluster.type === report.type) {
            const distance = haversineDistance(report.lat, report.lng, cluster.lat, cluster.lng);
            if (distance <= CLUSTER_RADIUS_METERS) {
                matchedCluster = cluster;
                break;
            }
        }
    }

    if (matchedCluster) {
        matchedCluster.reports.push(report);
        matchedCluster.reportCount = matchedCluster.reports.length;
        
        const totalLat = matchedCluster.reports.reduce((sum, r) => sum + r.lat, 0);
        const totalLng = matchedCluster.reports.reduce((sum, r) => sum + r.lng, 0);
        matchedCluster.lat = totalLat / matchedCluster.reportCount;
        matchedCluster.lng = totalLng / matchedCluster.reportCount;
    } else {
        hazardClusters.push({
            clusterId: `cls-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: report.type,
            description: report.description,
            lat: report.lat,
            lng: report.lng,
            reportCount: 1,
            status: 'pending',
            reports: [report],
            createdAt: new Date().toISOString()
        });
    }
}

// Handler 1: Receive synced reports from frontend
export const syncReports = (req, res) => {
    const { reports } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
        return res.status(400).json({ error: "Invalid or empty reports array." });
    }

    reports.forEach(report => {
        rawReportsQueue.push(report);
        processReportIntoCluster(report);
    });

    res.status(200).json({ success: true, processed: reports.length });
};

// Handler 2: Get active verified hazards for map overlay
export const getActiveHazards = (req, res) => {
    const verifiedHazards = hazardClusters.filter(c => c.status === 'verified');
    res.status(200).json(verifiedHazards);
};

// Handler 3: Admin - Get all clusters
export const getAdminClusters = (req, res) => {
    res.status(200).json(hazardClusters);
};

// Handler 4: Admin - Approve or dismiss hazard cluster
export const verifyHazard = (req, res) => {
    const { clusterId, action } = req.body;

    const cluster = hazardClusters.find(c => c.clusterId === clusterId);
    if (!cluster) {
        return res.status(404).json({ error: "Cluster not found" });
    }

    if (action === 'approve') {
        cluster.status = 'verified';
    } else if (action === 'dismiss') {
        hazardClusters = hazardClusters.filter(c => c.clusterId !== clusterId);
    } else {
        return res.status(400).json({ error: "Action must be 'approve' or 'dismiss'" });
    }

    res.status(200).json({ success: true, cluster });
};