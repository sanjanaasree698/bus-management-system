/**
 * GPS Utilities for accurate distance and speed calculations
 */

const EARTH_RADIUS_KM = 6371;

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const parseTimeToSeconds = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  try {
    const parts = timeStr.split(' ');
    if (parts.length < 2) return 0;
    const timeParts = parts[1].split(':');
    return parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
  } catch (e) {
    return 0;
  }
};

export const calculateSpeed = (lat1, lon1, lat2, lon2, timestamp1, timestamp2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;
  let deltaSeconds = 5;
  if (timestamp1 && timestamp2) {
    const sec1 = parseTimeToSeconds(timestamp1);
    const sec2 = parseTimeToSeconds(timestamp2);
    const diff = Math.abs(sec2 - sec1);
    if (diff >= 0 && diff < 300) deltaSeconds = diff;
  }
  if (deltaSeconds < 3) return 0;
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  if (distance < 0.015) return 0;
  const speed = distance / (deltaSeconds / 3600);
  return speed < 3.0 ? 0 : Math.min(100, Math.round(speed));
};

export const smoothSpeed = (currentSpeed, previousSpeed, smoothingFactor = 0.3) => {
  if (previousSpeed === null || previousSpeed === undefined) return currentSpeed;
  return Math.round(smoothingFactor * currentSpeed + (1 - smoothingFactor) * previousSpeed);
};

export const filterFutureStops = (stops, currentLat, currentLng) => {
  if (!stops || stops.length === 0) return { closestIndex: 0, futureStops: [], currentStop: null, nextStop: null };
  let closestIndex = 0, minDistance = Infinity;
  stops.forEach((stop, idx) => {
    const distance = calculateDistance(currentLat, currentLng, stop.lat, stop.lng);
    if (distance < minDistance) { minDistance = distance; closestIndex = idx; }
  });
  const futureStops = stops.slice(closestIndex);
  const currentStop = stops[closestIndex] || null;
  const nextStop = stops[closestIndex + 1] || null;
  return { closestIndex, futureStops, currentStop, nextStop, distanceToNext: nextStop ? calculateDistance(currentLat, currentLng, nextStop.lat, nextStop.lng) : 0 };
};

export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) - Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

export const formatDistance = (km) => km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(2) + ' km';

export const calculateETA = (distanceKm, speedKmh) => {
  if (!speedKmh || speedKmh === 0) return 'N/A';
  const minutes = Math.round((distanceKm / speedKmh) * 60);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return minutes + ' min' + (minutes !== 1 ? 's' : '');
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return hours + ' hr' + (hours !== 1 ? 's' : '');
  return hours + ' hr ' + remainingMins + ' min' + (remainingMins !== 1 ? 's' : '');
};
