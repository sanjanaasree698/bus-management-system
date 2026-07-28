import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  SafeAreaView,
  Animated,
} from "react-native";
import {
  Feather,
  MaterialIcons,
} from "@expo/vector-icons";
import { Route as RouteIcon, BusFront, Map, ArrowRight, MapPin } from "lucide-react-native";
import WebView from "../components/WebMapView";
import { ref, onValue, set, push, remove } from "firebase/database";
import { db } from "../config/firebase";
import DateTimePicker from "@react-native-community/datetimepicker";

const { width } = Dimensions.get("window");

// Professional Design System
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

const RouteSetterScreen = ({ onLogout }) => {
  // Navigation & UI States
  const [loading, setLoading] = useState(true);
  const [routesList, setRoutesList] = useState([]);
  const [isBuilderMode, setIsBuilderMode] = useState(false);
  const [viewRouteModalVisible, setViewRouteModalVisible] = useState(false);
  const [selectedInspectRoute, setSelectedInspectRoute] = useState(null);

  // Form States
  const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [routeName, setRouteName] = useState("");
  const [schedules, setSchedules] = useState([
    { depTime: "", arrTime: "", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  ]);
  const [pinnedStops, setPinnedStops] = useState([]);

  // Time Picker
  const [timePickerConfig, setTimePickerConfig] = useState(null);

  // Location Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Pin Modal
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [draftCoords, setDraftCoords] = useState(null);
  const [draftStopName, setDraftStopName] = useState("");

  // Fullscreen Map
  const [fullscreenMapVisible, setFullscreenMapVisible] = useState(false);
  const [fullscreenMapType, setFullscreenMapType] = useState(null); // 'builder' | 'inspect'
  const fullscreenWebViewRef = useRef(null);

  const builderWebViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleOpenFullscreen = (type) => {
    setFullscreenMapType(type);
    setFullscreenMapVisible(true);
  };

  const handleCloseFullscreen = () => {
    setFullscreenMapVisible(false);
    setFullscreenMapType(null);
  };

  // Handle messages from fullscreen builder map
  const handleFullscreenWebViewMessage = (event) => {
    try {
      const eventData = JSON.parse(event.nativeEvent.data);
      if (eventData.type === 'MAP_CLICK') {
        const { lat, lng } = eventData;
        setDraftCoords({ lat, lng });
        const stopIndex = pinnedStops.length;
        setDraftStopName(stopIndex === 0 ? 'Origin Station' : `Stop ${stopIndex + 1}`);
        setPinModalVisible(true);
      }
    } catch (e) {}
  };

  // Format time helper
  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Firebase Sync
  useEffect(() => {
    const routesRef = ref(db, "routes");
    const unsubscribe = onValue(
      routesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const parsed = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setRoutesList(parsed);
        } else {
          setRoutesList([]);
        }
        setLoading(false);

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      },
      (error) => {
        console.error("Firebase subscription failed: - RouteSetterScreen.js:146", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // Haversine Distance Calculation
  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getTotalDistance = (stops) => {
    if (stops.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      sum += calculateHaversineDistance(
        stops[i].lat,
        stops[i].lng,
        stops[i + 1].lat,
        stops[i + 1].lng,
      );
    }
    return parseFloat(sum.toFixed(2));
  };

  // Geocoding Search
  const handleLocationSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(
        "Search Query Required",
        "Please enter a location to search.",
      );
      return;
    }
    setSearching(true);
    setSearchResults([]);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=in`,
        {
          headers: {
            "User-Agent": "SavitaBusRoutePlanner/1.0",
          },
        },
      );
      const data = await response.json();
      if (data && data.length > 0) {
        setSearchResults(data);
      } else {
        Alert.alert(
          "No Results",
          "No locations found. Try adding city name for better context.",
        );
      }
    } catch (error) {
      Alert.alert("Search Error", "Unable to connect to geocoding service.");
    } finally {
      setSearching(false);
    }
  };

  // Map Click Handler
  const handleWebViewMessage = (event) => {
    try {
      const eventData = JSON.parse(event.nativeEvent.data);
      if (eventData.type === "MAP_CLICK") {
        const { lat, lng } = eventData;
        setDraftCoords({ lat, lng });
        const stopIndex = pinnedStops.length;
        setDraftStopName(
          stopIndex === 0 ? "Origin Station" : `Stop ${stopIndex + 1}`,
        );
        setPinModalVisible(true);
      }
    } catch (e) {
      console.warn("Map message parse error: - RouteSetterScreen.js:233", e);
    }
  };

  // Pin Confirmation
  const handleConfirmPin = () => {
    if (!draftStopName.trim()) {
      Alert.alert("Name Required", "Please provide a name for this stop.");
      return;
    }
    const newStop = {
      name: draftStopName.trim(),
      lat: parseFloat(draftCoords.lat),
      lng: parseFloat(draftCoords.lng),
    };
    setPinnedStops([...pinnedStops, newStop]);
    setPinModalVisible(false);
    setDraftCoords(null);
    setDraftStopName("");
    setSearchQuery("");
    setSearchResults([]);
  };

  // Search Result Selection
  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (builderWebViewRef.current) {
      const flyJs = `map.flyTo([${lat}, ${lon}], 16);`;
      builderWebViewRef.current.injectJavaScript(flyJs);
    }

    setDraftCoords({ lat, lng: lon });
    setDraftStopName(result.display_name.split(",")[0]);
    setPinModalVisible(true);
  };

  // Stop Management
  const handleRemoveStop = (indexToRemove) => {
    const updated = pinnedStops.filter((_, idx) => idx !== indexToRemove);
    setPinnedStops(updated);
  };

  const handleClearStops = () => {
    if (pinnedStops.length === 0) return;
    Alert.alert("Clear All Stops", "Remove all pinned stops from the route?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => setPinnedStops([]),
      },
    ]);
  };

  // Save Route
  const handleSaveRoute = async () => {
    if (!routeName.trim()) {
      Alert.alert("Incomplete", "Please enter a route name.");
      return;
    }
    if (
      schedules.some((s) => !s.depTime || !s.arrTime || s.days.length === 0)
    ) {
      Alert.alert("Incomplete", "Please complete all schedule details.");
      return;
    }
    if (pinnedStops.length < 2) {
      Alert.alert(
        "Incomplete",
        "Add at least 2 stops (origin and destination).",
      );
      return;
    }

    setLoading(true);
    try {
      const routesRef = ref(db, "routes");
      const newRouteRef = push(routesRef);

      const payload = {
        name: routeName.trim(),
        schedules,
        stops: pinnedStops,
        totalDistance: getTotalDistance(pinnedStops),
        createdAt: new Date().toISOString(),
      };

      await set(newRouteRef, payload);

      setRouteName("");
      setSchedules([
        { depTime: "", arrTime: "", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
      ]);
      setPinnedStops([]);
      setIsBuilderMode(false);

      Alert.alert("Success", "Route published successfully.");
    } catch (e) {
      Alert.alert("Error", "Failed to save route: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Route
  const handleDeleteRoute = (id, name) => {
    Alert.alert("Delete Route", `Permanently delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await remove(ref(db, `routes/${id}`));
          } catch (e) {
            Alert.alert("Error", "Deletion failed: " + e.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // Builder Map HTML
  const generateBuilderMapHtml = () => {
    const initialLat =
      pinnedStops.length > 0 ? pinnedStops[pinnedStops.length - 1].lat : 13.12;
    const initialLng =
      pinnedStops.length > 0 ? pinnedStops[pinnedStops.length - 1].lng : 80.14;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <title>Route Builder</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html, #map { width: 100%; height: 100%; }
          .stop-marker {
            background: ${Colors.primary};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2px solid #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(99, 102, 241, 0.3);
            font-size: 11px;
            font-weight: 700;
            color: #FFFFFF;
          }
          .stop-marker.terminal {
            background: ${Colors.success};
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: true, tap: false }).setView([${initialLat}, ${initialLng}], 13);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© CartoDB'
          }).addTo(map);

          var stops = ${JSON.stringify(pinnedStops)};
          var latlngs = [];

          stops.forEach(function(s, idx) {
            var isTerminal = (idx === 0 || idx === stops.length - 1);
            var markerClass = isTerminal ? 'stop-marker terminal' : 'stop-marker';
            
            L.marker([s.lat, s.lng], {
              icon: L.divIcon({
                html: '<div class="' + markerClass + '">' + (idx + 1) + '</div>',
                className: 'stop-node',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              })
            }).addTo(map).bindPopup("<strong>" + s.name + "</strong><br/>Stop " + (idx + 1));
            
            latlngs.push([s.lat, s.lng]);
          });

          if (latlngs.length > 1) {
            var line = L.polyline(latlngs, {
              color: '${Colors.primary}',
              weight: 3,
              opacity: 0.7,
              dashArray: '8, 6'
            }).addTo(map);
            map.fitBounds(line.getBounds(), { padding: [40, 40] });
          }

          map.on('click', function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_CLICK',
              lat: e.latlng.lat,
              lng: e.latlng.lng
            }));
          });
        </script>
      </body>
      </html>
    `;
  };

  // Inspect Map HTML
  const generateInspectMapHtml = (route) => {
    if (!route?.stops?.length) return "";
    const stopsJson = JSON.stringify(route.stops);
    const centerLat = route.stops[0].lat;
    const centerLng = route.stops[0].lng;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <title>Route View</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html, #map { width: 100%; height: 100%; }
          .view-marker {
            background: ${Colors.primary};
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 2px solid #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(99, 102, 241, 0.3);
            font-size: 10px;
            font-weight: 700;
            color: #FFFFFF;
          }
          .view-marker.terminal {
            background: ${Colors.success};
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: true, tap: false }).setView([${centerLat}, ${centerLng}], 14);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© CartoDB'
          }).addTo(map);

          var stops = ${stopsJson};
          var latlngs = [];

          stops.forEach(function(s, idx) {
            var isTerminal = (idx === 0 || idx === stops.length - 1);
            var markerClass = isTerminal ? 'view-marker terminal' : 'view-marker';
            
            L.marker([s.lat, s.lng], {
              icon: L.divIcon({
                html: '<div class="' + markerClass + '">' + (idx + 1) + '</div>',
                className: 'view-node',
                iconSize: [26, 26],
                iconAnchor: [13, 13]
              })
            }).addTo(map).bindPopup("<strong>" + s.name + "</strong>");
            
            latlngs.push([s.lat, s.lng]);
          });

          if (latlngs.length > 1) {
            var line = L.polyline(latlngs, {
              color: '${Colors.primary}',
              weight: 3,
              opacity: 0.8
            }).addTo(map);
            map.fitBounds(line.getBounds(), { padding: [50, 50] });
          }
        </script>
      </body>
      </html>
    `;
  };
  if (loading && !isBuilderMode) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <RouteIcon
              size={20}
              color={Colors.primary}
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>Route Manager</Text>
            <Text style={styles.headerSubtitle}>
              {isBuilderMode
                ? "Building new route"
                : `${routesList.length} routes`}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {isBuilderMode ? (
            <TouchableOpacity
              style={styles.exitButton}
              onPress={() => setIsBuilderMode(false)}
            >
              <Text style={styles.exitButtonText}>Exit Builder</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Feather name="log-out" size={18} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!isBuilderMode ? (
          /* ===== ROUTE LIST MODE ===== */
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.summaryIconContainer,
                    { backgroundColor: Colors.primaryLight },
                  ]}
                >
                  <BusFront
                    size={24}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryTitle}>Route Database</Text>
                  <Text style={styles.summaryCount}>
                    {routesList.length} saved routes
                  </Text>
                </View>
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                setPinnedStops([]);
                setRouteName("");
                setSchedules([
                  {
                    depTime: "",
                    arrTime: "",
                    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
                  },
                ]);
                setIsBuilderMode(true);
              }}
              activeOpacity={0.9}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create New Route</Text>
            </TouchableOpacity>

            {/* Routes List */}
            <Text style={styles.sectionTitle}>Saved Routes</Text>

            {routesList.length === 0 ? (
              <View style={styles.emptyState}>
                <Map
                  size={48}
                  color={Colors.textTertiary}
                />
                <Text style={styles.emptyStateTitle}>No Routes Found</Text>
                <Text style={styles.emptyStateText}>
                  Create your first bus route using the button above
                </Text>
              </View>
            ) : (
              routesList.map((route, index) => (
                <View key={route.id} style={styles.routeCard}>
                  {/* Route Header */}
                  <View style={styles.routeHeader}>
                    <View style={styles.routeHeaderLeft}>
                      <View
                        style={[
                          styles.routeIndicator,
                          { backgroundColor: Colors.primary },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.routeName} numberOfLines={1}>
                          {route.name}
                        </Text>
                        <Text style={styles.routeMeta}>
                          {route.totalDistance} km • {route.stops.length} stops
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteRoute(route.id, route.name)}
                    >
                      <Feather name="trash-2" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>

                  {/* Terminals */}
                  <View style={styles.terminalRow}>
                    <View style={styles.terminalDot}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: Colors.success },
                        ]}
                      />
                    </View>
                    <Text style={styles.terminalText} numberOfLines={1}>
                      {route.stops[0]?.name || "Origin"}
                    </Text>
                  </View>

                  <View style={styles.connectorLine} />

                  <View style={styles.terminalRow}>
                    <View style={styles.terminalDot}>
                      <MaterialIcons
                        name="flag"
                        size={12}
                        color={Colors.primary}
                      />
                    </View>
                    <Text style={styles.terminalText} numberOfLines={1}>
                      {route.stops[route.stops.length - 1]?.name ||
                        "Destination"}
                    </Text>
                  </View>

                  {/* Schedule Info */}
                  <View style={styles.scheduleBadge}>
                    <Feather name="clock" size={12} color={Colors.primary} />
                    <Text style={styles.scheduleText}>
                      {route.schedules
                        ? `${route.schedules.length} schedule(s)`
                        : "No schedules"}
                    </Text>
                  </View>

                  {/* View Button */}
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => {
                      setSelectedInspectRoute(route);
                      setViewRouteModalVisible(true);
                    }}
                  >
                    <Feather name="eye" size={14} color={Colors.primary} />
                    <Text style={styles.viewButtonText}>View Route Map</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Animated.View>
        ) : (
          /* ===== BUILDER MODE ===== */
          <View>
            {/* Route Name Input */}
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Route Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Campus Express Shuttle"
                placeholderTextColor={Colors.textTertiary}
                value={routeName}
                onChangeText={setRouteName}
              />
            </View>

            {/* Schedules Card */}
            <View style={styles.formCard}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.inputLabel}>Bus Schedules</Text>
                <TouchableOpacity
                  style={styles.addScheduleButton}
                  onPress={() =>
                    setSchedules([
                      ...schedules,
                      {
                        depTime: "",
                        arrTime: "",
                        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
                      },
                    ])
                  }
                >
                  <Feather name="plus" size={16} color={Colors.success} />
                  <Text style={styles.addScheduleText}>Add Time</Text>
                </TouchableOpacity>
              </View>

              {schedules.map((sch, idx) => (
                <View key={idx} style={styles.scheduleItem}>
                  <View style={styles.timeRow}>
                    <TouchableOpacity
                      style={[styles.timeInput, { flex: 1 }]}
                      onPress={() =>
                        setTimePickerConfig({ idx, field: "depTime" })
                      }
                    >
                      <Feather
                        name="sunrise"
                        size={14}
                        color={Colors.textTertiary}
                      />
                      <Text
                        style={[
                          styles.timeText,
                          !sch.depTime && styles.placeholderText,
                        ]}
                      >
                        {sch.depTime || "Departure"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.timeDivider}>
                      <ArrowRight
                        size={20}
                        color={Colors.primary}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.timeInput, { flex: 1 }]}
                      onPress={() =>
                        setTimePickerConfig({ idx, field: "arrTime" })
                      }
                    >
                      <Feather
                        name="sunset"
                        size={14}
                        color={Colors.textTertiary}
                      />
                      <Text
                        style={[
                          styles.timeText,
                          !sch.arrTime && styles.placeholderText,
                        ]}
                      >
                        {sch.arrTime || "Arrival"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Day Selector */}
                  <View style={styles.daySelector}>
                    {WEEK_DAYS.map((day) => {
                      const active = sch.days.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.dayChip,
                            active && styles.dayChipActive,
                          ]}
                          onPress={() => {
                            const updated = [...schedules];
                            if (active) {
                              updated[idx].days = updated[idx].days.filter(
                                (d) => d !== day,
                              );
                            } else {
                              updated[idx].days.push(day);
                            }
                            setSchedules(updated);
                          }}
                        >
                          <Text
                            style={[
                              styles.dayChipText,
                              active && styles.dayChipTextActive,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {schedules.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeScheduleButton}
                      onPress={() => {
                        const updated = [...schedules];
                        updated.splice(idx, 1);
                        setSchedules(updated);
                      }}
                    >
                      <Feather name="x" size={14} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Location Search */}
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Search Location (Optional)</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search address or landmark..."
                  placeholderTextColor={Colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleLocationSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleLocationSearch}
                  disabled={searching}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="search" size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>

              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectSearchResult(item)}
                    >
                      <Feather
                        name="map-pin"
                        size={16}
                        color={Colors.primary}
                      />
                      <Text style={styles.searchResultText} numberOfLines={1}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Map Section */}
            <View style={styles.mapCard}>
              <View style={styles.mapHeader}>
                <Text style={styles.inputLabel}>Pin Stops on Map</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.mapBadge}>
                    <View style={styles.mapBadgeDot} />
                    <Text style={styles.mapBadgeText}>Tap to pin</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.fullscreenBtn}
                    onPress={() => handleOpenFullscreen('builder')}
                  >
                    <Feather name="maximize-2" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.mapContainer}>
                <WebView
                  ref={builderWebViewRef}
                  originWhitelist={["*"]}
                  source={{ html: generateBuilderMapHtml() }}
                  style={styles.webView}
                  scrollEnabled={false}
                  javaScriptEnabled={true}
                  onMessage={handleWebViewMessage}
                />
              </View>
            </View>

            {/* Route Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Feather name="map" size={16} color={Colors.primary} />
                <Text style={styles.statValue}>
                  {getTotalDistance(pinnedStops)} km
                </Text>
                <Text style={styles.statLabel}>Total Distance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <Feather name="navigation" size={16} color={Colors.primary} />
                <Text style={styles.statValue}>{pinnedStops.length}</Text>
                <Text style={styles.statLabel}>Stops Pinned</Text>
              </View>
            </View>

            {/* Stop Sequence */}
            <Text style={styles.sectionTitle}>Stop Sequence</Text>

            {pinnedStops.length === 0 ? (
              <View style={styles.emptyStops}>
                <MapPin
                  size={36}
                  color={Colors.textTertiary}
                />
                <Text style={styles.emptyStopsText}>No stops added</Text>
                <Text style={styles.emptyStopsSubtext}>
                  Tap locations on the map above
                </Text>
              </View>
            ) : (
              pinnedStops.map((stop, idx) => {
                const isTerminal = idx === 0 || idx === pinnedStops.length - 1;
                return (
                  <View key={idx} style={styles.stopItem}>
                    <View
                      style={[
                        styles.stopIndex,
                        isTerminal && styles.stopIndexTerminal,
                      ]}
                    >
                      <Text style={styles.stopIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.stopInfo}>
                      <Text style={styles.stopName} numberOfLines={1}>
                        {stop.name}
                      </Text>
                      <Text style={styles.stopCoords}>
                        {stop.lat.toFixed(4)}°, {stop.lng.toFixed(4)}°
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeStopButton}
                      onPress={() => handleRemoveStop(idx)}
                    >
                      <Feather
                        name="x-circle"
                        size={18}
                        color={Colors.danger}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleClearStops}
                disabled={pinnedStops.length === 0}
              >
                <Feather name="refresh-cw" size={16} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveRoute}
              >
                <Feather name="save" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Save Route</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Time Picker */}
      {timePickerConfig && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, selectedDate) => {
            const config = timePickerConfig;
            setTimePickerConfig(null);
            if (selectedDate && event.type !== "dismissed") {
              const updated = [...schedules];
              updated[config.idx][config.field] = formatTime(selectedDate);
              setSchedules(updated);
            }
          }}
        />
      )}

      {/* Pin Naming Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={pinModalVisible}
        onRequestClose={() => setPinModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIcon,
                    { backgroundColor: Colors.primaryLight },
                  ]}
                >
                  <Feather name="map-pin" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Name This Stop</Text>
              </View>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <Feather name="x" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {draftCoords && (
              <View style={styles.coordsDisplay}>
                <Text style={styles.coordsText}>
                  {draftCoords.lat.toFixed(5)}, {draftCoords.lng.toFixed(5)}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Stop name (e.g. Main Gate)"
              placeholderTextColor={Colors.textTertiary}
              value={draftStopName}
              onChangeText={setDraftStopName}
              autoFocus={true}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setPinModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmPin}
              >
                <Text style={styles.modalConfirmText}>Confirm Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Route Inspection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={viewRouteModalVisible}
        onRequestClose={() => setViewRouteModalVisible(false)}
      >
        <View style={styles.inspectOverlay}>
          <View style={styles.inspectCard}>
            <View style={styles.inspectHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inspectTitle} numberOfLines={1}>
                  {selectedInspectRoute?.name}
                </Text>
                <Text style={styles.inspectSubtitle}>
                  {selectedInspectRoute?.totalDistance} km •{" "}
                  {selectedInspectRoute?.stops.length} stops
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.inspectCloseButton, { marginRight: 8 }]}
                onPress={() => handleOpenFullscreen('inspect')}
              >
                <Feather name="maximize-2" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inspectCloseButton}
                onPress={() => {
                  setViewRouteModalVisible(false);
                  setSelectedInspectRoute(null);
                }}
              >
                <Feather name="x" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inspectMapContainer}>
              {selectedInspectRoute && (
                <WebView
                  originWhitelist={["*"]}
                  source={{
                    html: generateInspectMapHtml(selectedInspectRoute),
                  }}
                  style={styles.webView}
                  scrollEnabled={false}
                  javaScriptEnabled={true}
                />
              )}
            </View>

            <Text style={styles.inspectSectionTitle}>Stop Sequence</Text>
            <ScrollView
              style={styles.inspectStopsList}
              showsVerticalScrollIndicator={false}
            >
              {selectedInspectRoute?.stops.map((stop, idx) => (
                <View key={idx} style={styles.inspectStopItem}>
                  <View
                    style={[
                      styles.inspectStopIndex,
                      (idx === 0 ||
                        idx === selectedInspectRoute.stops.length - 1) &&
                        styles.inspectStopIndexTerminal,
                    ]}
                  >
                    <Text style={styles.inspectStopIndexText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inspectStopName}>{stop.name}</Text>
                    <Text style={styles.inspectStopCoords}>
                      {stop.lat.toFixed(4)}°, {stop.lng.toFixed(4)}°
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== FULLSCREEN MAP MODAL ===== */}
      <Modal
        visible={fullscreenMapVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseFullscreen}
      >
        <View style={styles.fullscreenContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />

          {fullscreenMapType === 'builder' && (
            <WebView
              ref={fullscreenWebViewRef}
              originWhitelist={["*"]}
              source={{ html: generateBuilderMapHtml() }}
              style={StyleSheet.absoluteFill}
              scrollEnabled={false}
              javaScriptEnabled={true}
              onMessage={handleFullscreenWebViewMessage}
            />
          )}

          {fullscreenMapType === 'inspect' && selectedInspectRoute && (
            <WebView
              originWhitelist={["*"]}
              source={{ html: generateInspectMapHtml(selectedInspectRoute) }}
              style={StyleSheet.absoluteFill}
              scrollEnabled={false}
              javaScriptEnabled={true}
            />
          )}

          {/* Floating top bar */}
          <View style={styles.fullscreenTopBar}>
            <View style={styles.fullscreenTitleBlock}>
              <Text style={styles.fullscreenTitle}>
                {fullscreenMapType === 'inspect'
                  ? selectedInspectRoute?.name
                  : 'Pin Route Stops'}
              </Text>
              {fullscreenMapType === 'builder' && (
                <Text style={styles.fullscreenSubtitle}>
                  {pinnedStops.length} stop{pinnedStops.length !== 1 ? 's' : ''} pinned • tap map to add
                </Text>
              )}
              {fullscreenMapType === 'inspect' && (
                <Text style={styles.fullscreenSubtitle}>
                  {selectedInspectRoute?.totalDistance} km • {selectedInspectRoute?.stops.length} stops
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={handleCloseFullscreen}
            >
              <Feather name="minimize-2" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Floating stop count pill for builder */}
          {fullscreenMapType === 'builder' && pinnedStops.length > 0 && (
            <View style={styles.fullscreenPill}>
              <Feather name="map-pin" size={12} color="#FFFFFF" />
              <Text style={styles.fullscreenPillText}>
                {pinnedStops.map((s) => s.name).join(' → ')}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 100,
  },
  fullscreenTitleBlock: {
    flex: 1,
    marginRight: 12,
  },
  fullscreenTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fullscreenSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  fullscreenCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenPill: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(99,102,241,0.85)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  fullscreenPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fullscreenBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  loadingContent: {
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
  loadingIcon: {
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
  loadingText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
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
  },
  exitButton: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  exitButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.danger,
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
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  summaryCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
  routeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  routeHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  routeIndicator: {
    width: 3,
    height: 36,
    borderRadius: 1.5,
    marginRight: 12,
  },
  routeName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  routeMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dangerLight,
    justifyContent: "center",
    alignItems: "center",
  },
  terminalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  terminalDot: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  terminalText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
    flex: 1,
  },
  connectorLine: {
    width: 1,
    height: 10,
    backgroundColor: Colors.border,
    marginLeft: 9,
    marginVertical: 2,
  },
  scheduleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
    gap: 6,
  },
  scheduleText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addScheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.successLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  addScheduleText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.success,
  },
  scheduleItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  timeInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textPrimary,
  },
  placeholderText: {
    color: Colors.textTertiary,
  },
  timeDivider: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  daySelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  dayChipTextActive: {
    color: "#FFFFFF",
  },
  removeScheduleButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dangerLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResults: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchResultText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
    flex: 1,
  },
  mapCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  mapBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  mapBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  mapBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.primary,
  },
  mapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webView: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  emptyStops: {
    alignItems: "center",
    padding: 32,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    marginBottom: 16,
  },
  emptyStopsText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 10,
  },
  emptyStopsSubtext: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stopIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stopIndexTerminal: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  stopIndexText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  stopCoords: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  removeStopButton: {
    padding: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  primaryButton: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  coordsDisplay: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  coordsText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.danger,
  },
  modalConfirmButton: {
    flex: 1.5,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  inspectOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  inspectCard: {
    height: "85%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 12,
  },
  inspectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inspectTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  inspectSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  inspectCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  inspectMapContainer: {
    height: 200,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  inspectSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  inspectStopsList: {
    flex: 1,
  },
  inspectStopItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  inspectStopIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inspectStopIndexTerminal: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  inspectStopIndexText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
  },
  inspectStopName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  inspectStopCoords: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});

export default RouteSetterScreen;
