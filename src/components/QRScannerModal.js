import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { ref, get, set, runTransaction } from "firebase/database";
import { db } from "../config/firebase";

const VIOLET = "#7C3AED";
const GREEN = "#10B981";
const RED = "#EF4444";

export default function QRScannerModal({ visible, onClose, onScanSuccess }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [scannedData, setScannedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultStatus, setResultStatus] = useState(null); // 'success', 'error', or null
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setScanning(true);
      setScannedData(null);
      setResultStatus(null);
    } else {
      if (permission && !permission.granted) {
        requestPermission();
      }
    }
  }, [visible]);

  const handleBarCodeScanned = async (event) => {
    if (!scanning || isProcessing) return;

    setScanning(false);
    setIsProcessing(true);
    const data = event.data;

    try {
      let ticketId = data.trim();
      let parsed = null;

      if (data.startsWith("{")) {
        try {
          parsed = JSON.parse(data);
          ticketId = parsed.id || parsed.ticketId || ticketId;
        } catch (e) {}
      }

      const ticketsRef = ref(db, "tickets");
      const ticketsSnapshot = await get(ticketsRef);

      if (!ticketsSnapshot.exists()) {
        animateResult("error");
        setTimeout(() => {
          Alert.alert("Scan Failed", "No tickets database found.");
          setIsProcessing(false);
          setScanning(true);
        }, 800);
        return;
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
        animateResult("error");
        setTimeout(() => {
          Alert.alert("Invalid QR", "Ticket not found in system.");
          setIsProcessing(false);
          setScanning(true);
        }, 800);
        return;
      }

      if (foundTicket.onboarded) {
        animateResult("error");
        setTimeout(() => {
          Alert.alert("Already Checked In", "This ticket was already scanned.");
          setIsProcessing(false);
          setScanning(true);
        }, 800);
        return;
      }

      // Mark as onboarded
      await set(
        ref(db, `tickets/${targetUserUid}/${ticketId}/onboarded`),
        true,
      );

      // Update passenger count
      const countIncRef = ref(db, "passengers");
      let finalCount = 0;
      await runTransaction(countIncRef, (currentData) => {
        if (!currentData) currentData = { count: 0, booked: 0 };
        currentData.count = Math.min(70, (currentData.count || 0) + 1);
        finalCount = currentData.count;
        return currentData;
      });

      // Log QR scan
      const logsRef = ref(db, "qr_logs");
      const timestamp = new Date().toLocaleString("en-IN", { hour12: false });
      const newLogRef = ref(db, `qr_logs/log_${Date.now()}`);
      await set(newLogRef, {
        ticketId,
        timestamp,
        status: "success",
        passengerCount: finalCount,
        ticketTitle: foundTicket.title || "Standard Ticket",
      });

      animateResult("success");
      setScannedData({
        id: ticketId,
        title: foundTicket.title || "Standard Ticket",
        from: foundTicket.from || "SEC Stop",
        passengerName:
          foundTicket.seatReservations?.[0]?.passengerName || "Passenger",
      });

      setTimeout(() => {
        if (onScanSuccess) onScanSuccess(finalCount);
        onClose();
      }, 1500);
    } catch (err) {
      animateResult("error");
      setTimeout(() => {
        Alert.alert("Scan Error", err.message);
        setIsProcessing(false);
        setScanning(true);
      }, 800);
    }
  };

  const animateResult = (status) => {
    setResultStatus(status);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={VIOLET} />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Camera access required</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={styles.container}>
        <CameraView
          facing="back"
          onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Overlay Frame */}
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerText}>Scan QR Code</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.scanFrame} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isProcessing ? "Processing..." : "Position QR code in frame"}
            </Text>
          </View>
        </View>

        {/* Result Feedback */}
        {resultStatus && (
          <Animated.View
            style={[
              styles.resultFeedback,
              {
                backgroundColor: resultStatus === "success" ? GREEN : RED,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons
              name={
                resultStatus === "success" ? "checkmark-circle" : "close-circle"
              }
              size={40}
              color="#FFFFFF"
            />
            <Text style={styles.resultText}>
              {resultStatus === "success" ? "Ticket Accepted!" : "Scan Failed"}
            </Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: VIOLET,
    borderRadius: 12,
    alignSelf: "center",
    backgroundColor: "rgba(124, 58, 237, 0.05)",
  },
  footer: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  loadingText: {
    fontSize: 14,
    color: VIOLET,
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: RED,
    marginBottom: 16,
    textAlign: "center",
  },
  btn: {
    backgroundColor: VIOLET,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  resultFeedback: {
    position: "absolute",
    bottom: 100,
    left: "15%",
    right: "15%",
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resultText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
});
