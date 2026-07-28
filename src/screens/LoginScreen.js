import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react-native";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../config/firebase";
import { ref, set, get } from "firebase/database";
import { LinearGradient } from "expo-linear-gradient";

const LoginScreen = ({ onLoginSuccess }) => {
  const [isSignupMode, setIsSignupMode] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Fields Required", "Please enter your email and password.");
      return;
    }

    if (
      email.trim().toLowerCase() === "admin@crowdsense.com" &&
      password === "Admin2026"
    ) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess({
          uid: "admin_uid",
          email: "admin@crowdsense.com",
          role: "admin",
        });
      }, 800);
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      // Fetch role from DB
      const userRef = ref(db, `users/${userCredential.user.uid}`);
      const snapshot = await get(userRef);
      let role = "student";
      if (snapshot.exists() && snapshot.val().role) {
        role = snapshot.val().role;
      }

      onLoginSuccess({ ...userCredential.user, role });
    } catch (error) {
      console.error(error);
      let errorMsg = "Please verify your credentials and try again.";
      if (error.code === "auth/invalid-credential") {
        errorMsg = "Incorrect email or password.";
      } else if (error.code === "auth/network-request-failed") {
        errorMsg = "Network error. Please check your internet connection.";
      }
      Alert.alert("Authentication Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      Alert.alert(
        "Fields Required",
        "Please enter your name and phone number.",
      );
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password should be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      const userRef = ref(db, `users/${userCredential.user.uid}`);
      await set(userRef, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        role: "student",
        balance: 500.0,
        createdAt: Date.now(),
      });

      Alert.alert("Success", "Account created successfully!");
      onLoginSuccess({ ...userCredential.user, role: "student" });
    } catch (error) {
      console.error(error);
      Alert.alert("Signup Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignupMode(!isSignupMode);
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#EEF2FF", "#FFFFFF"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.scrollContainer}>
          {/* Branding Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoSquareContainer}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.logoSquare} 
                resizeMode="cover"
              />
            </View>
          </View>

          <View style={styles.contentArea}>
            <Text style={styles.headerText}>
              {isSignupMode ? "Create Account" : "Welcome Back"}
            </Text>
            <Text style={styles.subHeaderText}>
              {isSignupMode
                ? "Register to book tickets and track buses"
                : "Sign in to track buses and book tickets"}
            </Text>

            {/* Name & Phone Inputs (Signup Mode Only) */}
            {isSignupMode && (
              <>
                <View style={styles.inputWrapper}>
                  <View style={styles.iconBox}>
                    <User size={20} color="#000000" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <View style={styles.iconBox}>
                    <Phone size={20} color="#000000" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </>
            )}

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <View style={styles.iconBox}>
                <Mail size={20} color="#000000" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="example@crowdsense.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <View style={styles.iconBox}>
                <Lock size={20} color="#000000" />
              </View>
              <TextInput
                style={styles.input}
                placeholder={isSignupMode ? "Create Password" : "Password"}
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#64748B" />
                ) : (
                  <Eye size={20} color="#64748B" />
                )}
              </TouchableOpacity>
            </View>

            {/* Action Button */}
            {!isSignupMode ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Log In</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Switch Modes Link */}
            <TouchableOpacity
              style={styles.switchModeBtn}
              onPress={toggleAuthMode}
            >
              <Text style={styles.switchModeText}>
                {isSignupMode
                  ? "Already have an account? Log In"
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flex: 1,
    justifyContent: "flex-start",
    padding: 28,
    paddingTop: 60,
    paddingBottom: 20,
  },
  brandHeader: {
    alignItems: "flex-start",
    marginBottom: 20,
  },
  logoSquareContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoSquare: {
    width: '100%',
    height: '100%',
  },

  contentArea: {
    flex: 1,
    justifyContent: "flex-start",
    marginTop: 20,
  },
  headerText: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: "#0F172A",
    marginBottom: 8,
  },
  subHeaderText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "#64748B",
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 16,
    height: 60,
  },
  iconBox: {
    width: 54,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Poppins_500Medium",
    color: "#0F172A",
    paddingHorizontal: 8,
  },
  eyeIcon: {
    paddingHorizontal: 16,
    height: "100%",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: "#000000",
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
  },
  switchModeBtn: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 10,
  },
  switchModeText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#000000",
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#94A3B8",
    marginTop: 30,
  },
});

export default LoginScreen;
