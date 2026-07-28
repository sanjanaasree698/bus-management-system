import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Line, Circle, Rect } from "react-native-svg";
import * as Location from "expo-location";
import { ref, onValue } from "firebase/database";
import { db, auth } from "../config/firebase";
import TopUpModal from "../components/TopUpModal";
import BusBookingModal from "../components/BusBookingModal";
import ActiveTicketModal from "../components/ActiveTicketModal";
import SeatSelectionModal from "../components/SeatSelectionModal";
import DateTimePicker from "@react-native-community/datetimepicker";

const { width, height } = Dimensions.get("window");

// ── Color Palette: Clean Premium Light Theme ────────────────────────────────
const PRIMARY = "#4F46E5";  // Indigo for buttons and accents
const PRIMARY_LIGHT = "#EEF2FF";
const WHITE   = "#FFFFFF";
const BG      = "#F8FAFC";  // Light slate background
const CARD    = "#FFFFFF";
const TEXT_DARK = "#0F172A"; // Slate 900 for main text
const TEXT_MUTED = "#64748B"; // Slate 500 for secondary text
const INPUT_BG = "#F1F5F9";   // Slate 100 for inputs
const BORDER  = "#E2E8F0";    // Slate 200 for borders
const BLACK   = TEXT_DARK;

// ── Helpers ──────────────────────────────────────────────────────────────────
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth Radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const addDurationToTime = (timeStr, minsToAdd) => {
  if (!timeStr) return "";
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return timeStr;
  let [_, h, m, period] = match;
  h = parseInt(h); m = parseInt(m);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  const date = new Date();
  date.setHours(h, m + minsToAdd, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' });
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const formatDate = (date = new Date()) =>
  date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const OWM_KEY = "bd5e378503939ddaee76f12ad7a97608";

// ── Bus Route Grid Background ─────────────────────────────────────────────────
const BusRouteGrid = ({ w, h }) => {
  const GRID = 30;
  const cols = Math.ceil(w / GRID) + 1;
  const rows = Math.ceil(h / GRID) + 1;
  const lines = [];
  for (let i = 0; i < cols; i++) {
    lines.push(
      <Line key={`v${i}`} x1={i * GRID} y1={0} x2={i * GRID} y2={h}
        stroke="rgba(0,0,0,0.03)" strokeWidth={1} />
    );
  }
  for (let i = 0; i < rows; i++) {
    lines.push(
      <Line key={`h${i}`} x1={0} y1={i * GRID} x2={w} y2={i * GRID}
        stroke="rgba(0,0,0,0.03)" strokeWidth={1} />
    );
  }
  const routeLines = [
    { x1: 0,        y1: h * 0.2, x2: w,        y2: h * 0.35 },
    { x1: w * 0.1,  y1: 0,       x2: w * 0.3,  y2: h },
    { x1: 0,        y1: h * 0.6, x2: w * 0.8,  y2: h * 0.1 },
    { x1: w * 0.5,  y1: 0,       x2: w * 0.9,  y2: h },
  ];
  const routeDots = [
    { cx: w * 0.12, cy: h * 0.23 },
    { cx: w * 0.55, cy: h * 0.15 },
    { cx: w * 0.28, cy: h * 0.52 },
    { cx: w * 0.72, cy: h * 0.68 },
    { cx: w * 0.88, cy: h * 0.32 },
  ];
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      {lines}
      {routeLines.map((l, i) => (
        <Line key={`route${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={PRIMARY_LIGHT} strokeWidth={2} strokeDasharray="6,8" />
      ))}
      {routeDots.map((d, i) => (
        <Circle key={`dot${i}`} cx={d.cx} cy={d.cy} r={4}
          fill={PRIMARY_LIGHT} />
      ))}
    </Svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
const HomeScreen = ({ onLogout }) => {
  const [userName, setUserName] = useState("");
  const [balance, setBalance] = useState(0);
  const [activeTickets, setActiveTickets] = useState([]);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [locationText, setLocationText] = useState("Fetching location...");
  const [coords, setCoords] = useState(null);
  const [weather, setWeather] = useState(null);

  const [fromStop, setFromStop] = useState("");
  const [toStop, setToStop] = useState("");
  const [editingField, setEditingField] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [currentScreen, setCurrentScreen] = useState("home");
  const [selectedBus, setSelectedBus] = useState(null);
  const [resultsFilter, setResultsFilter] = useState("Cheapest");

  const [topUpVisible, setTopUpVisible] = useState(false);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [activeTicketVisible, setActiveTicketVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [seatModalVisible, setSeatModalVisible] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);

  // ── DB listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}`);
    return onValue(userRef, (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        if (d.name) setUserName(d.name);
        if (d.balance !== undefined) setBalance(d.balance);
      }
    });
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const tickRef = ref(db, `tickets/${user.uid}`);
    return onValue(tickRef, (snap) => {
      if (snap.exists()) {
        const now = Date.now();
        const list = Object.values(snap.val());
        setActiveTickets(
          list.filter((t) => t.status === "active" && t.createdAt + t.durationMs > now)
              .sort((a, b) => b.createdAt - a.createdAt)
        );
      } else setActiveTickets([]);
    });
  }, []);

  useEffect(() => {
    const routesRef = ref(db, "routes");
    return onValue(routesRef, (snap) => {
      if (snap.exists()) {
        const parsed = Object.keys(snap.val()).map((k) => ({ id: k, ...snap.val()[k] }));
        setPopularRoutes([...parsed].sort((a, b) => (b.bookingCount || 0) - (a.bookingCount || 0)).slice(0, 4));
        const stopsMap = {};
        parsed.forEach((r) => { if (r.stops) r.stops.forEach((s) => { stopsMap[s.name] = s; }); });
        setAllStops(Object.values(stopsMap));
      }
    });
  }, []);

  // ── GPS + Weather ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationText("Location permission denied"); return; }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords(loc.coords);
        const [place] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (place) {
          const parts = [place.street || place.name, place.district || place.city].filter(Boolean);
          setLocationText(parts.slice(0, 2).join(", "));
        }
        fetchWeather(loc.coords.latitude, loc.coords.longitude);
      } catch { setLocationText("Unable to get location"); }
    })();
  }, []);

  const fetchWeather = async (lat, lon) => {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_KEY}`);
      const j = await res.json();
      if (j.main) setWeather({ temp: Math.round(j.main.temp), desc: j.weather?.[0]?.description || "", city: j.name || "" });
    } catch {}
  };

  // ── Stop picker ───────────────────────────────────────────────────────────
  const openPicker = (field) => { setEditingField(field); setSearchQuery(""); setSuggestions(allStops); };
  const onQueryChange = (t) => { setSearchQuery(t); setSuggestions(t.trim() ? allStops.filter((s) => s.name.toLowerCase().includes(t.toLowerCase())) : allStops); };
  const selectStop = (name) => { editingField === "from" ? setFromStop(name) : setToStop(name); setEditingField(null); };
  const handleSwap = () => { const t = fromStop; setFromStop(toStop); setToStop(t); };
  const handleSearch = () => {
    if (!fromStop.trim() || !toStop.trim()) { Alert.alert("Required", "Please select both Start and Destination stops."); return; }
    setCurrentScreen("results");
  };
  const routeFare = (r) => Math.round((r.stops?.length || 3) * 8 + 15);

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (currentScreen === "results") {
    const FILTERS = ["Recommended", "Cheapest", "Fastest"];
    const shortDay = selectedDate.toLocaleDateString("en-IN", { weekday: "short" });
    let buses = popularRoutes.length > 0
      ? popularRoutes.flatMap((r, i) => {
          let distanceStr = r.distance || "15 km";
          let durationStr = r.duration || "1h 0m";
          let totalMins = 60; // default
          let activeStops = [];
          if (r.stops) {
            const fIdx = r.stops.findIndex(s => s.name === fromStop);
            const tIdx = r.stops.findIndex(s => s.name === toStop);
            if (fIdx !== -1 && tIdx !== -1 && fIdx < tIdx) {
              activeStops = r.stops.slice(fIdx, tIdx + 1);
              let d = 0;
              for(let j=0; j<activeStops.length-1; j++){
                d += calculateHaversineDistance(activeStops[j].lat, activeStops[j].lng, activeStops[j+1].lat, activeStops[j+1].lng);
              }
              distanceStr = d.toFixed(1) + " km";
              totalMins = Math.round((d / 30) * 60);
              durationStr = `${Math.floor(totalMins/60)}h ${totalMins%60}m`;
            } else if (fIdx !== -1 || tIdx !== -1) {
              return [];
            }
          }

          if (r.schedules && r.schedules.length > 0) {
            return r.schedules
              .filter(sch => sch.days.includes(shortDay))
              .map((sch, schIdx) => ({
                id: `${r.id}-${schIdx}`, name: r.name?.toUpperCase() || "BUS ROUTE",
                tag: "",
                price: routeFare(r),
                depTime: sch.depTime, arrTime: addDurationToTime(sch.depTime, totalMins),
                duration: durationStr, stops: activeStops.length > 0 ? activeStops.length - 1 : 1, type: "One-way", distance: distanceStr,
                routeStops: activeStops, originalRoute: r, bookingCount: r.bookingCount
              }));
          }
          // Fallback
          const mockDep = r.timings?.split("-")[0]?.trim() || "7:40 AM";
          return [{
            id: r.id, name: r.name?.toUpperCase() || "BUS ROUTE",
            tag: "",
            price: routeFare(r),
            depTime: mockDep,
            arrTime: addDurationToTime(mockDep, totalMins),
            duration: durationStr, stops: activeStops.length > 0 ? activeStops.length - 1 : 1, type: "One-way", distance: distanceStr,
            routeStops: activeStops, originalRoute: r, bookingCount: r.bookingCount
          }];
        })
      : [
          { id: "1", name: "CROWD SENSE EXPRESS", tag: "CHEAPEST", price: 35, depTime: "7:40 AM", arrTime: "8:40 AM", duration: "1h 0m", stops: 1, type: "One-way", distance: "12 km", originalRoute: { id: "1", name: "CROWD SENSE EXPRESS", totalDistance: 12, stops: [{name: fromStop||"Start"}, {name: toStop||"End"}] } },
          { id: "2", name: "METRO CONNECT",  tag: "",         price: 43, depTime: "9:05 AM", arrTime: "10:25 AM",duration: "1h 20m",stops: 1, type: "One-way", distance: "15 km", originalRoute: { id: "2", name: "METRO CONNECT", totalDistance: 15, stops: [{name: fromStop||"Start"}, {name: toStop||"End"}] } },
          { id: "3", name: "CITY LINK",      tag: "",         price: 38, depTime: "6:40 AM", arrTime: "7:40 AM", duration: "1h 0m", stops: 1, type: "One-way", distance: "14 km", originalRoute: { id: "3", name: "CITY LINK", totalDistance: 14, stops: [{name: fromStop||"Start"}, {name: toStop||"End"}] } },
        ];
    if (resultsFilter === "Cheapest") buses = [...buses].sort((a, b) => a.price - b.price);

    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        {/* Dark header */}
        <View style={[styles.rHeader, { overflow: "hidden" }]}>
          <BusRouteGrid w={width} h={120} />
          <TouchableOpacity style={styles.rBackBtn} onPress={() => { setCurrentScreen("home"); setSeatModalVisible(false); }}>
            <Ionicons name="arrow-back" size={18} color={WHITE} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.rTitle}>{fromStop} to {toStop}</Text>
            <Text style={styles.rSub}>{formatDate()}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <FlatList
          data={buses} keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: b }) => (
            <TouchableOpacity style={styles.busCard} onPress={() => { setSelectedBus(b); setCurrentScreen("detail"); }} activeOpacity={0.9}>
              <View style={styles.busCardTop}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.opName}>{b.name}</Text>
                  {b.tag ? <View style={styles.tagChip}><Text style={styles.tagChipTxt}>{b.tag}</Text></View> : null}
                </View>
                <Text style={styles.busPrice}>₹{b.price}</Text>
              </View>
              <View style={styles.busTimeRow}>
                <View style={{ alignItems: "center" }}>
                  <View style={{ backgroundColor: INPUT_BG, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={[styles.busTime, { fontSize: 14 }]}>{b.depTime}</Text>
                  </View>
                  <Text style={[styles.busStn, { marginTop: 6 }]}>{fromStop.split(",")[0] || "Start"}</Text>
                </View>
                <View style={[styles.busDurBox, { flex: 1, paddingHorizontal: 10 }]}>
                  <View style={[styles.busDurLine, { flex: 1 }]} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.busDurTxt}>{b.duration}</Text>
                    <Text style={[styles.busDurTxt, { fontSize: 9, color: TEXT_MUTED }]}>{b.distance}</Text>
                  </View>
                  <View style={[styles.busDurLine, { flex: 1 }]} />
                </View>
                <View style={{ alignItems: "center" }}>
                  <View style={{ backgroundColor: INPUT_BG, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                    <Text style={[styles.busTime, { fontSize: 14 }]}>{b.arrTime}</Text>
                  </View>
                  <Text style={[styles.busStn, { marginTop: 6 }]}>{toStop.split(",")[0] || "Dest"}</Text>
                </View>
              </View>
              <View style={[styles.busTagRow, { justifyContent: "space-between", marginTop: 8 }]}>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 }}>
                  <View style={[styles.busTag, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1 }]}><Ionicons name="ticket-outline" size={12} color={PRIMARY} /><Text style={[styles.busTagTxt, { color: PRIMARY }]}> Booked - {b.bookingCount || 0}</Text></View>
                  <View style={styles.busTag}><Ionicons name="location-outline" size={12} color={TEXT_MUTED} /><Text style={styles.busTagTxt}> Live</Text></View>
                  <View style={styles.busTag}><Ionicons name="wifi-outline" size={12} color={TEXT_MUTED} /><Text style={styles.busTagTxt}> WiFi</Text></View>
                  <View style={styles.busTag}><Ionicons name="snow-outline" size={12} color={TEXT_MUTED} /><Text style={styles.busTagTxt}> AC</Text></View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAIL SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (currentScreen === "detail" && selectedBus) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <View style={[styles.rHeader, { overflow: "hidden" }]}>
          <BusRouteGrid w={width} h={130} />
          <TouchableOpacity style={styles.rBackBtn} onPress={() => { setCurrentScreen("results"); setSeatModalVisible(false); }}>
            <Ionicons name="arrow-back" size={18} color={WHITE} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.rTitle}>{selectedBus.name}</Text>
            <Text style={styles.rSub}>{fromStop} → {toStop}</Text>
          </View>
          <Text style={[styles.rPrice, { color: "#10B981" }]}>₹{selectedBus.price}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {/* Time card */}
          <View style={styles.detailTimeCard}>
            <View>
              <Text style={styles.detailBigTime}>{selectedBus.depTime}</Text>
              <Text style={styles.detailStn}>{fromStop.split(",")[0]}</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <View style={styles.detailDurLine} />
              <Text style={styles.detailDurTxt}>{selectedBus.duration}</Text>
              <View style={styles.detailDurLine} />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.detailBigTime}>{selectedBus.arrTime}</Text>
              <Text style={styles.detailStn}>{toStop.split(",")[0]}</Text>
            </View>
          </View>

          {/* Stop timeline */}
          <Text style={styles.secLabel}>Route Stops</Text>
          <View style={{ backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: BORDER }}>
            {(selectedBus.routeStops || [
              { label: fromStop.split(",")[0], sub: selectedBus.depTime, filled: true },
              { label: "Transfer Stop", sub: "Transfer, 15 min", filled: false },
              { label: toStop.split(",")[0], sub: "Destination", filled: true },
            ]).map((s, i, arr) => (
              <View key={i} style={styles.stopRow}>
                <View style={{ alignItems: "center", width: 32 }}>
                  <View style={[styles.stopDot, (s.filled || i===0 || i===arr.length-1) && styles.stopDotFilled]} />
                  {i < arr.length - 1 && <View style={styles.stopLine} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12, paddingBottom: 20 }}>
                  <Text style={styles.stopName}>{s.name || s.label}</Text>
                  <Text style={styles.stopSub}>{s.sub || (i===0 ? selectedBus.depTime : i===arr.length-1 ? selectedBus.arrTime : "Passing by")}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.bookBtn} onPress={() => { setSelectedRoute(selectedBus.originalRoute); setSeatModalVisible(true); }}>
            <Text style={styles.bookBtnTxt}>Select Ticket  ·  ₹{selectedBus.price}</Text>
          </TouchableOpacity>
        </ScrollView>
        <TopUpModal visible={topUpVisible} onClose={() => setTopUpVisible(false)} currentBalance={balance} onUpdateBalance={setBalance} />
        {selectedTicket && <ActiveTicketModal visible={activeTicketVisible} onClose={() => setActiveTicketVisible(false)} ticket={selectedTicket} />}
        {selectedRoute && <SeatSelectionModal visible={seatModalVisible} onClose={() => setSeatModalVisible(false)} route={selectedRoute} currentBalance={balance} onUpdateBalance={setBalance} onTicketBooked={(t) => { setSelectedTicket(t); setActiveTicketVisible(true); }} />}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

        {/* ── DARK HERO HEADER ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <BusRouteGrid w={width} h={200} />

          {/* Top: Greeting + Name + Location LEFT | Avatar + Balance RIGHT */}
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingTxt}>{getGreeting()}</Text>
              <Text style={styles.userNameTxt}>{userName || "Student"}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={12} color={PRIMARY} />
                <Text style={styles.locationTxt} numberOfLines={1}>{locationText}</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end", paddingTop: 2 }}>
              <TouchableOpacity style={styles.avatarCircle} onPress={() => setTopUpVisible(true)}>
                <Text style={styles.avatarLetter}>{userName ? userName.trim()[0].toUpperCase() : "?"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.balanceChip} onPress={() => setTopUpVisible(true)}>
                <Ionicons name="add-circle-outline" size={12} color="#10B981" />
                <Text style={styles.balanceTxt}> ₹{balance.toFixed(0)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Weather strip */}
          {weather && (
            <View style={styles.weatherStrip}>
              <Ionicons name="partly-sunny-outline" size={14} color={BLACK} />
              <Text style={styles.weatherTxt}> {weather.temp}°C  ·  {weather.desc}  ·  {weather.city}</Text>
            </View>
          )}
        </View>

        {/* ── FLOATING SEARCH CARD ───────────────────────────────────────── */}
        <View style={styles.searchCard}>

          {/* START entry box — full width */}
          <TouchableOpacity style={styles.entryBox} onPress={() => openPicker("from")} activeOpacity={0.85}>
            <View style={styles.entryIconWrap}>
              <Ionicons name="navigate-circle" size={20} color={BLACK} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryLabel}>Start</Text>
              <Text style={[styles.entryValue, !fromStop && styles.entryPlaceholder]} numberOfLines={1}>
                {fromStop || "Select starting stop"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* DESTINATION entry box — full width, swap button on right */}
          <View style={styles.destRow}>
            <TouchableOpacity style={[styles.entryBox, { flex: 1 }]} onPress={() => openPicker("to")} activeOpacity={0.85}>
              <View style={styles.entryIconWrap}>
                <Ionicons name="location" size={20} color={BLACK} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryLabel}>Destination</Text>
                <Text style={[styles.entryValue, !toStop && styles.entryPlaceholder]} numberOfLines={1}>
                  {toStop || "Select destination stop"}
                </Text>
              </View>
            </TouchableOpacity>
            {/* Swap button attached to right of destination */}
            <TouchableOpacity style={styles.swapBtn} onPress={handleSwap}>
              <Ionicons name="swap-vertical" size={20} color={WHITE} />
            </TouchableOpacity>
          </View>

          {/* Date row */}
          <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={14} color={TEXT_MUTED} />
            <Text style={styles.dateTxt}>{formatDate(selectedDate)}</Text>
          </TouchableOpacity>

          {/* Search button */}
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={16} color={WHITE} style={{ marginRight: 8 }} />
            <Text style={styles.searchBtnTxt}>Search Buses</Text>
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}
        </View>

        {/* ── ACTIVE TICKETS ────────────────────────────────────────────────── */}
        {activeTickets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secLabel}>Active Tickets</Text>
            {activeTickets.map((t) => {
              const minsLeft = Math.max(0, Math.floor(((t.createdAt + t.durationMs) - Date.now()) / 60000));
              return (
                <TouchableOpacity key={t.id} style={styles.ticketCard} onPress={() => { setSelectedTicket(t); setActiveTicketVisible(true); }} activeOpacity={0.9}>
                  <View style={styles.ticketLeft}>
                    <View style={styles.ticketIconBox}>
                      <Ionicons name="qr-code-outline" size={22} color={PRIMARY} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.ticketTitle}>{t.title}</Text>
                      <Text style={styles.ticketMeta}>{t.zones}  ·  {t.tariff}</Text>
                      <Text style={styles.ticketFrom}>From: {t.from}</Text>
                    </View>
                  </View>
                  <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={12} color="#94A3B8" />
                    <Text style={styles.timerTxt}>{minsLeft}m left</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── POPULAR ROUTES ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.secLabel}>Popular Routes</Text>
          {popularRoutes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="bus-outline" size={28} color={TEXT_MUTED} />
              <Text style={styles.emptyTxt}>No routes added yet</Text>
              <Text style={styles.emptySubTxt}>Admin can add routes via Route Setter</Text>
            </View>
          ) : (
            popularRoutes.map((r, i) => (
              <TouchableOpacity
                key={r.id}
                style={styles.routeCard}
                onPress={() => {
                  if (r.stops?.length >= 2) { setFromStop(r.stops[0].name); setToStop(r.stops[r.stops.length - 1].name); }
                  setCurrentScreen("results");
                }}
                activeOpacity={0.88}
              >
                <View style={styles.routeNumber}>
                  <Text style={styles.routeNumberTxt}>{String(i + 1).padStart(2, "0")}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.routeTitle}>{r.name}</Text>
                  <Text style={styles.routeMeta}>
                    {r.stops ? `${r.stops.length} stops` : "Route"}  ·  {r.timings || "See schedule"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.routePrice}>₹{routeFare(r)}</Text>
                  <Text style={styles.routeBookTxt}>Book →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── STOP PICKER MODAL ─────────────────────────────────────────────── */}
      <Modal visible={!!editingField} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.pickerSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingField === "from" ? "Select Start" : "Select Destination"}</Text>
              <TouchableOpacity onPress={() => setEditingField(null)}>
                <Ionicons name="close" size={22} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.pickerInput}
              placeholder="Search stops..."
              placeholderTextColor={TEXT_MUTED}
              value={searchQuery}
              onChangeText={onQueryChange}
              autoFocus
            />
            <FlatList
              data={suggestions.length > 0 ? suggestions : allStops}
              keyExtractor={(_, i) => i.toString()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => selectStop(item.name)}>
                  <Ionicons name="pin" size={14} color={TEXT_MUTED} style={{ marginRight: 12 }} />
                  <Text style={styles.pickerItemTxt}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Ionicons name="search-outline" size={28} color={TEXT_MUTED} />
                  <Text style={{ fontFamily: "Poppins_500Medium", color: TEXT_MUTED, marginTop: 8 }}>No stops found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ── SUB MODALS ────────────────────────────────────────────────────── */}
      <TopUpModal visible={topUpVisible} onClose={() => setTopUpVisible(false)} currentBalance={balance} onUpdateBalance={setBalance} />
      {selectedTicket && <ActiveTicketModal visible={activeTicketVisible} onClose={() => setActiveTicketVisible(false)} ticket={selectedTicket} />}
      {selectedRoute && <SeatSelectionModal visible={seatModalVisible} onClose={() => setSeatModalVisible(false)} route={selectedRoute} currentBalance={balance} onUpdateBalance={setBalance} onTicketBooked={(t) => { setSelectedTicket(t); setActiveTicketVisible(true); }} />}
    </View>
  );
};

export default HomeScreen;

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // HERO
  hero: {
    backgroundColor: WHITE,
    paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24,
    position: "relative",
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  heroTopRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16,
  },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: BLACK,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  avatarLetter: { fontSize: 18, fontFamily: "Poppins_700Bold", color: WHITE },
  balanceChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.2)",
  },
  balanceTxt: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#10B981" },

  greetingTxt: { fontSize: 12, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, letterSpacing: 0.5 },
  userNameTxt: { fontSize: 22, fontFamily: "Poppins_700Bold", color: TEXT_DARK, marginTop: 1, marginBottom: 4, letterSpacing: -0.3 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationTxt: { fontSize: 11, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, flex: 1 },

  weatherStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  weatherTxt: { fontSize: 11, fontFamily: "Poppins_500Medium", color: BLACK },

  // SEARCH CARD
  searchCard: {
    marginHorizontal: 16, marginTop: -24,
    backgroundColor: WHITE,
    borderRadius: 20, padding: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  // Entry boxes
  entryBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 13, gap: 10, marginBottom: 10,
  },
  destRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  entryIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: WHITE, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER,
  },
  entryLabel: { fontSize: 10, fontFamily: "Poppins_500Medium", color: TEXT_MUTED, marginBottom: 1 },
  entryValue: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: TEXT_DARK },
  entryPlaceholder: { fontFamily: "Poppins_400Regular", color: TEXT_MUTED, fontSize: 13 },

  swapBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: BLACK,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
  },

  dateRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: INPUT_BG, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 10, marginBottom: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  dateTxt: { fontSize: 13, fontFamily: "Poppins_500Medium", color: TEXT_DARK },
  searchBtn: {
    flexDirection: "row", backgroundColor: BLACK,
    borderRadius: 14, paddingVertical: 15,
    alignItems: "center", justifyContent: "center",
  },
  searchBtnTxt: { fontSize: 15, fontFamily: "Poppins_700Bold", color: WHITE },

  section: { marginHorizontal: 16, marginTop: 28 },
  secLabel: { fontSize: 16, fontFamily: "Poppins_700Bold", color: TEXT_DARK, marginBottom: 14 },

  // TICKET
  ticketCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  ticketLeft: { flexDirection: "row", alignItems: "center", flex: 1, flexShrink: 1, marginRight: 10 },
  ticketIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: "center", justifyContent: "center",
  },
  ticketTitle: { fontSize: 14, fontFamily: "Poppins_700Bold", color: TEXT_DARK },
  ticketMeta: { fontSize: 11, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, marginTop: 2 },
  ticketFrom: { fontSize: 10, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, marginTop: 4 },
  timerBadge: { position: "absolute", bottom: 12, right: 14, flexDirection: "row", alignItems: "center", gap: 4 },
  timerTxt: { fontSize: 11, fontFamily: "Poppins_500Medium", color: "#94A3B8" },

  // ROUTE CARDS
  routeCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  routeNumber: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: PRIMARY_LIGHT, alignItems: "center", justifyContent: "center",
  },
  routeNumberTxt: { fontSize: 13, fontFamily: "Poppins_700Bold", color: PRIMARY },
  routeTitle: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: TEXT_DARK },
  routeMeta: { fontSize: 10, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, marginTop: 2 },
  routePrice: { fontSize: 16, fontFamily: "Poppins_700Bold", color: TEXT_DARK },
  routeBookTxt: { fontSize: 10, fontFamily: "Poppins_600SemiBold", color: PRIMARY, marginTop: 3 },

  emptyBox: {
    backgroundColor: WHITE, borderRadius: 16, padding: 32,
    alignItems: "center", borderWidth: 1, borderColor: BORDER, borderStyle: "dashed",
  },
  emptyTxt: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: TEXT_DARK, marginTop: 10 },
  emptySubTxt: { fontSize: 10, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, marginTop: 4, textAlign: "center" },

  // RESULTS
  rHeader: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: WHITE,
    paddingTop: 52, paddingBottom: 18, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  rBackBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BLACK, alignItems: "center", justifyContent: "center",
  },
  rTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", color: TEXT_DARK, textAlign: "center" },
  rSub: { fontSize: 10, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, marginTop: 2 },
  rPrice: { fontSize: 18, fontFamily: "Poppins_700Bold", color: PRIMARY },

  filterRow: {
    flexDirection: "row",
    backgroundColor: WHITE,
    paddingHorizontal: 12, paddingBottom: 14, gap: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  filterPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: INPUT_BG,
    borderWidth: 1, borderColor: BORDER,
  },
  filterPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterTxt: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: TEXT_MUTED },
  filterTxtActive: { color: WHITE },
  filterSub: { fontSize: 11, fontFamily: "Poppins_500Medium", color: TEXT_MUTED },

  busCard: {
    backgroundColor: WHITE, borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 3,
    borderWidth: 1, borderColor: BORDER,
  },
  busCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  opName: { fontSize: 13, fontFamily: "Poppins_700Bold", color: TEXT_DARK },
  tagChip: { backgroundColor: PRIMARY_LIGHT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagChipTxt: { fontSize: 9, fontFamily: "Poppins_700Bold", color: PRIMARY },
  busPrice: { fontSize: 20, fontFamily: "Poppins_700Bold", color: TEXT_DARK },
  busTimeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  busTime: { fontSize: 18, fontFamily: "Poppins_700Bold", color: TEXT_DARK },
  busStn: { fontSize: 11, fontFamily: "Poppins_500Medium", color: TEXT_MUTED, marginTop: 2 },
  busDurBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  busDurLine: { width: 20, height: 1.5, backgroundColor: BORDER },
  busDurTxt: { fontSize: 10, fontFamily: "Poppins_500Medium", color: TEXT_MUTED },
  busTagRow: { flexDirection: "row", gap: 8 },
  busTag: { flexDirection: "row", alignItems: "center", backgroundColor: INPUT_BG, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  busTagTxt: { fontSize: 10, fontFamily: "Poppins_500Medium", color: TEXT_MUTED },

  // DETAIL
  detailTimeCard: {
    backgroundColor: WHITE, borderRadius: 18, padding: 20, marginBottom: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
    borderWidth: 1, borderColor: BORDER,
  },
  detailBigTime: { fontSize: 22, fontFamily: "Poppins_700Bold", color: TEXT_DARK },
  detailStn: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: TEXT_MUTED, marginTop: 2 },
  detailDurBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailDurLine: { width: 24, height: 1.5, backgroundColor: BORDER },
  detailDurTxt: { fontSize: 10, fontFamily: "Poppins_500Medium", color: TEXT_MUTED },

  stopRow: { flexDirection: "row" },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: PRIMARY, backgroundColor: WHITE, marginTop: 4 },
  stopDotFilled: { backgroundColor: PRIMARY },
  stopLine: { width: 2, flex: 1, backgroundColor: BORDER, alignSelf: "center", marginTop: 4 },
  stopName: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: TEXT_DARK },
  stopSub: { fontSize: 11, fontFamily: "Poppins_400Regular", color: TEXT_MUTED, marginTop: 2 },
  bookBtn: { backgroundColor: "#10B981", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  bookBtnTxt: { fontSize: 15, fontFamily: "Poppins_700Bold", color: WHITE },

  // MODAL
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, maxHeight: "78%" },
  sheetHandle: { width: 40, height: 4, backgroundColor: BORDER, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontFamily: "Poppins_700Bold", color: TEXT_DARK },
  pickerInput: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: INPUT_BG, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, fontFamily: "Poppins_400Regular", color: TEXT_DARK,
    borderWidth: 1, borderColor: BORDER,
  },
  pickerItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: INPUT_BG },
  pickerItemTxt: { fontSize: 13, fontFamily: "Poppins_500Medium", color: TEXT_DARK },
});
