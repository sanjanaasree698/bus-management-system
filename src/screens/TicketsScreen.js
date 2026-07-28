import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue } from 'firebase/database';
import { db, auth } from '../config/firebase';
import ActiveTicketModal from '../components/ActiveTicketModal';

const TEAL = '#2CC5A0';
const DARK = '#0F172A';

const TicketsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [activeTickets, setActiveTickets] = useState([]);
  const [expiredTickets, setExpiredTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [qrVisible, setQrVisible] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    const ticketsRef = ref(db, `tickets/${user.uid}`);
    const unsub = onValue(ticketsRef, (snap) => {
      setLoading(true);
      if (snap.exists()) {
        const list = Object.values(snap.val());
        const now = Date.now();
        setActiveTickets(list.filter(t => t.status === 'active' && (t.createdAt + t.durationMs) > now).sort((a, b) => b.createdAt - a.createdAt));
        setExpiredTickets(list.filter(t => t.status !== 'active' || (t.createdAt + t.durationMs) <= now).sort((a, b) => b.createdAt - a.createdAt));
      } else { setActiveTickets([]); setExpiredTickets([]); }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={TEAL} />
      <Text style={styles.loaderText}>Loading tickets...</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tickets</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{activeTickets.length + expiredTickets.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Active */}
        <Text style={styles.sectionTitle}>Active Tickets</Text>
        {activeTickets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="ticket-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No active tickets</Text>
            <Text style={styles.emptySub}>Book from Home to start travelling</Text>
          </View>
        ) : activeTickets.map((t) => {
          const minsLeft = Math.max(0, Math.floor(((t.createdAt + t.durationMs) - Date.now()) / 60000));
          return (
            <TouchableOpacity key={t.id} style={styles.activeCard} onPress={() => { setSelectedTicket(t); setQrVisible(true); }} activeOpacity={0.9}>
              <View style={styles.activeIconBox}>
                <Ionicons name="ticket-outline" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.activeTitle}>{t.title}</Text>
                <Text style={styles.activeMeta}>{t.zones} · {t.tariff}</Text>
                <Text style={styles.activeMeta}>From: {t.from}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                <Text style={styles.activePrice}>₹{t.price?.toFixed(2) || "40.00"}</Text>
                <View style={styles.timerBadge}>
                  <Ionicons name="time-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                  <Text style={styles.timerText}>{minsLeft}m left</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Past */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Past Journeys</Text>
        {expiredTickets.length === 0 ? (
          <View style={[styles.emptyCard, { borderStyle: 'solid', backgroundColor: '#F8FAFC' }]}>
            <Text style={styles.emptyTitle}>No journey history</Text>
          </View>
        ) : expiredTickets.map((t) => {
          const date = new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <View key={t.id} style={styles.pastCard}>
              <View style={styles.pastIcon}>
                <Ionicons name="time-outline" size={16} color="#94A3B8" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.pastTitle}>{t.title}</Text>
                <Text style={styles.pastMeta}>{t.zones} · {date}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pastPrice}>₹{t.price?.toFixed(2)}</Text>
                <View style={styles.expiredBadge}><Text style={styles.expiredBadgeText}>Expired</Text></View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {selectedTicket && (
        <ActiveTicketModal visible={qrVisible} onClose={() => setQrVisible(false)} ticket={selectedTicket} />
      )}
    </View>
  );
};

export default TicketsScreen;

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  loaderText: { fontFamily: 'Poppins_500Medium', color: '#64748B', marginTop: 10, fontSize: 13 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: DARK, flex: 1 },
  countBadge: { backgroundColor: TEAL, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: '#FFFFFF' },

  scroll: { padding: 16, paddingBottom: 110 },
  sectionTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#334155', marginBottom: 12 },

  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: '#E2E8F0', marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#475569', marginTop: 10 },
  emptySub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: '#94A3B8', marginTop: 4, textAlign: 'center' },

  activeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  activeIconBox: { 
    width: 40, height: 40, borderRadius: 12, 
    backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  activeTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#000000' },
  activeMeta: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: '#000000', marginTop: 3 },
  activePrice: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#000000', marginBottom: 3 },
  timerBadge: { 
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ECFDF5', borderRadius: 8, 
    paddingHorizontal: 8, paddingVertical: 4, 
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  timerText: { fontSize: 9, fontFamily: 'Poppins_700Bold', color: '#10B981' },

  pastCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  pastIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  pastTitle: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#475569' },
  pastMeta: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: '#94A3B8', marginTop: 2 },
  pastPrice: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#475569', marginBottom: 4 },
  expiredBadge: { backgroundColor: '#F1F5F9', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  expiredBadgeText: { fontSize: 9, fontFamily: 'Poppins_600SemiBold', color: '#64748B' },
});
