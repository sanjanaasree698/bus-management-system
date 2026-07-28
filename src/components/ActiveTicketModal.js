import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Animated, PanResponder, Dimensions, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue, push, set } from 'firebase/database';
import { db, auth } from '../config/firebase';
import { WebView } from 'react-native-webview';

const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([12.9716, 77.5946], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    var busIcon = L.divIcon({
      className: '',
      html: '<div style="background:#6366F1;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(99,102,241,0.4);border:2px solid white;"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M18,11H6V6H18M16.5,17A1.5,1.5 0 0,1 15,15.5A1.5,1.5 0 0,1 16.5,14A1.5,1.5 0 0,1 18,15.5A1.5,1.5 0 0,1 16.5,17M7.5,17A1.5,1.5 0 0,1 6,15.5A1.5,1.5 0 0,1 7.5,14A1.5,1.5 0 0,1 9,15.5A1.5,1.5 0 0,1 7.5,17M4,16C4,16.88 4.39,17.67 5,18.22V20C5,20.55 5.45,21 6,21H7C7.55,21 8,20.55 8,20V19H16V20C16,20.55 16.45,21 17,21H18C18.55,21 19,20.55 19,20V18.22C19.61,17.67 20,16.88 20,16V6C20,2.5 16.42,2 12,2C7.58,2 4,2.5 4,6V16Z"/></svg></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    var busMarker = null;

    window.updateBusLocation = function(lat, lng) {
      if (!lat || !lng) return;
      var pos = [lat, lng];
      if (!busMarker) {
        busMarker = L.marker(pos, { icon: busIcon }).addTo(map);
        map.setView(pos, 16);
      } else {
        busMarker.setLatLng(pos);
        map.flyTo(pos, 16, { animate: true, duration: 1.5 });
      }
    };
  </script>
</body>
</html>
`;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.33; // 1/3 height
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.85; // 85% screen height

const ActiveTicketModal = ({ visible, onClose, ticket }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const webViewRef = useRef(null);

  // Animated height for bottom sheet
  const sheetHeight = useRef(new Animated.Value(SHEET_MIN_HEIGHT)).current;
  const currentHeight = useRef(SHEET_MIN_HEIGHT);

  useEffect(() => {
    const id = sheetHeight.addListener((v) => {
      currentHeight.current = v.value;
    });
    return () => sheetHeight.removeListener(id);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const newHeight = currentHeight.current - gestureState.dy;
        if (newHeight >= SHEET_MIN_HEIGHT && newHeight <= SHEET_MAX_HEIGHT) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy < -60) {
          Animated.spring(sheetHeight, {
            toValue: SHEET_MAX_HEIGHT,
            useNativeDriver: false,
            tension: 40,
            friction: 7,
          }).start();
        } else if (gestureState.dy > 60) {
          Animated.spring(sheetHeight, {
            toValue: SHEET_MIN_HEIGHT,
            useNativeDriver: false,
            tension: 40,
            friction: 7,
          }).start();
        } else {
          const mid = (SHEET_MIN_HEIGHT + SHEET_MAX_HEIGHT) / 2;
          const target = currentHeight.current > mid ? SHEET_MAX_HEIGHT : SHEET_MIN_HEIGHT;
          Animated.spring(sheetHeight, {
            toValue: target,
            useNativeDriver: false,
            tension: 40,
            friction: 7,
          }).start();
        }
      }
    })
  ).current;

  const [liveStats, setLiveStats] = useState({
    crowd: 'Low',
    passengers: '0/70',
    speed: '0 km/h',
    arrival: new Date(Date.now() + 15 * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    distance: '8.5 km'
  });

  const lastMapUpdate = useRef(0);

  useEffect(() => {
    if (gpsCoords && webViewRef.current) {
      const now = Date.now();
      if (now - lastMapUpdate.current >= 10000) {
        const jsCode = `if (window.updateBusLocation) { window.updateBusLocation(${gpsCoords.lat}, ${gpsCoords.lng}); }`;
        webViewRef.current.injectJavaScript(jsCode);
        lastMapUpdate.current = now;
      }
    }
  }, [gpsCoords]);

  const handleMapLoadEnd = () => {
    if (gpsCoords && webViewRef.current) {
      const jsCode = `if (window.updateBusLocation) { window.updateBusLocation(${gpsCoords.lat}, ${gpsCoords.lng}); }`;
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  const handleSOS = async () => {
    try {
      const sosRef = ref(db, 'sos');
      const newSosRef = push(sosRef);
      await set(newSosRef, {
        ticketId: ticket.id,
        passengerName: ticket.seatReservations?.[0]?.passengerName || "Unknown Passenger",
        seatNumber: ticket.seatReservations?.[0]?.seatNumber || "N/A",
        timestamp: new Date().toLocaleString(),
        status: 'active'
      });
      Alert.alert('SOS Triggered', 'Emergency alert has been sent to the admin dashboard.');
    } catch (e) {
      Alert.alert('Error', 'Failed to send SOS alert.');
    }
  };

  // Geodesic coordinate tracking for client-side speed calculation (Haversine Formula)
  const prevLat = useRef(null);
  const prevLng = useRef(null);
  const prevTimestamp = useRef(null);

  // Haversine Geodesic Speed Calculator
  const calculateGeodesicSpeed = (lat1, lon1, lat2, lon2, timestamp1, timestamp2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    
    // If coordinates did not change, speed is exactly 0 km/h (Bus is at rest!)
    if (lat1 === lat2 && lon1 === lon2) return 0;

    // Calculate time difference in seconds
    let timeSeconds = 5; // Default to 5 seconds IoT broadcast standard
    if (timestamp1 && timestamp2) {
      try {
        const parseTime = (str) => {
          const parts = str.split(' ')[1].split(':');
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        };
        const sec1 = parseTime(timestamp1);
        const sec2 = parseTime(timestamp2);
        const diff = Math.abs(sec2 - sec1);
        if (diff >= 0 && diff < 300) {
          timeSeconds = diff;
        }
      } catch (e) {
      }
    }

    // Filter rapid duplicate updates (less than 3 seconds apart) to prevent noise amplification
    if (timeSeconds < 3) return 0;

    // Haversine Formula
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c; // Geodesic displacement distance

    // Filter GPS coordinate drift/jitter: any displacement less than 15 meters is considered at rest
    if (distanceKm < 0.015) return 0;

    // Velocity = distance / time (converted to km/h)
    const speedKmh = distanceKm / (timeSeconds / 3600);
    
    // Filter micro-displacements and slow crawl speeds
    if (speedKmh < 3.0) return 0;
    
    return Math.min(100, Math.round(speedKmh)); // Capped at 100km/h maximum
  };

  useEffect(() => {
    if (!visible || !ticket) return;

    // Start pulsing animation for expiry timer
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Timer calculation
    const calculateTimeLeft = () => {
      const difference = (ticket.createdAt + ticket.durationMs) - Date.now();
      if (difference <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }

      const totalSeconds = Math.floor(difference / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      const formattedMinutes = minutes.toString().padStart(2, '0');
      const formattedSeconds = seconds.toString().padStart(2, '0');
      
      setTimeLeft(`${formattedMinutes}:${formattedSeconds}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    // 1. Subscribe to /passengers
    const passRef = ref(db, 'passengers');
    const unsubPass = onValue(passRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const pCount = data.count || 0;
        
        // Calculate crowd density visually
        let crowd = 'Low';
        if (pCount >= 30) crowd = 'Medium';
        if (pCount >= 55) crowd = 'High';
        
        setLiveStats(prev => ({ ...prev, crowd, passengers: `${pCount}/70` }));
      }
    });

    // 2. Subscribe to /gps to calculate real-time speed
    const gpsRef = ref(db, 'gps');
    const unsubGps = onValue(gpsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const newLat = data.lat;
        const newLng = data.lng;
        const newTimestamp = data.timestamp;

        setGpsCoords({ lat: newLat, lng: newLng });

        if (prevLat.current !== null && prevLng.current !== null) {
          const s = calculateGeodesicSpeed(
            prevLat.current,
            prevLng.current,
            newLat,
            newLng,
            prevTimestamp.current,
            newTimestamp
          );
          setLiveStats(prev => ({ ...prev, speed: `${s} km/h` }));
        } else {
          setLiveStats(prev => ({ ...prev, speed: `0 km/h` }));
        }

        prevLat.current = newLat;
        prevLng.current = newLng;
        prevTimestamp.current = newTimestamp;
      }
    });

    return () => {
      clearInterval(interval);
      pulse.stop();
      unsubPass();
      unsubGps();
    };
  }, [visible, ticket]);

  if (!ticket) return null;

  // Render a real QR Code using an image API (avoiding native library crashes)
  const renderQRCodeSvg = () => {
    const qrData = encodeURIComponent(JSON.stringify({
      id: ticket.id,
      title: ticket.title,
      routeId: ticket.routeId,
      passengerName: ticket.seatReservations ? ticket.seatReservations[0]?.passengerName : "Passenger"
    }));
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrData}`;

    return (
      <View style={{ padding: 10, backgroundColor: '#FFFFFF', alignItems: 'center' }}>
        <Image
          source={{ uri: qrUrl }}
          style={{ width: 180, height: 180 }}
          resizeMode="contain"
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Styled background to simulate map representation beautifully */}
        <View style={[styles.mapSimulation, isFullscreen && { flex: 1 }]}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={StyleSheet.absoluteFillObject}
            onLoadEnd={handleMapLoadEnd}
            domStorageEnabled
            javaScriptEnabled
          />
        </View>

        {/* Ticket White Glass Box */}
        <Animated.View style={[styles.ticketContainer, { height: sheetHeight }]}>
          {/* Dedicated Drag Handle Bar */}
          <View {...panResponder.panHandlers} style={{ width: '100%', alignItems: 'center', paddingTop: 4, paddingBottom: 12 }}>
            <View style={{ width: 44, height: 5, backgroundColor: '#CBD5E1', borderRadius: 3 }} />
          </View>
          
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
            {/* Header Title & Close Button */}
            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#0F172A' }}>Live Tracking Stats</Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 2 }}>
                <Ionicons name="close-circle" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            {/* Onboarded Status & SOS */}
            <View style={styles.statusRow}>
              {ticket.onboarded ? (
                <View style={styles.onboardedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.onboardedText}>Onboarded</Text>
                </View>
              ) : (
                <View style={[styles.onboardedBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="time" size={14} color="#D97706" style={{ marginRight: 4 }} />
                  <Text style={[styles.onboardedText, { color: '#B45309' }]}>Not Onboarded</Text>
                </View>
              )}
              
              {ticket.onboarded && (
                <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
                  <Ionicons name="warning" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.sosText}>SOS</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Reviewer Note */}
            <View style={styles.reviewerNote}>
              <Ionicons name="ticket" size={14} color="#64748B" style={{ marginRight: 5 }} />
              <Text style={styles.reviewerText}>Show this ticket to the reviewer.</Text>
            </View>

            {/* QR Code Graphic wrapper */}
            <View style={styles.qrCodeWrapper}>
              {renderQRCodeSvg()}
            </View>

            {/* Ticket Details */}
            <View style={styles.ticketDetails}>
              <Text style={styles.ticketTitle}>
                {ticket.title} • {ticket.tariff}
              </Text>
              <Text style={styles.ticketMeta}>
                from {ticket.from} • {ticket.zones}
              </Text>
              <Text style={styles.ticketMetaSmall}>
                Arrival: {liveStats.arrival} • Distance: {liveStats.distance} left
              </Text>
            </View>

            {/* Live Bus Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{liveStats.crowd}</Text>
                <Text style={styles.statLabel}>Crowd</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{liveStats.passengers}</Text>
                <Text style={styles.statLabel}>Passengers</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{liveStats.speed}</Text>
                <Text style={styles.statLabel}>Speed</Text>
              </View>
            </View>

            {/* Expiry Countdown Card */}
            <Animated.View style={[styles.timerCard, { transform: [{ scale: pulseAnim }], width: '100%', marginBottom: 16 }]}>
              <Text style={styles.timerLabel}>Expires in</Text>
              <Text style={[
                styles.timerValue, 
                timeLeft === 'EXPIRED' ? styles.expiredText : null
              ]}>
                {timeLeft}
              </Text>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mapSimulation: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F1F5F9',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 24,
  },
  marketplaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
    marginRight: 10,
    maxWidth: 130,
    justifyContent: 'center',
  },
  marketplaceText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: '#475569',
  },
  closeBtn: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  ticketContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 10,
  },
  reviewerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    marginBottom: 24,
  },
  reviewerText: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: '#64748B',
  },
  qrCodeWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 24,
    borderColor: '#F1F5F9',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 24,
  },
  qrCodeSvg: {
    alignSelf: 'center',
  },
  ticketDetails: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ticketTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#0F172A',
    textAlign: 'center',
  },
  ticketMeta: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  timerCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
    borderWidth: 1,
    width: '100%',
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    color: '#166534',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#15803D',
    letterSpacing: 1,
  },
  expiredText: {
    color: '#B91C1C',
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 },
  onboardedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  onboardedText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#047857' },
  sosBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  sosText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#FFFFFF' },
  ticketMetaSmall: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, width: '100%', marginBottom: 20, justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#0F172A' },
  statLabel: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: '#64748B', marginTop: 2 },
  statDiv: { width: 1, height: 24, backgroundColor: '#E2E8F0' },
  floatingToggleBtn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#0F172A', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 30, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  floatingToggleText: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#FFFFFF' },
  collapseHandle: { width: '100%', alignItems: 'center', paddingBottom: 16, paddingTop: 4 },
  handleBar: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3 },
});

export default ActiveTicketModal;
