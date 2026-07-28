import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import { ref, get, set, update, onValue } from "firebase/database";
import { db, auth } from "../config/firebase";
import TopUpModal from "../components/TopUpModal";

const { width, height } = Dimensions.get("window");

// Premium Palette: Dominant Black/White, Poppins, and Mild Green
const VIOLET = "#000000"; // Changed to Black
const VIOLET_LIGHT = "#F1F5F9"; // Changed to Light Grey
const GREEN = "#10B981";
const GREEN_LIGHT = "#ECFDF5";
const BORDER = "#E2E8F0";
const TEXT_MUTED = "#64748B";

const ProfileScreen = ({ onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Martin");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("+91 98765 43210");
  const [balance, setBalance] = useState(0.0);

  // Emergency Contact States
  const [emergencyContact, setEmergencyContact] = useState({
    name: "Emergency Support",
    phone: "112",
  });

  // Custom Saved Addresses
  const [addresses, setAddresses] = useState([]);

  // Modals Visibility
  const [topUpVisible, setTopUpVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [addressVisible, setAddressVisible] = useState(false);

  // Form Inputs
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const [emerName, setEmerName] = useState("");
  const [emerPhone, setEmerPhone] = useState("");

  const [addrLabel, setAddrLabel] = useState("");
  const [addrValue, setAddrValue] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setUserEmail(user.email);

    // Sync database information
    const userRef = ref(db, `users/${user.uid}`);
    onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.name) {
          setUserName(data.name);
          setEditName(data.name);
        }
        if (data.phone) {
          setUserPhone(data.phone);
          setEditPhone(data.phone);
        }
        if (data.balance !== undefined) setBalance(data.balance);

        if (data.emergencyContact) {
          setEmergencyContact(data.emergencyContact);
          setEmerName(data.emergencyContact.name);
          setEmerPhone(data.emergencyContact.phone);
        }

        if (data.addresses) {
          const list = Object.keys(data.addresses).map((k) => ({
            id: k,
            ...data.addresses[k],
          }));
          setAddresses(list);
        } else {
          setAddresses([]);
        }
      }
      setLoading(false);
    });
  }, []);

  const handleUpdateProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        name: editName,
        phone: editPhone,
      });
      setEditProfileVisible(false);
      Alert.alert("Success", "Profile details updated successfully!");
    } catch (err) {
      Alert.alert("Error", "Failed to update profile details.");
    }
  };

  const handleUpdateEmergency = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = ref(db, `users/${user.uid}/emergencyContact`);
      await set(userRef, {
        name: emerName,
        phone: emerPhone,
      });
      setEmergencyVisible(false);
      Alert.alert("Success", "Emergency contact updated successfully!");
    } catch (err) {
      Alert.alert("Error", "Failed to update emergency contact.");
    }
  };

  const handleAddAddress = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!addrLabel.trim() || !addrValue.trim()) {
      Alert.alert(
        "Fields Required",
        "Please enter both address label and campus stop.",
      );
      return;
    }

    try {
      const addrKey = addrLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const addrRef = ref(db, `users/${user.uid}/addresses/${addrKey}`);
      await set(addrRef, {
        label: addrLabel,
        value: addrValue,
      });

      setAddrLabel("");
      setAddrValue("");
      setAddressVisible(false);
      Alert.alert("Success", "Saved destination address added successfully!");
    } catch (err) {
      Alert.alert("Error", "Failed to add address.");
    }
  };

  const handleDeleteAddress = (key) => {
    const user = auth.currentUser;
    if (!user) return;

    Alert.alert(
      "Remove Address",
      "Are you sure you want to remove this saved address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const addrRef = ref(db, `users/${user.uid}/addresses/${key}`);
            await set(addrRef, null);
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={VIOLET} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header Profile Section */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {userName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userEmail}>{userEmail}</Text>
        <Text style={styles.userPhone}>{userPhone}</Text>
      </View>

      {/* Wallet Card */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <Text style={styles.walletTitle}>DIGITAL CAMPUS WALLET</Text>
          <FontAwesome5 name="wallet" size={14} color={VIOLET} />
        </View>
        <Text style={styles.walletBalance}>₹{balance.toFixed(2)}</Text>
        <TouchableOpacity
          style={styles.topUpBtn}
          onPress={() => setTopUpVisible(true)}
        >
          <Ionicons
            name="add-circle"
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.topUpText}>Top Up Funds</Text>
        </TouchableOpacity>
      </View>

      {/* Saved Addresses Section */}
      <View style={styles.section}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={styles.sectionTitle}>Saved Destinations</Text>
          <TouchableOpacity
            style={styles.addLabelBtn}
            onPress={() => setAddressVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={16} color={VIOLET} />
            <Text style={styles.addLabelText}> Add</Text>
          </TouchableOpacity>
        </View>

        {addresses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              No saved locations added. Add Home or SEC Hostels.
            </Text>
          </View>
        ) : (
          addresses.map((addr) => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={styles.addressLeft}>
                <View style={styles.addressIconWrapper}>
                  <Ionicons name="location" size={18} color={VIOLET} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.addressLabel}>{addr.label}</Text>
                  <Text style={styles.addressVal} numberOfLines={1}>
                    {addr.value}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDeleteAddress(addr.id)}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contact Information</Text>

        <View style={styles.addressCard}>
          <View style={styles.addressLeft}>
            <View
              style={[
                styles.addressIconWrapper,
                { backgroundColor: "#FEF2F2", borderColor: "#FEE2E2" },
              ]}
            >
              <Ionicons name="call" size={18} color="#EF4444" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.addressLabel}>{emergencyContact.name}</Text>
              <Text style={styles.addressVal}>{emergencyContact.phone}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setEmergencyVisible(true)}>
            <Ionicons name="create-outline" size={18} color={VIOLET} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Preferences & Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Preferences</Text>

        {/* Edit Profile Option */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => setEditProfileVisible(true)}
        >
          <View style={styles.optionLeft}>
            <View style={styles.optionIconBg}>
              <Ionicons name="person" size={20} color={VIOLET} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Edit Profile Settings</Text>
              <Text style={styles.optionDesc}>
                Modify username and phone contacts
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* Log Out Option */}
        <TouchableOpacity style={styles.optionCard} onPress={onLogout}>
          <View style={styles.optionLeft}>
            <View
              style={[
                styles.optionIconBg,
                { backgroundColor: "#FEF2F2", borderColor: "#FEE2E2" },
              ]}
            >
              <Ionicons name="log-out" size={20} color="#EF4444" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: "#EF4444" }]}>
                Log Out Account
              </Text>
              <Text style={styles.optionDesc}>Sign out of Crowd Sense Hub</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Crowd Sense Hub • Version 1.1.0</Text>

      {/* MODAL 1: EDIT PROFILE */}
      <Modal visible={editProfileVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Settings</Text>
              <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                <Ionicons name="close" size={22} color="#000000" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter full name"
              />
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleUpdateProfile}
              >
                <Text style={styles.submitBtnText}>Save Profile Settings</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EMERGENCY CONTACT */}
      <Modal visible={emergencyVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Emergency Contact Settings</Text>
              <TouchableOpacity onPress={() => setEmergencyVisible(false)}>
                <Ionicons name="close" size={22} color="#000000" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.inputLabel}>Relative/Guardian Name</Text>
              <TextInput
                style={styles.textInput}
                value={emerName}
                onChangeText={setEmerName}
                placeholder="Enter guardian/emergency contact name"
              />
              <Text style={styles.inputLabel}>Emergency Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={emerPhone}
                onChangeText={setEmerPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: "#EF4444" }]}
                onPress={handleUpdateEmergency}
              >
                <Text style={styles.submitBtnText}>
                  Save Emergency Contacts
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: ADDRESS ADDING */}
      <Modal visible={addressVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Saved Destination</Text>
              <TouchableOpacity onPress={() => setAddressVisible(false)}>
                <Ionicons name="close" size={22} color="#000000" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.inputLabel}>Destination Label</Text>
              <TextInput
                style={styles.textInput}
                value={addrLabel}
                onChangeText={setAddrLabel}
                placeholder="e.g. Home, Hostel Room, SEC Central"
              />
              <Text style={styles.inputLabel}>Campus Stop Station</Text>
              <TextInput
                style={styles.textInput}
                value={addrValue}
                onChangeText={setAddrValue}
                placeholder="e.g. Main Gate"
              />
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddAddress}
              >
                <Text style={styles.submitBtnText}>Add Saved Destination</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Wallet Modal */}
      <TopUpModal
        visible={topUpVisible}
        onClose={() => setTopUpVisible(false)}
        currentBalance={balance}
        onUpdateBalance={(newBal) => setBalance(newBal)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 110,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: VIOLET_LIGHT,
    borderColor: VIOLET,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 30,
    fontFamily: "Poppins_700Bold",
    color: VIOLET,
  },
  userName: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
  },
  userEmail: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: TEXT_MUTED,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: "#94A3B8",
    marginTop: 2,
  },
  walletCard: {
    backgroundColor: "#FFFFFF",
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 28,
    shadowColor: VIOLET,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  walletTitle: {
    fontSize: 9,
    fontFamily: "Poppins_700Bold",
    color: VIOLET,
    letterSpacing: 1,
  },
  walletBalance: {
    fontSize: 30,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    marginBottom: 12,
  },
  topUpBtn: {
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
  },
  topUpText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#475569",
    marginBottom: 12,
  },
  addLabelBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VIOLET_LIGHT,
    borderColor: "#E9D5FF",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  addLabelText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    color: VIOLET,
  },
  addressCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: VIOLET,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  addressLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  addressIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: VIOLET_LIGHT,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  addressLabel: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
  },
  addressVal: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: TEXT_MUTED,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  emptyCardText: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: TEXT_MUTED,
  },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: VIOLET,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionIconBg: {
    backgroundColor: VIOLET_LIGHT,
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
  },
  optionDesc: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    color: TEXT_MUTED,
    marginTop: 2,
  },
  footer: {
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Poppins_400Regular",
    color: "#94A3B8",
    marginTop: 15,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: "#000000",
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: VIOLET,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#FFFFFF",
  },
});

export default ProfileScreen;
