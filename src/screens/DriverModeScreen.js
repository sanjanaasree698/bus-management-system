import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StatusBar,
  Animated,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Scan, Users, Ticket, Armchair, CameraOff, Bus } from "lucide-react-native";
import { ref, onValue, set, get, push } from "firebase/database";
import { db } from "../config/firebase";
import { CameraView, useCameraPermissions } from "expo-camera";

// Professional Color Palette
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
};

export default function DriverModeScreen() {
  // Core States
  const [passengers, setPassengers] = useState(0);
  const [booked, setBooked] = useState(0);
  const [loading, setLoading] = useState(true);

  // Scanner States
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedTicket, setScannedTicket] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Camera Permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Sync passenger data from Firebase
  useEffect(() => {
    const passRef = ref(db, "passengers");
    const unsubscribe = onValue(passRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setPassengers(data.count || 0);
        setBooked(data.booked || 0);
      }
      setLoading(false);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => unsubscribe();
  }, []);

  // Scanner animation effect
  useEffect(() => {
    if (scannerVisible) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [scannerVisible]);

  // Handle QR Scan
  const handleQRScanned = async ({ data }) => {
    if (scanning) return;
    setScanning(true);

    try {
      let ticketId = data.trim();
      let ticketData = null;
      if (data.startsWith('{')) {
        try {
          ticketData = JSON.parse(data);
          ticketId = ticketData.id || ticketData.ticketId || ticketId;
        } catch (e) {}
      }

      if (!ticketId) {
        throw new Error("Invalid ticket format");
      }

      const ticketsRef = ref(db, 'tickets');
      const ticketsSnapshot = await get(ticketsRef);

      if (!ticketsSnapshot.exists()) {
        throw new Error("No tickets database found.");
      }

      let foundTicket = null;
      let targetUserUid = null;
      const allUsersTickets = ticketsSnapshot.val();

      for (const userUid of Object.keys(allUsersTickets)) {
        const userTickets = allUsersTickets[userUid];
        if (userTickets[ticketId]) {
          foundTicket = userTickets[ticketId];
          targetUserUid = userUid;
          break;
        }
      }

      if (!foundTicket) {
        throw new Error("Ticket not found in system.");
      }

      if (foundTicket.onboarded) {
        setScannedTicket({
          id: ticketId,
          passengers: foundTicket.seatReservations || [],
          from: foundTicket.from || "Unknown",
          to: foundTicket.to || "Unknown",
          alreadyScanned: true,
        });
        setScanning(false);
        setScannerVisible(false);
        return;
      }

      // Mark as onboarded
      await set(ref(db, `tickets/${targetUserUid}/${ticketId}/onboarded`), true);

      // Update passenger count in Firebase
      const passengersRef = ref(db, "passengers");
      const snapshot = await get(passengersRef);

      if (snapshot.exists()) {
        const current = snapshot.val();
        const newCount = (current.count || 0) + 1;

        await set(passengersRef, {
          ...current,
          count: newCount,
          lastScan: new Date().toISOString(),
          lastPassenger: foundTicket.seatReservations?.[0]?.passengerName || "Unknown",
        });

        // Log the boarding event
        const logsRef = ref(db, "logs");
        const newLogRef = push(logsRef);
        await set(newLogRef, {
          type: "ENTRY",
          passengerCount: newCount,
          passengerName: foundTicket.seatReservations?.[0]?.passengerName || "Unknown",
          ticketId: ticketId,
          timestamp: new Date().toLocaleString("en-IN", { hour12: false }),
          scannedAt: new Date().toISOString(),
        });

        setPassengers(newCount);
        setScannedTicket({
          id: ticketId,
          passengers: foundTicket.seatReservations || [],
          from: foundTicket.from || "Unknown",
          to: foundTicket.to || "Unknown"
        });
        setScannerVisible(false);
      }
    } catch (error) {
      Alert.alert(
        "Invalid QR Code",
        error.message || "This QR code could not be validated. Please try again.",
        [{ text: "Try Again", style: "default" }],
      );
    } finally {
      setScanning(false);
    }
  };

  // Handle scanner open with permission check
  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please grant camera access to scan QR codes for passenger boarding.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Grant Permission", onPress: requestPermission },
          ],
        );
        return;
      }
    }
    setScannerVisible(true);
    setScanning(false);
  };

  const handleScannerClose = () => {
    setScannerVisible(false);
    setScanning(false);
  };

  const handleCloseTicketDetails = () => {
    setScannedTicket(null);
  };

  if (loading) {
    return null; // Remove big loader, just load silently
  }

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Scan
              size={22}
              color={Colors.primary}
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>Ticket Scanner</Text>
            <Text style={styles.headerSubtitle}>QR Boarding Verification</Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Passenger Stats Card */}
        <Animated.View
          style={[
            styles.statsCard,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: Colors.primaryLight },
                ]}
              >
                <Users
                  size={24}
                  color={Colors.primary}
                />
              </View>
              <Text style={styles.statValue}>{passengers}</Text>
              <Text style={styles.statLabel}>On Board</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: Colors.successLight },
                ]}
              >
                <Ticket
                  size={24}
                  color={Colors.success}
                />
              </View>
              <Text style={styles.statValue}>{booked}</Text>
              <Text style={styles.statLabel}>Booked</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: Colors.warningLight },
                ]}
              >
                <Armchair
                  size={24}
                  color={Colors.warning}
                />
              </View>
              <Text style={styles.statValue}>{70 - passengers}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
          </View>
        </Animated.View>

        {/* Scanner Instructions */}
        <View style={styles.instructionsCard}>
          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Position QR Code</Text>
              <Text style={styles.stepDescription}>
                Hold the passenger's ticket QR code within the camera frame
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.instructionStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Automatic Detection</Text>
              <Text style={styles.stepDescription}>
                The scanner will automatically detect and validate the ticket
              </Text>
            </View>
          </View>

          <View style={styles.stepConnector} />

          <View style={styles.instructionStep}>
            <View
              style={[styles.stepNumber, { backgroundColor: Colors.success }]}
            >
              <Feather name="check" size={14} color="#FFFFFF" />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Confirmation</Text>
              <Text style={styles.stepDescription}>
                Passenger will be boarded and count updated automatically
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Scan Button - Fixed at Bottom */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleOpenScanner}
          activeOpacity={0.9}
        >
          <View style={styles.scanButtonInner}>
            <Scan
              size={28}
              color="#FFFFFF"
            />
            <Text style={styles.scanButtonText}>Scan QR Ticket</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* QR Scanner Modal - Fixed: No children inside CameraView */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={handleScannerClose}
        statusBarTranslucent
      >
        <View style={styles.scannerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          {permission?.granted ? (
            <View style={StyleSheet.absoluteFill}>
              {/* Camera View - No children */}
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
                onBarcodeScanned={handleQRScanned}
              />

              {/* Overlay - Absolutely positioned ABOVE the camera */}
              <View style={[styles.scannerOverlay, { justifyContent: 'center' }]} pointerEvents="box-none">
                {/* Top Bar */}
                <View style={[styles.scannerTopBar, { position: 'absolute', top: 0, width: '100%', zIndex: 10 }]}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleScannerClose}
                  >
                    <Feather name="x" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.scannerTitle}>Scan Ticket QR Code</Text>
                  <View style={{ width: 40 }} />
                </View>

                {/* Scan Area with Animated Line */}
                <View style={[styles.scanAreaContainer, { marginTop: 250 }]}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />

                    {/* Animated scan line */}
                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          transform: [{ translateY: scanLineTranslateY }],
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Centered Instructions in Scanner */}
                <View style={[styles.scannerBottom, { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'absolute', width: '100%', top: '50%', marginTop: 400 }]}>
                  <Text style={[styles.scannerInstruction, { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 10, overflow: 'hidden' }]}>
                    Position QR code within the frame
                  </Text>
                  {scanning && (
                    <View style={[styles.scanningIndicator, { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 10, marginTop: 10 }]}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.scanningText}>
                        Processing ticket...
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.permissionContainer}>
              <CameraOff
                size={48}
                color={Colors.textTertiary}
              />
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionText}>
                Grant camera permission to scan passenger QR codes
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={styles.permissionButtonText}>
                  Grant Permission
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Ticket Success Modal */}
      {scannedTicket && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={handleCloseTicketDetails}
        >
          <View style={styles.successOverlay}>
            <View style={styles.successCard}>
              {/* Success/Error Icon */}
              <View style={styles.successIconContainer}>
                <View style={[styles.successIconCircle, scannedTicket.alreadyScanned ? { backgroundColor: Colors.dangerLight } : {}]}>
                  {scannedTicket.alreadyScanned ? (
                    <Feather name="x" size={32} color={Colors.danger} />
                  ) : (
                    <Feather name="check" size={32} color={Colors.success} />
                  )}
                </View>
              </View>

              <Text style={[styles.successTitle, scannedTicket.alreadyScanned ? { color: Colors.danger } : {}]}>
                {scannedTicket.alreadyScanned ? "Already Scanned" : "Boarding Approved ✓"}
              </Text>
              <Text style={styles.successSubtitle}>
                {scannedTicket.alreadyScanned ? "This ticket has already been checked in." : "Passenger verified & registered"}
              </Text>

              {/* Prominent Passenger Info */}
              {scannedTicket.passengers && scannedTicket.passengers.length > 0 && (
                <View style={styles.passengerHighlightCard}>
                  <Text style={styles.passengerHighlightHeader}>🧑‍🤝‍🧑 Passenger Info</Text>
                  {scannedTicket.passengers.map((p, idx) => (
                    <View key={idx} style={styles.passengerHighlightRow}>
                      <View style={styles.passengerNameBlock}>
                        <Text style={styles.passengerNameLabel}>Name</Text>
                        <Text style={styles.passengerNameValue}>{p.passengerName || "Unknown"}</Text>
                      </View>
                      <View style={styles.passengerSeatBadge}>
                        <Text style={styles.passengerSeatLabel}>Seat</Text>
                        <Text style={styles.passengerSeatNumber}>{p.seatNumber || "—"}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Ticket Details */}
              <View style={styles.ticketDetailsCard}>
                <View style={styles.ticketDetailRow}>
                  <Text style={styles.ticketDetailLabel}>Ticket ID</Text>
                  <Text style={styles.ticketDetailValue}>
                    ...{scannedTicket.id ? scannedTicket.id.slice(-5) : "N/A"}
                  </Text>
                </View>

                {scannedTicket.from && (
                  <>
                    <View style={styles.ticketDetailDivider} />
                    <View style={styles.ticketDetailRow}>
                      <Text style={styles.ticketDetailLabel}>From</Text>
                      <Text style={styles.ticketDetailValue}>{scannedTicket.from}</Text>
                    </View>
                  </>
                )}


              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleCloseTicketDetails}
              >
                <Text style={styles.doneButtonText}>Continue Scanning</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

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
  loadingContent: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "80%",
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
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: Colors.border,
  },
  instructionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  stepConnector: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 13,
    marginVertical: 8,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  scanButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  scannerTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scanAreaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: Colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  scannerBottom: {
    alignItems: "center",
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingTop: 20,
  },
  scannerInstruction: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    textAlign: "center",
  },
  scanningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  scanningText: {
    fontSize: 13,
    color: "#FFFFFF",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: 40,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 16,
  },
  permissionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  permissionButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successCard: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.successLight,
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  passengerHighlightCard: {
    width: "100%",
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.primary + "33",
  },
  passengerHighlightHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  passengerHighlightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  passengerNameBlock: {
    flex: 1,
  },
  passengerNameLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  passengerNameValue: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  passengerSeatBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 64,
  },
  passengerSeatLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  passengerSeatNumber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  ticketDetailsCard: {
    width: "100%",
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  ticketDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  ticketDetailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  ticketDetailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  ticketDetailDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  updatedCount: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  updatedCountText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  doneButton: {
    width: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
