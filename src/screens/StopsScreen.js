import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue, set, runTransaction } from 'firebase/database';
import { db, auth } from '../config/firebase';
import WebView from '../components/WebMapView';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

// Premium Accents: Dominant Black/White, and Mild Green
const VIOLET = '#000000';
const VIOLET_LIGHT = '#F1F5F9';
const GREEN_MILD = '#10B981';
const GREEN_LIGHT = '#ECFDF5';

// Leaflet HTML template for Live GPS Tracking
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

const StopsScreen = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStopKey, setSelectedStopKey] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [routesActivity, setRoutesActivity] = useState({});
  
  // Real-time telemetry states
  const [gpsCoords, setGpsCoords] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState({
    speed: '0 km/h',
    passengers: '0/70',
    crowd: 'Low',
    distance: '3.4 km'
  });
  
  // Fullscreen Modal States
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedBusIsLive, setSelectedBusIsLive] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  
  const webViewRef = useRef(null);
  const modalWebViewRef = useRef(null);
  const fullscreenMapWebViewRef = useRef(null);

  // Speed math references
  const prevLat = useRef(null);
  const prevLng = useRef(null);
  const prevTimestamp = useRef(null);

  // Geodesic distance calculator (Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const getSpeed = (lat1, lon1, lat2, lon2, time1, time2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    if (lat1 === lat2 && lon1 === lon2) return 0;
    
    let delta = 5;
    if (time1 && time2) {
      try {
        const toSeconds = (s) => {
          const p = s.split(' ')[1].split(':');
          return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]);
        };
        const diff = Math.abs(toSeconds(time2) - toSeconds(time1));
        if (diff > 0 && diff < 300) delta = diff;
      } catch (e) {}
    }
    if (delta < 3) return 0;

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    const dist = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    
    if (dist < 0.015) return 0;
    const speed = dist / (delta / 3600);
    return speed < 3.0 ? 0 : Math.min(100, Math.round(speed));
  };

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords(loc.coords);
        }
      } catch (e) {}
    })();
  }, []);

  // Sync stops dynamically from Database routes
  useEffect(() => {
    const routesRef = ref(db, 'routes');
    const unsubRoutes = onValue(routesRef, (snap) => {
      setLoading(true);
      if (snap.exists()) {
        const routesVal = snap.val();
        const parsedRoutes = Object.keys(routesVal).map(key => ({
          id: key,
          ...routesVal[key]
        }));

        // Dynamically build a map of unique stops from routes
        const stopsMap = {};
        parsedRoutes.forEach((route) => {
          if (route.stops && route.stops.length > 0) {
            const routeFare = Math.round((route.totalDistance || 15) * 3.5 + 15);
            const mockEta = Math.floor(Math.random() * 15) + 3;

            route.stops.forEach((stop) => {
              const stopName = stop.name;
              const stopKey = stopName.toLowerCase().replace(/[^a-z0-9]/g, '_');
              
              if (!stopsMap[stopKey]) {
                stopsMap[stopKey] = {
                  name: stopName,
                  lat: stop.lat || 12.9716,
                  lng: stop.lng || 77.5946,
                  incomingBuses: []
                };
              }
              
              // Only add this route ONCE per stop (deduplicate)
              const alreadyAdded = stopsMap[stopKey].incomingBuses.some(b => b.routeId === route.id);
              if (!alreadyAdded) {
                stopsMap[stopKey].incomingBuses.push({
                  routeId: route.id,
                  route: route.name ? route.name.toUpperCase() : "SEC EXPRESS",
                  destination: route.stops[route.stops.length - 1].name,
                  eta: mockEta,
                  price: routeFare,
                  originalRoute: route
                });
              }
            });
          }
        });

        setStops(stopsMap);
        const keys = Object.keys(stopsMap);
        if (keys.length > 0 && !selectedStopKey) {
          setSelectedStopKey(keys[0]);
        }
      }
      setLoading(false);
    });

    // Sync Telemetry from Global GPS node
    const gpsRef = ref(db, 'gps');
    const unsubGps = onValue(gpsRef, (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setGpsCoords({ lat: d.lat, lng: d.lng });
        
        if (prevLat.current !== null && prevLng.current !== null) {
          const spd = getSpeed(prevLat.current, prevLng.current, d.lat, d.lng, prevTimestamp.current, d.timestamp);
          setLiveTelemetry(prev => ({ ...prev, speed: `${spd} km/h` }));
        }
        prevLat.current = d.lat;
        prevLng.current = d.lng;
        prevTimestamp.current = d.timestamp;
      }
    });

    // Sync Passenger crowd node
    const passRef = ref(db, 'passengers');
    const unsubPass = onValue(passRef, (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        const cnt = d.count || 0;
        let crowd = 'Low';
        if (cnt >= 30) crowd = 'Medium';
        if (cnt >= 55) crowd = 'High';
        setLiveTelemetry(prev => ({ ...prev, crowd, passengers: `${cnt}/70`, rawCount: cnt }));
      }
    });

    // Listen to active route ID
    const activeRouteRef = ref(db, 'system_status/active_route_id');
    const unsubActiveRoute = onValue(activeRouteRef, (snap) => {
      if (snap.exists()) setActiveRouteId(snap.val());
    });

    // Listen to routes_activity to get the name of the active route
    const routesActivityRef = ref(db, 'routes_activity');
    const unsubRoutesActivity = onValue(routesActivityRef, (snap) => {
      if (snap.exists()) setRoutesActivity(snap.val());
    });

    return () => {
      unsubRoutes();
      unsubGps();
      unsubPass();
      unsubActiveRoute();
      unsubRoutesActivity();
    };
  }, []);

  // Update inline map
  useEffect(() => {
    if (gpsCoords && webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.updateBusLocation) { window.updateBusLocation(${gpsCoords.lat}, ${gpsCoords.lng}); }`);
    }
  }, [gpsCoords]);

  // Update modal map
  useEffect(() => {
    if (gpsCoords && statusModalVisible && modalWebViewRef.current) {
      setTimeout(() => {
        modalWebViewRef.current?.injectJavaScript(`if (window.updateBusLocation) { window.updateBusLocation(${gpsCoords.lat}, ${gpsCoords.lng}); }`);
      }, 500);
    }
  }, [gpsCoords, statusModalVisible]);

  // Update student fullscreen map
  useEffect(() => {
    if (gpsCoords && mapFullscreen && fullscreenMapWebViewRef.current) {
      setTimeout(() => {
        fullscreenMapWebViewRef.current?.injectJavaScript(`if (window.updateBusLocation) { window.updateBusLocation(${gpsCoords.lat}, ${gpsCoords.lng}); }`);
      }, 500);
    }
  }, [gpsCoords, mapFullscreen]);

  // Calculate Geodesic Nearest Stop Key
  const getNearbyStopKey = () => {
    if (!userCoords || Object.keys(stops).length === 0) return Object.keys(stops)[0] || '';
    let minDistance = Infinity;
    let nearestKey = '';
    
    Object.keys(stops).forEach((key) => {
      const stop = stops[key];
      const dist = calculateDistance(userCoords.latitude, userCoords.longitude, stop.lat, stop.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestKey = key;
      }
    });
    return nearestKey;
  };

  // Autocomplete and Filter Stops
  const filteredStopKeys = Object.keys(stops).filter(key => 
    stops[key].name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedStop = stops[selectedStopKey] || { name: 'Select Stop', incomingBuses: [] };
  const nearbyStopKey = getNearbyStopKey();
  const nearbyStop = stops[nearbyStopKey] || null;

  // Handle Quick Ticket Booking
  const handleQuickBooking = async (bus) => {
    setStatusModalVisible(false);
    if (onNavigate) {
      onNavigate('home');
    } else {
      Alert.alert("Navigation Error", "Could not navigate to the Home screen.");
    }
  };

  const handleOpenBusStatus = (bus, isLive) => {
    setSelectedBus(bus);
    setSelectedBusIsLive(isLive);
    setStatusModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.screenHeader}>Stops & Routes</Text>

        {/* Autocomplete Search input */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={20} color="#000000" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search bus stops..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(txt) => {
              setSearchQuery(txt);
              const matched = Object.keys(stops).filter(k => 
                stops[k].name.toLowerCase().includes(txt.toLowerCase())
              );
              if (matched.length > 0) setSelectedStopKey(matched[0]);
            }}
          />
        </View>

        {/* Nearby Stop Badge Card (Premium Light Violet styling) */}
        {nearbyStop && (
          <TouchableOpacity style={styles.nearbyCard} onPress={() => setSelectedStopKey(nearbyStopKey)} activeOpacity={0.9}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.mildVioletDot} />
              <Text style={styles.nearbyLabel}>NEAREST STATION (GPS)</Text>
            </View>
            <Text style={styles.nearbyName}>{nearbyStop.name}</Text>
          </TouchableOpacity>
        )}

        {/* Stop Selector Tabs (Black & White Style with Violet accents) */}
        <Text style={styles.sectionTitle}>Select Station</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stopsTabs}>
          {filteredStopKeys.map((key) => {
            const stop = stops[key];
            const isSelected = selectedStopKey === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.stopTab, isSelected ? styles.stopTabSelected : null]}
                onPress={() => setSelectedStopKey(key)}
                activeOpacity={0.9}
              >
                <Ionicons
                  name="pin"
                  size={14}
                  color={isSelected ? VIOLET : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.stopTabText, isSelected ? styles.stopTabTxtSelected : null]}>
                  {stop.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Incoming Buses List */}
        <View style={styles.stopHeaderRow}>
          <Text style={styles.sectionTitle}>Incoming Buses</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE GPS SPEED</Text>
          </View>
        </View>

        {selectedStop.incomingBuses && selectedStop.incomingBuses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No incoming buses scheduled.</Text>
          </View>
        ) : (
          selectedStop.incomingBuses.map((bus, idx) => {
            // Direct route ID comparison with the active route from Driver Mode
            // Also fall back to name-based match for legacy routes_activity entries
            // whose keys may differ from the routes node keys
            const activeActivityData = activeRouteId ? routesActivity[activeRouteId] : null;
            const activeActivityName = activeActivityData ? (activeActivityData.routeName || "").toLowerCase() : "";
            const busRouteNameLower = (bus.route || "").toLowerCase();
            const isLiveByName = !!(
              activeRouteId &&
              activeActivityName &&
              busRouteNameLower &&
              (busRouteNameLower.includes(activeActivityName) || activeActivityName.includes(busRouteNameLower))
            );
            const isLive = (activeRouteId && bus.routeId === activeRouteId) || isLiveByName;

            // Get live count data from routes_activity for this bus's route
            // First try direct ID match; fall back to name-based match for legacy entries
            let routeActivityData = routesActivity[bus.routeId];
            if (!routeActivityData && isLiveByName && activeActivityData) {
              routeActivityData = activeActivityData;
            }
            
            // For the active live route, always use the real-time hardware count (like Admin Dashboard does)
            const liveCount = isLive ? (liveTelemetry.rawCount || 0) : (routeActivityData ? (routeActivityData.count || 0) : 0);
            const liveCapacity = routeActivityData ? (routeActivityData.capacity || 70) : 70;
            return (
              <TouchableOpacity key={idx} style={[styles.busItem, isLive && { borderLeftWidth: 3, borderLeftColor: GREEN_MILD }]} onPress={() => handleOpenBusStatus(bus, isLive)} activeOpacity={0.95}>
                {/* Route badge */}
                <View style={[styles.busRouteBadge, !isLive && { backgroundColor: '#94A3B8' }]}>
                  <Text style={styles.busRouteText}>{bus.route ? bus.route.charAt(0).toUpperCase() : 'B'}</Text>
                </View>

                {/* Transit Details */}
                <View style={styles.busDetails}>
                  <Text style={styles.busDest}>{bus.destination}</Text>
                  {isLive ? (
                    <>
                      <Text style={styles.busStopFrom}>{'🟢 Live • Tap for stats'}</Text>
                      <Text style={[styles.busStopFrom, { color: GREEN_MILD, fontFamily: 'Poppins_700Bold', marginTop: 2 }]}>
                        👥 {liveCount}/{liveCapacity} passengers
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.busStopFrom}>{'⬜ Not in service'}</Text>
                  )}
                </View>

                {/* ETA Display */}
                <View style={styles.etaContainer}>
                  {isLive ? (
                    <>
                      <Text style={styles.etaText}>in {bus.eta} min</Text>
                      <View style={styles.gpsRow}>
                        <Ionicons name="navigate" size={10} color={GREEN_MILD} style={{ marginRight: 3 }} />
                        <Text style={styles.gpsText}>GPS Active</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={[styles.etaText, { color: '#94A3B8', fontSize: 12 }]}>Off Route</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Live Map Inline Preview */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Live Route Tracking Map</Text>
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={StyleSheet.absoluteFillObject}
            onLoadEnd={() => {
              if (gpsCoords && webViewRef.current) {
                webViewRef.current.injectJavaScript(`if (window.updateBusLocation) { window.updateBusLocation(${gpsCoords.lat}, ${gpsCoords.lng}); }`);
              }
            }}
            domStorageEnabled
            javaScriptEnabled
          />
          {/* Fullscreen Map Button Overlay */}
          <TouchableOpacity style={styles.fullscreenMapTrigger} onPress={() => setMapFullscreen(true)}>
            <Ionicons name="expand" size={16} color="#000000" />
            <Text style={styles.fullscreenMapTriggerText}> Fullscreen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FULLSCREEN BUS STATUS & BOOKING MODAL */}
      {selectedBus && (
        <Modal visible={statusModalVisible} animationType="slide" transparent>
          <View style={styles.modalBg}>
            <View style={styles.modalContent}>
              {/* Fullscreen Map (Fills 100% of overlay background) */}
              <View style={styles.modalMapWrapper}>
                <WebView
                  ref={modalWebViewRef}
                  originWhitelist={['*']}
                  source={{ html: mapHtml }}
                  style={StyleSheet.absoluteFillObject}
                  domStorageEnabled
                  javaScriptEnabled
                />
                
                {/* Header Back Button Overlay */}
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setStatusModalVisible(false)}>
                  <Ionicons name="chevron-down" size={24} color="#000000" />
                </TouchableOpacity>

                {/* Floating Stats & Booking Section inside Fullscreen Map */}
                <View style={styles.modalStatsSection}>
                  <Text style={styles.modalBusTitle}>
                    Route {selectedBus.route} {selectedBusIsLive ? '🟢 Live' : '⬜ Inactive'}
                  </Text>
                  <Text style={styles.modalBusSub}>{selectedStop.name} → {selectedBus.destination}</Text>

                  {/* Grid stats */}
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{selectedBusIsLive ? liveTelemetry.speed : '0 km/h'}</Text>
                      <Text style={styles.statLabel}>Bus Speed</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      {/* Live route: show real hardware count. Inactive: show 0 */}
                      <Text style={styles.statVal}>{selectedBusIsLive ? liveTelemetry.passengers : '0/70'}</Text>
                      <Text style={styles.statLabel}>Occupancy</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>{liveTelemetry.crowd}</Text>
                      <Text style={styles.statLabel}>Crowd</Text>
                    </View>
                  </View>

                  {/* Book Ticket CTA (Rich Violet Background) */}
                  <TouchableOpacity style={styles.bookingCTA} onPress={() => handleQuickBooking(selectedBus)}>
                    <Ionicons name="ticket" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.bookingCTAText}>Book Ticket  ·  ₹{selectedBus.price}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* STUDENT FULLSCREEN MAP MODAL */}
      <Modal visible={mapFullscreen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <WebView
            ref={fullscreenMapWebViewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={StyleSheet.absoluteFillObject}
            onLoadEnd={() => {
              if (gpsCoords && fullscreenMapWebViewRef.current) {
                fullscreenMapWebViewRef.current.injectJavaScript(`if (window.updateBusLocation) { window.updateBusLocation(${gpsCoords.lat}, ${gpsCoords.lng}); }`);
              }
            }}
            domStorageEnabled
            javaScriptEnabled
          />
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMapFullscreen(false)}>
            <Ionicons name="close" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#000000',
    marginTop: 12,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 110,
  },
  screenHeader: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
    marginBottom: 20,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: '#000000',
    marginLeft: 10,
  },
  nearbyCard: {
    backgroundColor: VIOLET_LIGHT,
    borderColor: '#E9D5FF',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },
  mildVioletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VIOLET,
    marginRight: 6,
  },
  nearbyLabel: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    color: VIOLET,
    letterSpacing: 1,
  },
  nearbyName: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
    marginBottom: 12,
  },
  stopsTabs: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingBottom: 4,
  },
  stopTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    marginRight: 10,
  },
  stopTabSelected: {
    backgroundColor: VIOLET_LIGHT,
    borderColor: VIOLET,
  },
  stopTabText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#64748B',
  },
  stopTabTxtSelected: {
    color: '#000000',
  },
  stopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN_LIGHT,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderColor: '#D1FAE5',
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN_MILD,
    marginRight: 6,
  },
  liveText: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    color: '#047857',
    letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: '#64748B',
  },
  busItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
  },
  busRouteBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: VIOLET_LIGHT,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  busRouteText: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    color: VIOLET,
  },
  busDetails: {
    flex: 1,
  },
  busDest: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
  },
  busStopFrom: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  etaContainer: {
    alignItems: 'flex-end',
  },
  etaText: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  gpsText: {
    fontSize: 9,
    fontFamily: 'Poppins_600SemiBold',
    color: GREEN_MILD,
  },
  mapContainer: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalMapWrapper: {
    flex: 1,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#FFFFFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  modalStatsSection: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalBusTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
  },
  modalBusSub: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: '#64748B',
    marginTop: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Poppins_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  bookingCTA: {
    flexDirection: 'row',
    backgroundColor: VIOLET,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingCTAText: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    color: '#FFFFFF',
  },
  fullscreenMapTrigger: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  fullscreenMapTriggerText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: '#000000',
  },
});

export default StopsScreen;
