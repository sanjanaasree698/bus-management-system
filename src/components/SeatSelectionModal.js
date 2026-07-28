import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { push, ref, set, onValue, runTransaction } from "firebase/database";
import { db, auth } from "../config/firebase";

const SeatSelectionModal = ({
  visible,
  onClose,
  route,
  currentBalance,
  onUpdateBalance,
  onTicketBooked,
}) => {
  const [loading, setLoading] = useState(false);
  const [bookedSeats, setBookedSeats] = useState({}); // Map of seatNumber -> { gender, passengerName, age }
  const [selectedSeats, setSelectedSeats] = useState([]); // Array of { seatNumber, passengerName, age, gender }

  // Passenger Form State (for currently selecting seat)
  const [activeFormSeat, setActiveFormSeat] = useState(null);
  const [passengerName, setPassengerName] = useState("");
  const [passengerAge, setPassengerAge] = useState("");
  const [passengerGender, setPassengerGender] = useState("M"); // 'M' or 'F'

  // UPI Payment States
  const [upiSheetVisible, setUpiSheetVisible] = useState(false);
  const [upiApp, setUpiApp] = useState("gpay"); // 'gpay' | 'phonepe' | 'paytm'
  const [upiPin, setUpiPin] = useState("");
  const [paymentSuccessAnim, setPaymentSuccessAnim] = useState(false);

  // Load Booked Seats from Firebase in real-time for this specific route
  useEffect(() => {
    if (!visible || !route) return;

    const bookingsRef = ref(db, `bookings/${route.id}`);
    const unsubscribe = onValue(bookingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setBookedSeats(snapshot.val());
      } else {
        setBookedSeats({});
      }
    });

    return () => unsubscribe();
  }, [visible, route]);

  if (!route) return null;

  const totalSeats = 70;
  const distanceForFare = route.totalDistance || 15;
  const seatFare = Math.round(distanceForFare * 3.5 + 15); // Dynamic Indian Rupee Fare based on distance

  // Mathematically check if there are other fully vacant rows/pairs in the bus
  const checkVacantPairsAvailable = () => {
    // A pair is defined as adjacent seats: (A & B) or (C & D) in rows 2 to 17.
    // Last row (Row 18) has 5 seats: we can treat (A & B) and (D & E) as pairs.
    // Front jump seat (Seat 1) has no pair.
    let vacantCount = 0;

    const isSeatVacant = (num) => {
      return (
        !bookedSeats[num] && !selectedSeats.some((s) => s.seatNumber === num)
      );
    };

    // Rows 1 to 16 of 2x2 layout: seats 2 to 65
    // Row i (for i=0..15): seats are 2 + i*4, 3 + i*4, 4 + i*4, 5 + i*4
    // Pairs: (A, B) and (C, D) -> (2+i*4, 3+i*4) and (4+i*4, 5+i*4)
    for (let i = 0; i < 16; i++) {
      const base = 2 + i * 4;
      if (isSeatVacant(base) && isSeatVacant(base + 1)) vacantCount++;
      if (isSeatVacant(base + 2) && isSeatVacant(base + 3)) vacantCount++;
    }

    // Last row (Row 17): seats 66 to 70
    // Pairs: (66, 67) and (69, 70)
    if (isSeatVacant(66) && isSeatVacant(67)) vacantCount++;
    if (isSeatVacant(69) && isSeatVacant(70)) vacantCount++;

    return vacantCount > 0;
  };

  // Find adjacent seat number
  const getAdjacentSeatNumber = (num) => {
    if (num === 1) return null; // Front jumpseat has no adjacent seat

    // Last row (66, 67, 68, 69, 70)
    if (num >= 66 && num <= 70) {
      if (num === 66) return 67;
      if (num === 67) return 66;
      if (num === 68) return null; // Center last row seat
      if (num === 69) return 70;
      if (num === 70) return 69;
    }

    // Regular rows 2 to 17 (seats 2 to 65)
    // Relative position in row of 4: (num - 2) % 4
    const offset = (num - 2) % 4;
    if (offset === 0) return num + 1; // A next to B
    if (offset === 1) return num - 1; // B next to A
    if (offset === 2) return num + 1; // C next to D
    if (offset === 3) return num - 1; // D next to C

    return null;
  };

  // Click handler for selecting a seat
  const handleSeatClick = (seatNumber) => {
    // 1. Check if seat is already booked in Firebase
    if (bookedSeats[seatNumber]) {
      const occupant = bookedSeats[seatNumber];
      Alert.alert(
        "Seat Occupied",
        `This seat is reserved by ${occupant.gender === "F" ? "Female" : "Male"} passenger.`,
      );
      return;
    }

    // 2. Check if seat is already selected in this transaction -> if so, deselect
    if (selectedSeats.some((s) => s.seatNumber === seatNumber)) {
      setSelectedSeats(
        selectedSeats.filter((s) => s.seatNumber !== seatNumber),
      );
      return;
    }

    // 3. Initiate passenger details form
    setPassengerName("");
    setPassengerAge("");
    setPassengerGender("M");
    setActiveFormSeat(seatNumber);
  };

  // Confirm seat selection after entering passenger details (with GENDER segregation rules!)
  const handleConfirmPassenger = () => {
    if (!passengerName.trim()) {
      Alert.alert("Input Required", "Please enter the passenger name.");
      return;
    }
    const ageVal = parseInt(passengerAge);
    if (isNaN(ageVal) || ageVal <= 0 || ageVal > 120) {
      Alert.alert("Input Required", "Please enter a valid age.");
      return;
    }

    const targetSeatNum = activeFormSeat;
    const adjSeatNum = getAdjacentSeatNumber(targetSeatNum);

    // Strict Gender Segregation Rules!
    if (adjSeatNum) {
      // Check if adjacent seat is occupied in Firebase (meaning booked by a different transaction)
      const adjOccupant = bookedSeats[adjSeatNum];

      if (adjOccupant) {
        // If they are of different genders
        if (adjOccupant.gender !== passengerGender) {
          // If other fully vacant rows/pairs are available, block it!
          if (checkVacantPairsAvailable()) {
            Alert.alert(
              "Gender Segregation Alert",
              `To ensure passenger comfort, Female and Male passengers who book separately cannot be seated next to each other when other fully vacant rows are available. Please select a vacant row instead.`,
              [{ text: "OK" }],
            );
            return;
          }
        }
      }

      // Also check if adjacent seat is currently selected in this SAME transaction
      const currentAdjSelection = selectedSeats.find(
        (s) => s.seatNumber === adjSeatNum,
      );
      if (currentAdjSelection) {
        // Since they are booking together, mixed genders are allowed!
        // We do not block. "If booking together Male and female is OKay"
      }
    }

    // Insert to selected list
    const newPassenger = {
      seatNumber: targetSeatNum,
      passengerName: passengerName.trim(),
      age: ageVal,
      gender: passengerGender,
    };

    setSelectedSeats([...selectedSeats, newPassenger]);
    setActiveFormSeat(null);
  };

  // Execute direct payment from balance
  const handleDirectPayment = async () => {
    setLoading(true);
    const totalFare = selectedSeats.length * seatFare;

    if (currentBalance < totalFare) {
      Alert.alert(
        "Insufficient Wallet Balance",
        `Your wallet has ₹${currentBalance.toFixed(2)}, but this booking costs ₹${totalFare.toFixed(2)}. Please exit and top up first.`,
      );
      setLoading(false);
      return;
    }

    // Execute payment
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Authentication session lost.");

      // 1. Deduct from balance
      const newBal = currentBalance - totalFare;
      await set(ref(db, `users/${user.uid}/balance`), newBal);
      onUpdateBalance(newBal);

      // 2. Write bookings to Firebase Realtime DB under route bookings
      for (const passenger of selectedSeats) {
        const bookingRef = ref(
          db,
          `bookings/${route.id}/${passenger.seatNumber}`,
        );
        await set(bookingRef, {
          passengerName: passenger.passengerName,
          age: passenger.age,
          gender: passenger.gender,
          bookedBy: user.uid,
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Issue tickets history to student
      const ticketRef = ref(db, `tickets/${user.uid}`);
      const newTicketPush = push(ticketRef);
      const ticketData = {
        id: newTicketPush.key,
        title: `Bus seat reservation (${selectedSeats.map((s) => `#${s.seatNumber}`).join(", ")})`,
        tariff: route.name,
        zones: `${selectedSeats.length} Seats Reserved`,
        price: totalFare,
        from: route.stops ? route.stops[0].name : route.name,
        createdAt: Date.now(),
        durationMs: 4 * 60 * 60 * 1000, // 4 hours pass
        status: "active",
        routeId: route.id,
        onboarded: false,
        seatReservations: selectedSeats,
      };
      await set(newTicketPush, ticketData);

      // 4. Update the global passengers/booked counter for Admin Dashboard
      const passengersBookedRef = ref(db, "passengers/booked");
      await runTransaction(passengersBookedRef, (currentBooked) => {
        return (currentBooked || 0) + selectedSeats.length;
      });

      // Update the specific route's booking count
      const routeBookingCountRef = ref(db, `routes/${route.id}/bookingCount`);
      await runTransaction(routeBookingCountRef, (current) => {
        return (current || 0) + selectedSeats.length;
      });

      // 5. Trigger success screen
      setPaymentSuccessAnim(true);
      setTimeout(() => {
        setPaymentSuccessAnim(false);
        setSelectedSeats([]);
        onClose();
        if (onTicketBooked) onTicketBooked(ticketData);
      }, 2200);
    } catch (err) {
      Alert.alert("Transaction Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper render to generate 70 seats
  const renderBusSeats = () => {
    const seatLayout = [];

    // 1. Front Jump Seat next to entry door (Seat 1)
    seatLayout.push(
      <View key="row_front" style={styles.seatsRow}>
        <View style={styles.seatPlaceholder} />
        <View style={styles.seatPlaceholder} />
        <View style={styles.aisleSpacer} />
        <View style={styles.seatPlaceholder} />
        {renderSingleSeatButton(1)}
      </View>,
    );

    // 2. 16 Rows of 2x2 double seats: seats 2 to 65
    for (let r = 0; r < 16; r++) {
      const base = 2 + r * 4;
      seatLayout.push(
        <View key={`row_${r}`} style={styles.seatsRow}>
          {renderSingleSeatButton(base)}
          {renderSingleSeatButton(base + 1)}
          <View style={styles.aisleSpacer} />
          {renderSingleSeatButton(base + 2)}
          {renderSingleSeatButton(base + 3)}
        </View>,
      );
    }

    // 3. Last Row: 5 seats side-by-side: seats 66 to 70
    seatLayout.push(
      <View key="row_last" style={styles.seatsRow}>
        {renderSingleSeatButton(66)}
        {renderSingleSeatButton(67)}
        {renderSingleSeatButton(68)}
        {renderSingleSeatButton(69)}
        {renderSingleSeatButton(70)}
      </View>,
    );

    return seatLayout;
  };

  // Render individual seat button
  const renderSingleSeatButton = (num) => {
    const isBooked = bookedSeats[num];
    const isSelected = selectedSeats.some((s) => s.seatNumber === num);
    const occupantGender = isBooked ? isBooked.gender : null;

    let seatColor = "#E2E8F0"; // Default available Grey
    let seatBorder = "#CBD5E1";
    let iconColor = "#64748B";

    if (isBooked) {
      if (occupantGender === "F") {
        seatColor = "#FCE7F3"; // Pink for Female occupied
        seatBorder = "#F9A8D4";
        iconColor = "#DB2777";
      } else {
        seatColor = "#1E293B"; // Black/Dark Slate for Male occupied
        seatBorder = "#0F172A";
        iconColor = "#FFFFFF";
      }
    } else if (isSelected) {
      seatColor = "#FEF3C7"; // Amber for Selected
      seatBorder = "#FCD34D";
      iconColor = "#D97706";
    }

    return (
      <TouchableOpacity
        style={[
          styles.seatBtn,
          { backgroundColor: seatColor, borderColor: seatBorder },
        ]}
        onPress={() => handleSeatClick(num)}
        activeOpacity={0.8}
      >
        <FontAwesome5 name="couch" size={12} color={iconColor} />
        <Text style={[styles.seatNumberLabel, { color: iconColor }]}>
          {num}
        </Text>
      </TouchableOpacity>
    );
  };

  const totalFareAmount = selectedSeats.length * seatFare;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      style={{ zIndex: 99999, elevation: 99999 }}
    >
      <View style={[styles.overlay, { zIndex: 99999, elevation: 99999 }]}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{route.name}</Text>
              <Text style={styles.subtitle}>
                ₹{seatFare} per seat • 70 seats Coach
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Seat Status Badges */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendBox, { backgroundColor: "#E2E8F0" }]}
              />
              <Text style={styles.legendLabel}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendBox, { backgroundColor: "#1E293B" }]}
              />
              <Text style={styles.legendLabel}>Male</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendBox, { backgroundColor: "#FCE7F3" }]}
              />
              <Text style={styles.legendLabel}>Female</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendBox, { backgroundColor: "#FEF3C7" }]}
              />
              <Text style={styles.legendLabel}>Selected</Text>
            </View>
          </View>

          {/* Bus seat selection layout */}
          <View style={styles.busLayoutContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.busGridScroll}
            >
              <View style={styles.driverSection}>
                <Ionicons name="settings" size={16} color="#64748B" />
                <Text style={styles.driverText}>Driver Cabin</Text>
              </View>

              {/* The 70 seats generated dynamically */}
              <View style={styles.seatsArea}>{renderBusSeats()}</View>

              <Text style={styles.busEndLabel}> REAR OF BUS</Text>
            </ScrollView>
          </View>

          {/* Selected seats list & Book trigger */}
          <View style={styles.footerPanel}>
            <View style={styles.footerLeft}>
              <Text style={styles.selectedCountText}>
                {selectedSeats.length} Seat(s) selected
              </Text>
              <Text style={styles.selectedPriceText}>
                ₹{totalFareAmount.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.btnBook,
                selectedSeats.length === 0 ? styles.btnDisabled : null,
              ]}
              onPress={handleDirectPayment}
              disabled={selectedSeats.length === 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnBookText}>Pay</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ==================== SUB-MODAL: PASSENGER FORM POPUP ==================== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activeFormSeat !== null}
        onRequestClose={() => setActiveFormSeat(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.formOverlay}
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Seat #{activeFormSeat} Details</Text>
            <Text style={styles.formSubtitle}>
              Please input passenger details to reserve this seat.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.formLabel}>Passenger Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter full name"
                placeholderTextColor="#94A3B8"
                value={passengerName}
                onChangeText={setPassengerName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.formLabel}>Age</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Age in years"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={passengerAge}
                onChangeText={setPassengerAge}
              />
            </View>

            {/* Gender Toggle Selector */}
            <Text style={styles.formLabel}>Gender</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  passengerGender === "M" ? styles.genderActiveBlue : null,
                ]}
                onPress={() => setPassengerGender("M")}
              >
                <Ionicons
                  name="male"
                  size={16}
                  color={passengerGender === "M" ? "#FFF" : "#64748B"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.genderBtnText,
                    passengerGender === "M" ? styles.genderActiveText : null,
                  ]}
                >
                  Male
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  passengerGender === "F" ? styles.genderActivePink : null,
                ]}
                onPress={() => setPassengerGender("F")}
              >
                <Ionicons
                  name="female"
                  size={16}
                  color={passengerGender === "F" ? "#FFF" : "#64748B"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.genderBtnText,
                    passengerGender === "F" ? styles.genderActiveText : null,
                  ]}
                >
                  Female
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.btnFormCancel}
                onPress={() => setActiveFormSeat(null)}
              >
                <Text style={styles.btnFormCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnFormConfirm}
                onPress={handleConfirmPassenger}
              >
                <Text style={styles.btnFormConfirmText}>Confirm Seat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== SUB-MODAL: SUCCESS ANIMATION ==================== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={paymentSuccessAnim}
        onRequestClose={() => {}}
      >
        <View style={styles.upiOverlay}>
          <View style={styles.upiSuccessContainer}>
            <View style={styles.successCheckCircle}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Booking Successful!</Text>
            <Text style={styles.successSub}>
              Your ₹{totalFareAmount.toFixed(2)} transaction completed securely.
            </Text>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

