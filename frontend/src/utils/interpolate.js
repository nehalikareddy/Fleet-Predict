export function interpolatePosition(polyline, progress) {
  if (!polyline || polyline.length < 2) return polyline[0];

  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Calculate total distance of the polyline
  let totalDist = 0;
  const segments = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = haversineDist(polyline[i], polyline[i + 1]);
    segments.push(dist);
    totalDist += dist;
  }

  // Find which segment the progress falls in
  const targetDist = clampedProgress * totalDist;
  let accumulated = 0;

  for (let i = 0; i < segments.length; i++) {
    if (accumulated + segments[i] >= targetDist) {
      const segmentProgress = (targetDist - accumulated) / segments[i];
      return {
        lat: polyline[i].lat + segmentProgress * (polyline[i + 1].lat - polyline[i].lat),
        lng: polyline[i].lng + segmentProgress * (polyline[i + 1].lng - polyline[i].lng),
      };
    }
    accumulated += segments[i];
  }

  return polyline[polyline.length - 1];
}

function haversineDist(p1, p2) {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * Math.PI / 180) *
    Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns the closest progress value [0,1] on a polyline to a given lat/lng
export function findClosestProgress(polyline, lat, lng) {
  if (!polyline || polyline.length < 2) return 0;
  let totalDist = 0;
  const segments = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = haversineDist(polyline[i], polyline[i + 1]);
    segments.push(dist);
    totalDist += dist;
  }
  let bestProgress = 0;
  let bestDist = Infinity;
  let accumulated = 0;
  for (let i = 0; i < segments.length; i++) {
    // Sample a few points along this segment
    for (let t = 0; t <= 1; t += 0.1) {
      const candidate = {
        lat: polyline[i].lat + t * (polyline[i + 1].lat - polyline[i].lat),
        lng: polyline[i].lng + t * (polyline[i + 1].lng - polyline[i].lng),
      };
      const d = haversineDist({ lat, lng }, candidate);
      if (d < bestDist) {
        bestDist = d;
        bestProgress = (accumulated + t * segments[i]) / totalDist;
      }
    }
    accumulated += segments[i];
  }
  return bestProgress;
}
