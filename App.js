import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from './src/config/firebase';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

// Import Screens
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AdminDashboard from './src/screens/AdminDashboard';
import RouteSetterScreen from './src/screens/RouteSetterScreen';
import DriverModeScreen from './src/screens/DriverModeScreen';
import TicketsScreen from './src/screens/TicketsScreen';
import StopsScreen from './src/screens/StopsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const ADMIN_SESSION_KEY = '@crowdsense_admin_session';

const AnimatedNavItem = ({ iconName, iconOutlineName, isActive, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.85)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isActive ? 1 : 0.85,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isActive ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [isActive]);

  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.navItemActiveBg, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons name={isActive ? iconName : iconOutlineName} size={20} color={isActive ? '#000' : '#FFF'} />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [adminTab, setAdminTab] = useState('dashboard');
  const [studentTab, setStudentTab] = useState('home');

  // Load fonts
  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold,
      });
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  // Restore persisted session on launch
  useEffect(() => {
    let firebaseUnsubscribe = null;

    const restoreSession = async () => {
      // 1. Check for hardcoded admin session first
      try {
        const adminSession = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
        if (adminSession) {
          setUser(JSON.parse(adminSession));
          setShowWelcome(false);
          setAuthChecked(true);
          return; // skip Firebase listener — admin already logged in
        }
      } catch (_) {}

      // 2. Listen to Firebase Auth state (for regular student accounts)
      firebaseUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const userRef = ref(db, `users/${firebaseUser.uid}`);
            const snapshot = await get(userRef);
            let role = 'student';
            if (snapshot.exists() && snapshot.val().role) {
              role = snapshot.val().role;
            }
            setUser({ ...firebaseUser, role });
            setShowWelcome(false);
          } catch (_) {
            setUser({ ...firebaseUser, role: 'student' });
            setShowWelcome(false);
          }
        } else {
          setUser(null);
        }
        setAuthChecked(true);
      });
    };

    restoreSession();
    return () => { if (firebaseUnsubscribe) firebaseUnsubscribe(); };
  }, []);

  // Persist admin sessions on login
  const handleLoginSuccess = async (userObj) => {
    if (userObj?.role === 'admin') {
      try {
        await AsyncStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(userObj));
      } catch (_) {}
    }
    setUser(userObj);
  };

  // Full logout — clears both Firebase and admin session
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
      await auth.signOut();
    } catch (_) {}
    setUser(null);
    setShowWelcome(true);
  };

  // Wait for fonts AND auth check before rendering
  if (!fontsLoaded || !authChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!user) {
    if (showWelcome) {
      return (
        <View style={{ flex: 1 }}>
          <StatusBar style="dark" />
          <WelcomeScreen onContinue={() => setShowWelcome(false)} />
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </View>
    );
  }

  if (user.role === 'admin') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          {adminTab === 'dashboard' && <AdminDashboard onLogout={handleLogout} />}
          {adminTab === 'routes' && <RouteSetterScreen />}
          {adminTab === 'driver' && <DriverModeScreen />}
        </View>

        {/* Custom Bottom Tab Bar for Admin */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tab} onPress={() => setAdminTab('dashboard')}>
            <Ionicons name={adminTab === 'dashboard' ? 'grid' : 'grid-outline'} size={24} color={adminTab === 'dashboard' ? '#7C3AED' : '#94A3B8'} />
            <Text style={[styles.tabText, adminTab === 'dashboard' && styles.tabTextActive]}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => setAdminTab('routes')}>
            <Ionicons name={adminTab === 'routes' ? 'map' : 'map-outline'} size={24} color={adminTab === 'routes' ? '#7C3AED' : '#94A3B8'} />
            <Text style={[styles.tabText, adminTab === 'routes' && styles.tabTextActive]}>Routes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => setAdminTab('driver')}>
            <Ionicons name={adminTab === 'driver' ? 'bus' : 'bus-outline'} size={24} color={adminTab === 'driver' ? '#7C3AED' : '#94A3B8'} />
            <Text style={[styles.tabText, adminTab === 'driver' && styles.tabTextActive]}>Driver Mode</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#94A3B8" />
            <Text style={styles.tabText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Student role
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {studentTab === 'home' && <HomeScreen onLogout={handleLogout} />}
        {studentTab === 'tickets' && <TicketsScreen />}
        {studentTab === 'stops' && <StopsScreen onNavigate={setStudentTab} />}
        {studentTab === 'profile' && <ProfileScreen onLogout={handleLogout} />}
      </View>

      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNav}>
          <AnimatedNavItem
            isActive={studentTab === 'home'}
            onPress={() => setStudentTab('home')}
            iconName="home"
            iconOutlineName="home-outline"
          />
          <AnimatedNavItem
            isActive={studentTab === 'tickets'}
            onPress={() => setStudentTab('tickets')}
            iconName="ticket"
            iconOutlineName="ticket-outline"
          />
          <AnimatedNavItem
            isActive={studentTab === 'stops'}
            onPress={() => setStudentTab('stops')}
            iconName="bus"
            iconOutlineName="bus-outline"
          />
          <AnimatedNavItem
            isActive={studentTab === 'profile'}
            onPress={() => setStudentTab('profile')}
            iconName="person"
            iconOutlineName="person-outline"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 10,
    paddingBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    marginTop: 4,
    color: '#94A3B8',
    fontFamily: 'Poppins_600SemiBold',
  },
  tabTextActive: {
    color: '#7C3AED',
    fontFamily: 'Poppins_700Bold',
  },
  floatingNavContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  floatingNav: {
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 40,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
  },
  navItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  navItemActiveBg: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
  },
});
