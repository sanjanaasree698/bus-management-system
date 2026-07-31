import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import {
  Bus,
  Gauge,
  Users,
  AlertCircle,
  AlertTriangle,
  User,
  Ticket,
  Armchair,
  ArrowDownCircle,
  ArrowUpCircle,
  LineChart,
  ClipboardList,
} from "lucide-react-native";
import WebView from "../components/WebMapView";
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
  Line,
  Text as SvgText,
} from "react-native-svg";
import { ref, onValue, set } from "firebase/database";
import { db } from "../config/firebase";
import { calculateSpeed, smoothSpeed } from "../config/gpsUtils";
import RouteVisualization from "../components/RouteVisualization";

const { width } = Dimensions.get("window");

// Premium Color Palette
const Colors = {
  primary: "#6366F1",
  primaryDark: "#4F46E5",
  primaryLight: "#EEF2FF",
  success: "#10B981",
  successLight: "#ECFDF5",
  warning: "#F59E0B",
  warningLight: "#FFFBEB",
  danger: "#EF4444",
  dangerLight: "#FEF2F2",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
};

const mapHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; background: #f1f5f9; }
    @keyframes pulse {
      0%   { transform: scale(1);   opacity: 0.8; }
      50%  { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(1);   opacity: 0; }
    }
    .bus-pulse {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: rgba(99,102,241,0.3);
      position: absolute;
      top: -6px; left: -6px;
      animation: pulse 2s ease-out infinite;
      pointer-events: none;
    }
    .bus-dot {
      position: relative;
      width: 36px; height: 36px;
      background: #6366F1;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(99,102,241,0.55);
      border: 2.5px solid white;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20, 78], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    var busIcon = L.divIcon({
      className: '',
      html: '<div style="position:relative;"><div class="bus-pulse"></div><div class="bus-dot"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18,11H6V6H18M16.5,17A1.5,1.5 0 0,1 15,15.5A1.5,1.5 0 0,1 16.5,14A1.5,1.5 0 0,1 18,15.5A1.5,1.5 0 0,1 16.5,17M7.5,17A1.5,1.5 0 0,1 6,15.5A1.5,1.5 0 0,1 7.5,14A1.5,1.5 0 0,1 9,15.5A1.5,1.5 0 0,1 7.5,17M4,16C4,16.88 4.39,17.67 5,18.22V20C5,20.55 5.45,21 6,21H7C7.55,21 8,20.55 8,20V19H16V20C16,20.55 16.45,21 17,21H18C18.55,21 19,20.55 19,20V18.22C19.61,17.67 20,16.88 20,16V6C20,2.5 16.42,2 12,2C7.58,2 4,2.5 4,6V16Z"/></svg></div></div>',
      iconSize: [36, 36], iconAnchor: [18, 18]
    });

    var marker = null;
    var trailCoords = [];
    var trailLine = L.polyline([], { color: '#6366F1', weight: 3, opacity: 0.45, dashArray: '6 8', lineJoin: 'round' }).addTo(map);

    window.updateMap = function(lat, lng) {
      if (lat === 0 && lng === 0) {
        if (marker) { map.removeLayer(marker); marker = null; }
        trailCoords = [];
        trailLine.setLatLngs([]);
        return;
      }
      var pos = [lat, lng];
      if (!marker) {
        marker = L.marker(pos, { icon: busIcon }).addTo(map);
      } else {
        marker.setLatLng(pos);
      }
      trailCoords.push(pos);
      if (trailCoords.length > 20) trailCoords.shift();
      trailLine.setLatLngs(trailCoords);
      map.panTo(pos, { animate: true, duration: 0.8, easeLinearity: 0.5 });
    };
  </script>
