import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText, Path, G } from 'react-native-svg';
import { filterFutureStops, calculateDistance, formatDistance, calculateETA } from '../config/gpsUtils';

const { width } = Dimensions.get('window');
const VIOLET = '#7C3AED';
const GREEN = '#10B981';
const RED = '#EF4444';
const BORDER = '#E2E8F0';

const RouteVisualization = ({ stops, currentLat, currentLng, speed = 0, width: customWidth }) => {
  const displayWidth = customWidth || width - 32;
  const height = 200;
  const padding = 16;

  const routeData = useMemo(() => {
    return filterFutureStops(stops, currentLat, currentLng);
  }, [stops, currentLat, currentLng]);

  if (!routeData.futureStops || routeData.futureStops.length === 0) {
    return (
      <View style={[styles.container, { width: displayWidth }]}>
        <Text style={styles.emptyText}>No upcoming stops</Text>
      </View>
    );
  }

  // Project stops to 2D canvas
  const futureStops = routeData.futureStops;
  let minLat = currentLat, maxLat = currentLat;
  let minLng = currentLng, maxLng = currentLng;

  futureStops.forEach((stop) => {
    minLat = Math.min(minLat, stop.lat);
    maxLat = Math.max(maxLat, stop.lat);
    minLng = Math.min(minLng, stop.lng);
    maxLng = Math.max(maxLng, stop.lng);
  });

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  const canvasWidth = displayWidth - padding * 2;
  const canvasHeight = height - padding * 2;

  const latToY = (lat) => padding + canvasHeight - ((lat - minLat) / latRange) * canvasHeight;
  const lngToX = (lng) => padding + ((lng - minLng) / lngRange) * canvasWidth;

  const busX = lngToX(currentLng);
  const busY = latToY(currentLat);

  const pointsForLine = [[busX, busY]];
  futureStops.forEach((stop) => {
    pointsForLine.push([lngToX(stop.lng), latToY(stop.lat)]);
  });

  const polylinePoints = pointsForLine.map((p) => `${p[0]},${p[1]}`).join(' ');

  const nextStop = routeData.nextStop;
  const distToNext = routeData.distanceToNext;
  const etaText = calculateETA(distToNext, speed);

  return (
    <View style={[styles.container, { width: displayWidth }]}>
      <Svg width={displayWidth} height={height} style={styles.canvas}>
        {/* Route polyline */}
        <Polyline
          points={pointsForLine.map((p) => `${p[0]},${p[1]}`).join(' ')}
          stroke={VIOLET}
          strokeWidth={3}
          fill="none"
          strokeDasharray="5,5"
        />

        {/* Draw stops */}
        {futureStops.map((stop, idx) => {
          const x = lngToX(stop.lng);
          const y = latToY(stop.lat);
          const isStart = idx === 0;
          const isEnd = idx === futureStops.length - 1;
          const color = isStart ? GREEN : isEnd ? RED : VIOLET;
          const stopNumber = routeData.closestIndex + idx + 1;

          return (
            <G key={`stop-${idx}`}>
              <Circle cx={x} cy={y} r={10} fill={color} />
              <SvgText
                x={x}
                y={y}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="10"
                fontWeight="bold"
              >
                {stopNumber}
              </SvgText>
            </G>
          );
        })}

        {/* Bus current position */}
        <G>
          <Circle cx={busX} cy={busY} r={8} fill="#2CC5A0" stroke="#FFFFFF" strokeWidth={2} />
          <Circle cx={busX} cy={busY} r={12} fill="none" stroke="#2CC5A0" strokeWidth={1} />
        </G>
      </Svg>

      {/* Next Stop Info */}
      {nextStop && (
        <View style={styles.nextStopCard}>
          <View>
            <Text style={styles.nextStopLabel}>Next Stop</Text>
            <Text style={styles.nextStopName}>{nextStop.name}</Text>
            <Text style={styles.nextStopDistance}>{formatDistance(distToNext)}</Text>
          </View>
          <View style={styles.etaBox}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaTime}>{etaText}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default RouteVisualization;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 0,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 12,
  },
  canvas: {
    backgroundColor: '#F8FAFC',
  },
  emptyText: {
    padding: 16,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
  },
  nextStopCard: {
    backgroundColor: '#F5F3FF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextStopLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  nextStopName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
  },
  nextStopDistance: {
    fontSize: 12,
    color: VIOLET,
    marginTop: 2,
  },
  etaBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  etaLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  etaTime: {
    fontSize: 12,
    fontWeight: '600',
    color: VIOLET,
    marginTop: 2,
  },
});