export default SeatSelectionModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    height: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 14,
  },
  title: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#94A3B8",
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: "#F1F5F9",
    padding: 8,
    borderRadius: 50,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    color: "#64748B",
  },
  busLayoutContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderWidth: 1.5,
    borderRadius: 24,
    marginVertical: 16,
    padding: 16,
  },
  busGridScroll: {
    paddingBottom: 30,
  },
  driverSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: "#CBD5E1",
    paddingBottom: 8,
    marginBottom: 20,
  },
  driverText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    color: "#64748B",
    marginLeft: 6,
  },
  seatsArea: {
    alignItems: "center",
  },
  seatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    marginBottom: 10,
  },
  seatBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  seatNumberLabel: {
    fontSize: 8,
    fontFamily: "Poppins_700Bold",
    marginTop: 2,
  },
  seatPlaceholder: {
    width: 38,
    height: 38,
  },
  aisleSpacer: {
    width: 24,
  },
  busEndLabel: {
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    color: "#94A3B8",
    marginTop: 20,
    letterSpacing: 1,
  },
  footerPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  footerLeft: {
    flexDirection: "column",
  },
  selectedCountText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "#64748B",
  },
  selectedPriceText: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: "#0F172A",
    marginTop: 2,
  },
  btnBook: {
    backgroundColor: "#10B981",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  btnDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  btnBookText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  formOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  formCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  formTitle: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: "#1E293B",
  },
  formSubtitle: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "#64748B",
    marginTop: 2,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#64748B",
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#1E293B",
  },
  genderRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  genderActiveBlue: {
    backgroundColor: "#3B82F6",
  },
  genderActivePink: {
    backgroundColor: "#EC4899",
  },
  genderBtnText: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: "#64748B",
  },
  genderActiveText: {
    color: "#FFFFFF",
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  btnFormCancel: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 10,
  },
  btnFormCancelText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#EF4444",
  },
  btnFormConfirm: {
    flex: 1.3,
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnFormConfirmText: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: "#FFFFFF",
  },
  upiOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  upiCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  upiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 14,
    marginBottom: 16,
  },
  upiHeaderLeft: {
    flexDirection: "column",
  },
  upiTitle: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#1E293B",
  },
  upiTotal: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#64748B",
    marginTop: 2,
  },
  upiClose: {
    backgroundColor: "#F1F5F9",
    padding: 6,
    borderRadius: 50,
  },
  upiAppRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  upiAppBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderWidth: 1.5,
    borderRadius: 14,
    height: 48,
    marginHorizontal: 4,
  },
  upiAppActive: {
    borderColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  upiAppText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#94A3B8",
    marginLeft: 6,
  },
  upiLabel: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#475569",
    textAlign: "center",
    marginBottom: 12,
  },
  pinDotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  pinDotFilled: {
    backgroundColor: "#D97706",
    borderColor: "#F59E0B",
  },
  keypadContainer: {
    alignItems: "center",
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 12,
  },
  keypadBtn: {
    flex: 1,
    height: 48,
    marginHorizontal: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  keypadBtnText: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "#1E293B",
  },
  keypadBtnSpecial: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: "#EF4444",
  },
  upiLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  upiLoadingText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#0284C7",
    marginTop: 12,
  },
  upiSuccessContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 350,
  },
  successCheckCircle: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "#065F46",
  },
  successSub: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#047857",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 20,
  },
});