</body>
</html>
`;

const AdminDashboard = ({ onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [gpsTimestamp, setGpsTimestamp] = useState("");

  const [lastGpsReceiveTime, setLastGpsReceiveTime] = useState(Date.now());
  const [passengerCount, setPassengerCount] = useState(64);
  const [bookedSeats, setBookedSeats] = useState(68);
  const [speed, setSpeed] = useState(0);
  const [logsList, setLogsList] = useState([]);
  const [stopsList, setStopsList] = useState([]);
  const [routesData, setRoutesData] = useState({});
  const [selectedPredictiveStop, setSelectedPredictiveStop] = useState("");
  const [activeRoute, setActiveRoute] = useState(null);
  const [smoothedSpeed, setSmoothedSpeed] = useState(0);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [toastData, setToastData] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(100)).current;

  const prevLat = useRef(null);
  const prevLng = useRef(null);
  const prevTimestamp = useRef(null);
  const prevPassengerCount = useRef(null);
  const capacity = 70;
  const webViewRef = useRef(null);
  const webViewModalRef = useRef(null);

  // Prediction panel animation
  const predictionAnim = useRef(new Animated.Value(0)).current;

  // Toast System
  const showToast = (title, message, type = "info") => {
    const configs = {
      info: { icon: "info", color: Colors.primary, bg: Colors.primaryLight },
      success: {
        icon: "check-circle",
        color: Colors.success,
        bg: Colors.successLight,
      },
      warning: {
        icon: "alert-circle",
        color: Colors.warning,
        bg: Colors.warningLight,
      },
      error: { icon: "x-circle", color: Colors.danger, bg: Colors.dangerLight },
    };

    setToastData({ title, message, ...configs[type] });

    Animated.parallel([
      Animated.spring(toastOpacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(toastTranslateY, { toValue: 0, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToastData(null));
    }, 3500);
  };

  // Speed Calculation
  const calculateGeodesicSpeed = (
    lat1,
    lon1,
    lat2,
    lon2,
    timestamp1,
    timestamp2,
  ) => {
    return calculateSpeed(lat1, lon1, lat2, lon2, timestamp1, timestamp2);
  };

  // Latency Timer
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setIsOffline(Date.now() - lastGpsReceiveTime > 10000);
    }, 5000);
    return () => clearInterval(timer);
  }, [lastGpsReceiveTime]);

  // Animate prediction panel in/out when stop selection changes
  useEffect(() => {
    if (selectedPredictiveStop) {
      predictionAnim.setValue(0);
      Animated.spring(predictionAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 140,
        mass: 0.8,
      }).start();
    } else {
      Animated.timing(predictionAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedPredictiveStop]);

  // Real-time Map Update — fires on every GPS change from Firebase
  useEffect(() => {
    const jsCode = `if (window.updateMap) { window.updateMap(${lat}, ${lng}); }`;
    if (webViewRef.current) webViewRef.current.injectJavaScript(jsCode);
    if (webViewModalRef.current)
      webViewModalRef.current.injectJavaScript(jsCode);
  }, [lat, lng]);

  // Firebase Sync
  useEffect(() => {
    const gpsRef = ref(db, "gps");
    const passengersRef = ref(db, "passengers");
    const logsRef = ref(db, "logs");
    const routesRef = ref(db, "routes");
    const sosRef = ref(db, "sos");

    const unsubscribeSos = onValue(sosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const alerts = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
        const activeAlerts = alerts.filter((a) => a.status === "active");
        if (activeAlerts.length > 0) {
          const latest = activeAlerts[activeAlerts.length - 1];
          Alert.alert(
            "🚨 EMERGENCY SOS 🚨",
            `Passenger: ${latest.passengerName}\nSeat: ${latest.seatNumber}\nTicket ID: ${latest.ticketId}\nTime: ${latest.timestamp}`,
            [
              {
                text: "Acknowledge",
                onPress: () => {
                  set(ref(db, `sos/${latest.id}/status`), "acknowledged");
                },
              },
            ],
          );
        }
      }
    });

    const unsubscribeGps = onValue(gpsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newLat = data.lat ?? 0;
        const newLng = data.lng ?? 0;
        const newTimestamp = data.timestamp || "";

        setLat(newLat);
        setLng(newLng);
        setGpsTimestamp(newTimestamp);

        if (prevLat.current !== null && prevLng.current !== null) {
          const calculatedSpeed = calculateGeodesicSpeed(
            prevLat.current,
            prevLng.current,
            newLat,
            newLng,
            prevTimestamp.current,
            newTimestamp,
          );
          const smooth = smoothSpeed(calculatedSpeed, smoothedSpeed, 0.4);
          setSpeed(calculatedSpeed);
          setSmoothedSpeed(smooth);
        }

        prevLat.current = newLat;
        prevLng.current = newLng;
        prevTimestamp.current = newTimestamp;
      }
      setLastGpsReceiveTime(Date.now());
      setLoading(false);
    });

    const unsubscribePassengers = onValue(passengersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newCount = data.count ?? 0;
        const newBooked = data.booked ?? 0;

        setPassengerCount(newCount);
        setBookedSeats(newBooked);

        if (
          prevPassengerCount.current !== null &&
          prevPassengerCount.current !== newCount
        ) {
          const diff = newCount - prevPassengerCount.current;
          if (diff > 0) {
            showToast(
              "Boarding Detected",
              `${diff} passenger(s) entered`,
              "info",
            );
          } else if (diff < 0) {
            showToast(
              "Exit Detected",
              `${Math.abs(diff)} passenger(s) left`,
              "warning",
            );
          }
        }
        prevPassengerCount.current = newCount;
      } else {
        setPassengerCount(0);
        setBookedSeats(0);
        prevPassengerCount.current = 0;
      }
    });

    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.keys(data)
          .map((key) => {
            if (key === "count") return null;
            const item = data[key];
            return {
              id: key.replace("log_", ""),
              type: item.type || "ENTRY",
              count: item.passengerCount ?? 0,
              time: item.timestamp?.split(" ")[1] || "00:00:00",
              date: item.timestamp?.split(" ")[0] || "25/05/2026",
              route_id: item.route_id || null,
              passengerCount: item.passengerCount ?? 0,
              scannedAt: item.scannedAt || null,
              ticketId: item.ticketId || key,
              timestamp: item.timestamp || ""
            };
          })
          .filter(Boolean)
          .sort((a, b) => parseInt(b.id) - parseInt(a.id));
        setLogsList(parsed);
      }
    });

    const unsubscribeRoutes = onValue(routesRef, (snap) => {
      if (snap.exists()) {
        const routesVal = snap.val();
        setRoutesData(routesVal);
        const parsed = Object.keys(routesVal).map((k) => ({
          id: k,
          ...routesVal[k],
        }));

        if (parsed.length > 0 && !activeRoute) {
          setActiveRoute(parsed[0]);
        }

        const stopsMap = {};
        parsed.forEach((r) => {
          r.stops?.forEach((s) => {
            stopsMap[s.name] = {
              name: s.name,
              lat: s.lat || 12.9716,
              lng: s.lng || 77.5946,
            };
          });
        });

        const list = Object.values(stopsMap);
        setStopsList(list);
        if (list.length > 0 && !selectedPredictiveStop) {
          setSelectedPredictiveStop(list[0].name);
        }
      }
    });

    return () => {
      unsubscribeGps();
      unsubscribePassengers();
      unsubscribeLogs();
      unsubscribeRoutes();
      unsubscribeSos();
    };
  }, []);

  const handleReset = () => {
    Alert.alert(
      "Reset System",
      "Clear all live data and reset passenger count?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await set(ref(db, "passengers"), { count: 0, booked: 0 });
              await set(ref(db, "logs"), {
                log_0: {
                  passengerCount: 0,
                  timestamp: "25/05/2026 00:00:00",
                  type: "RESET",
                },
              });
              showToast(
                "System Reset",
                "Console cleared successfully",
                "success",
              );
            } catch (error) {
              showToast("Error", error.message, "error");
            }
          },
        },
      ],
    );
  };

  const secondsSinceLastGps = Math.floor(
    (Date.now() - lastGpsReceiveTime) / 1000,
  );
  const occupancyPercent = Math.round((passengerCount / capacity) * 100);
  const seatsAvailable = capacity - passengerCount;
  const timeToFull = seatsAvailable > 0 ? (seatsAvailable / 1.8).toFixed(1) : 0;

  const occupancyConfig =
    occupancyPercent > 80
      ? {
          label: "High Density",
          color: Colors.danger,
          bg: Colors.dangerLight,
          IconComponent: Users,
        }
      : occupancyPercent >= 40
        ? {
            label: "Moderate",
            color: Colors.warning,
            bg: Colors.warningLight,
            IconComponent: Users,
          }
        : {
            label: "Low Density",
            color: Colors.success,
            bg: Colors.successLight,
            IconComponent: User,
          };

  // Predictive Data
  const getPredictiveData = () => {
    if (!selectedPredictiveStop)
      return { expectedIn: 0, expectedOut: 0, projected: passengerCount };

    const routesArr = Object.values(routesData || {});
    let isStart = false,
      isEnd = false,
      baseTrend = 0;

    routesArr.forEach((r) => {
      if (r.stops?.length > 0) {
        if (r.stops[0].name === selectedPredictiveStop) isStart = true;
        if (r.stops[r.stops.length - 1].name === selectedPredictiveStop)
          isEnd = true;
      }
      if (r.stops?.some((s) => s.name === selectedPredictiveStop)) {
        baseTrend += parseInt(r.bookingCount || 0);
      }
    });

    const hash = selectedPredictiveStop
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    const expectedIn = isEnd ? 0 : Math.max(2, ((baseTrend + hash) % 8) + 2);
    const expectedOut = isStart
      ? 0
      : Math.min(passengerCount, Math.max(1, ((baseTrend * 2 + hash) % 5) + 1));
    const projected = 0;

    return { expectedIn, expectedOut, projected };
  };

  const predictiveData = getPredictiveData();

  // Donut Chart
  const DonutChart = ({ percent, color, size = 100 }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;

    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={Colors.borderLight}
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={{ position: "absolute" }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: color }}>
            {percent}%
          </Text>
        </View>
      </View>
    );
  };

  // Area Chart
  const AreaChart = ({ data, color, height = 140 }) => {
    const w = width - 64;
    const pad = 16;
    const h = height - pad * 2;
    const max = Math.max(...data, 10);

    const pts = data.map((v, i) => ({
      x: pad + (i / (data.length - 1)) * (w - pad * 2),
      y: pad + h - (v / max) * h,
    }));

    const pathData = pts.reduce(
      (acc, pt, i) =>
        i === 0 ? `M ${pt.x} ${pt.y}` : acc + ` L ${pt.x} ${pt.y}`,
      "",
    );

    const areaData = `${pathData} L ${pts[pts.length - 1].x} ${height - pad} L ${pts[0].x} ${height - pad} Z`;

    return (
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        <Path d={areaData} fill="url(#grad)" />
        <Path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((pt, i) => (
          <Circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="3"
            fill="#FFF"
            stroke={color}
            strokeWidth="2"
          />
        ))}
      </Svg>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Bus size={22} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>Real-time updates</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={handleReset}>
            <MaterialIcons
              name="refresh"
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Feather name="log-out" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status Banner */}
        <View style={[styles.statusCard]}>
          <View style={styles.statusContent}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOffline ? Colors.danger : Colors.success },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {isOffline ? "GPS Signal Lost" : "System Operational"}
              </Text>
              <Text style={styles.statusSubtitle} numberOfLines={1}>
                {isOffline
                  ? `Last seen ${secondsSinceLastGps}s ago`
                  : `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isOffline
                  ? Colors.dangerLight
                  : Colors.successLight,
              },
            ]}
          >
            <View
              style={[
                styles.badgeDot,
                { backgroundColor: isOffline ? Colors.danger : Colors.success },
              ]}
            />
            <Text
              style={[
                styles.badgeText,
                { color: isOffline ? Colors.danger : Colors.success },
              ]}
            >
              {isOffline ? "OFFLINE" : "LIVE"}
            </Text>
          </View>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View
              style={[styles.kpiIcon, { backgroundColor: Colors.primaryLight }]}
            >
              <Gauge size={20} color={Colors.primary} />
            </View>
            <Text style={styles.kpiValue}>
              {isOffline ? "0" : smoothedSpeed}
              <Text style={styles.kpiUnit}> km/h</Text>
            </Text>
            <Text style={styles.kpiLabel}>Speed</Text>
          </View>

          <View style={styles.kpiCard}>
            <View
              style={[styles.kpiIcon, { backgroundColor: occupancyConfig.bg }]}
            >
              <occupancyConfig.IconComponent
                size={20}
                color={occupancyConfig.color}
              />
            </View>
            <Text style={styles.kpiValue}>
              {passengerCount}
              <Text style={styles.kpiUnit}>/{capacity}</Text>
            </Text>
            <Text style={styles.kpiLabel}>{occupancyConfig.label}</Text>
          </View>
        </View>

        {/* Map Section */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.sectionTitle}>Live Tracking</Text>
            <View
              style={[
                styles.livePill,
                { backgroundColor: isOffline ? Colors.dangerLight : "#DCFCE7" },
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor: isOffline ? Colors.danger : Colors.success,
                  },
                ]}
              />
              <Text
                style={[
                  styles.livePillText,
                  { color: isOffline ? Colors.danger : "#15803D" },
                ]}
              >
                {isOffline ? "OFFLINE" : "LIVE"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setMapFullscreen(true)}
            style={styles.sectionAction}
          >
            <Feather name="maximize-2" size={14} color={Colors.primary} />
            <Text style={styles.sectionActionText}>Fullscreen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            style={styles.mapWebView}
            scrollEnabled={false}
            javaScriptEnabled={true}
            onLoadEnd={() => {
              const jsCode = `if (window.updateMap) { window.updateMap(${lat}, ${lng}); }`;
              webViewRef.current?.injectJavaScript(jsCode);
            }}
          />
        </View>

        {/* Analytics Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Occupancy Analytics</Text>
        </View>

        <View style={styles.analyticsRow}>
          <View style={[styles.card, styles.donutCard]}>
            <DonutChart
              percent={occupancyPercent}
              color={occupancyConfig.color}
            />
            <Text style={styles.donutLabel}>Occupied</Text>
          </View>

          <View style={styles.statsColumn}>
            <View
              style={[styles.statCard, { backgroundColor: Colors.surface }]}
            >
              <View style={styles.statHeader}>
                <Ticket size={16} color={Colors.primary} />
                <Text style={styles.statLabel}>Booked</Text>
              </View>
              <Text style={styles.statValue}>{bookedSeats} seats</Text>
            </View>

            <View
              style={[styles.statCard, { backgroundColor: Colors.surface }]}
            >
              <View style={styles.statHeader}>
                <Armchair
                  size={16}
                  color={seatsAvailable === 0 ? Colors.danger : Colors.success}
                />
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      seatsAvailable === 0 ? Colors.danger : Colors.success,
                  },
                ]}
              >
                {seatsAvailable} seats
              </Text>
            </View>

            <View
              style={[styles.statCard, { backgroundColor: Colors.surface }]}
            >
              <View style={styles.statHeader}>
                <Feather name="trending-up" size={16} color={Colors.warning} />
                <Text style={styles.statLabel}>Time to Fill</Text>
              </View>
              <Text style={[styles.statValue, { color: Colors.warning }]}>
                {seatsAvailable === 0 ? "Full" : `${timeToFull}m`}
              </Text>
            </View>
          </View>
        </View>

        {/* Prediction Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Station Predictions</Text>
        </View>

        <View style={styles.card}>
          <FlatList
            data={stopsList}
            keyExtractor={(_, i) => i.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentContainerStyle={{ paddingBottom: 14, paddingRight: 8 }}
            renderItem={({ item: stop }) => {
              const active = selectedPredictiveStop === stop.name;
              return (
                <TouchableOpacity
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    setSelectedPredictiveStop(active ? "" : stop.name)
                  }
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {stop.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {selectedPredictiveStop ? (
            <Animated.View
              style={[
                styles.predictionGrid,
                {
                  opacity: predictionAnim,
                  transform: [
                    {
                      scale: predictionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.93, 1],
                      }),
                    },
                    {
                      translateY: predictionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.predictionItem}>
                <ArrowDownCircle size={28} color={Colors.success} />
                <Text style={styles.predictionValue}>
                  +{predictiveData.expectedIn}
                </Text>
                <Text style={styles.predictionLabel}>Boarding</Text>
              </View>
              <View style={styles.predictionDivider} />
              <View style={styles.predictionItem}>
                <ArrowUpCircle size={28} color={Colors.danger} />
                <Text style={styles.predictionValue}>
                  -{predictiveData.expectedOut}
                </Text>
                <Text style={styles.predictionLabel}>Alighting</Text>
              </View>
              <View style={styles.predictionDivider} />
              <View style={styles.predictionItem}>
                <LineChart size={28} color={Colors.primary} />
                <Text style={styles.predictionValue}>
                  {predictiveData.projected}/70
                </Text>
                <Text style={styles.predictionLabel}>Projected</Text>
              </View>
            </Animated.View>
          ) : null}
        </View>

        {/* Trend Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Load Trend</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Hourly Occupancy</Text>
            <View style={styles.legend}>
              <View
                style={[styles.legendDot, { backgroundColor: Colors.primary }]}
              />
              <Text style={styles.legendText}>Passengers</Text>
            </View>
          </View>
          <AreaChart data={[12, 24, 35, 48, 52, 64]} color={Colors.primary} />
          <View style={styles.chartFooter}>
            {["07:22", "07:42", "08:02", "08:22", "Now"].map((t, i) => (
              <Text
                key={i}
                style={[
                  styles.chartTimeLabel,
                  i === 4 && { color: Colors.primary, fontWeight: "700" },
                ]}
              >
                {t}
              </Text>
            ))}
          </View>
        </View>

        {/* Route 1 Activity Log */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Route 1 Activity Log</Text>
        </View>
        {(() => {
          const route1Log = logsList.find(log => log.route_id === "Route 1" || log.route_id === "route1");
          if (!route1Log) {
            return (
              <View style={[styles.card, styles.emptyCard]}>
                <ClipboardList size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No activity recorded for Route 1</Text>
              </View>
            );
          }
          return (
            <View style={styles.logItem}>
              <View
                style={[
                  styles.logIndicator,
                  { backgroundColor: route1Log.type === "ENTRY" ? Colors.success : route1Log.type === "EXIT" ? Colors.danger : Colors.warning },
                ]}
              />
              <View style={styles.logContent}>
                <Text style={styles.logType}>
                  {route1Log.type === "ENTRY" ? "Boarding" : route1Log.type === "EXIT" ? "Alighting" : "System"}
                </Text>
                <Text style={styles.logDetail}>54 passengers</Text>
              </View>
              <View style={styles.logRight}>
                <Text style={styles.logTime}>{route1Log.time}</Text>
                <Text style={styles.logId}>#300</Text>
              </View>
            </View>
          );
        })()}

        {/* Route 2 Activity Log */}
        <View style={[styles.sectionHeader, { marginTop: 15 }]}>
          <Text style={styles.sectionTitle}>Route 2 Activity Log</Text>
        </View>
        {(() => {
          const route2Log = logsList.find(log => log.route_id === "Route 2" || log.route_id === "route2");
          if (!route2Log) {
            return (
              <View style={[styles.card, styles.emptyCard]}>
                <ClipboardList size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No activity recorded for Route 2</Text>
              </View>
            );
          }
          return (
            <View style={styles.logItem}>
              <View
                style={[
                  styles.logIndicator,
                  { backgroundColor: route2Log.type === "ENTRY" ? Colors.success : route2Log.type === "EXIT" ? Colors.danger : Colors.warning },
                ]}
              />
              <View style={styles.logContent}>
                <Text style={styles.logType}>
                  {route2Log.type === "ENTRY" ? "Boarding" : route2Log.type === "EXIT" ? "Alighting" : "System"}
                </Text>
                <Text style={styles.logDetail}>{route2Log.count} passengers</Text>
              </View>
              <View style={styles.logRight}>
                <Text style={styles.logTime}>{route2Log.time}</Text>
                <Text style={styles.logId}>#{route2Log.id}</Text>
              </View>
            </View>
          );
        })()}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Fleet Command Center v2.0</Text>
        </View>
      </ScrollView>

      {/* Fullscreen Map Modal */}
      <Modal visible={mapFullscreen} animationType="slide">
        <View style={styles.fullscreenContainer}>
          <WebView
            ref={webViewModalRef}
            originWhitelist={["*"]}
            source={{ html: mapHTML }}
            style={StyleSheet.absoluteFillObject}
            scrollEnabled={false}
            javaScriptEnabled={true}
            onLoadEnd={() => {
              const jsCode = `if (window.updateMap) { window.updateMap(${lat}, ${lng}); }`;
              webViewModalRef.current?.injectJavaScript(jsCode);
            }}
          />

          {/* Close */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setMapFullscreen(false)}
          >
            <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* Bottom info card */}
          <View style={styles.fullscreenOverlay}>
            <View style={styles.fullscreenInfoCard}>
              {/* Row 1 — title + status */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: Colors.textPrimary,
                  }}
                >
                  Fleet Monitor
                </Text>
                <View
                  style={[
                    styles.livePill,
                    {
                      backgroundColor: isOffline
                        ? Colors.dangerLight
                        : "#DCFCE7",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.liveDot,
                      {
                        backgroundColor: isOffline
                          ? Colors.danger
                          : Colors.success,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.livePillText,
                      { color: isOffline ? Colors.danger : "#15803D" },
                    ]}
                  >
                    {isOffline ? "OFFLINE" : "LIVE GPS"}
                  </Text>
                </View>
              </View>
              {/* Row 2 — metrics grid */}
              <View style={{ flexDirection: "row", gap: 0 }}>
                <View style={styles.fsMetric}>
                  <Gauge size={18} color={Colors.primary} />
                  <Text style={styles.fsMetricVal}>
                    {isOffline ? "—" : smoothedSpeed}
                  </Text>
                  <Text style={styles.fsMetricLbl}>km/h</Text>
                </View>
                <View style={styles.fsMetricDivider} />
                <View style={styles.fsMetric}>
                  <Users size={18} color={occupancyConfig.color} />
                  <Text
                    style={[
                      styles.fsMetricVal,
                      { color: occupancyConfig.color },
                    ]}
                  >
                    {passengerCount}
                  </Text>
                  <Text style={styles.fsMetricLbl}>On Board</Text>
                </View>
                <View style={styles.fsMetricDivider} />
                <View style={styles.fsMetric}>
                  <Feather
                    name="map-pin"
                    size={18}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.fsMetricVal}>{lat.toFixed(4)}</Text>
                  <Text style={styles.fsMetricLbl}>Latitude</Text>
                </View>
                <View style={styles.fsMetricDivider} />
                <View style={styles.fsMetric}>
                  <Feather
                    name="map-pin"
                    size={18}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.fsMetricVal}>{lng.toFixed(4)}</Text>
                  <Text style={styles.fsMetricLbl}>Longitude</Text>
                </View>
              </View>
              {/* Row 3 — timestamp */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 12,
                  gap: 6,
                }}
              >
                <Feather name="clock" size={12} color={Colors.textTertiary} />
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textTertiary,
                    fontWeight: "500",
                  }}
                >
                  Last fix: {gpsTimestamp}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
      {toastData && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <View style={styles.toastCard}>
            <View style={[styles.toastIcon, { backgroundColor: toastData.bg }]}>
              <Feather
                name={toastData.icon}
                size={18}
                color={toastData.color}
              />
            </View>
            <View style={styles.toastContent}>
              <Text style={styles.toastTitle}>{toastData.title}</Text>
              <Text style={styles.toastMessage}>{toastData.message}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: width * 0.8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  loadingIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  loadingSubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.dangerLight,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  statusSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  kpiUnit: {
    fontSize: 11,
    fontWeight: "400",
    color: Colors.textTertiary,
  },
  kpiLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  routeBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  mapContainer: {
    height: 240,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  mapWebView: {
    flex: 1,
  },
  mapTimestampOverlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(238,242,255,0.96)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.15)",
  },
  mapTimestampText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  fsMetric: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  fsMetricVal: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 4,
  },
  fsMetricLbl: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fsMetricDivider: {
    width: 1,
    backgroundColor: Colors.border,
    alignSelf: "stretch",
    marginHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  analyticsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  donutCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  donutLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 8,
  },
  statsColumn: {
    flex: 1,
    gap: 8,
  },
  statCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  chipScroll: {
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.surface,
  },
  predictionGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  predictionItem: {
    alignItems: "center",
  },
  predictionValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 8,
  },
  predictionLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  predictionDivider: {
    width: 1,
    height: 50,
    backgroundColor: Colors.border,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  chartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 12,
  },
  chartTimeLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  logCount: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 12,
  },
  logItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logIndicator: {
    width: 3,
    height: 32,
    borderRadius: 1.5,
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logType: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  logDetail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logRight: {
    alignItems: "flex-end",
  },
  logTime: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  logId: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  fullscreenOverlay: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  fullscreenInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  infoRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  infoDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  toastContainer: {
    position: "absolute",
    bottom: 30,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  toastIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  toastMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

export default AdminDashboard;
