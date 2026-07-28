import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { ref, get, set, push, runTransaction } from 'firebase/database';
import { db, auth } from '../config/firebase';

const BusBookingModal = ({ visible, onClose, currentBalance, onUpdateBalance, onTicketPurchased }) => {
  const [loading, setLoading] = useState(null);

  const ticketOptions = [
    {
      id: '30_min',
      title: '30 minutes',
      tariff: 'Basic Tariff',
      zones: '2 zones',
      price: 30.00,
      durationMs: 30 * 60 * 1000,
      from: 'Main Hub',
      icon: 'clock'
    },
    {
      id: '60_min',
      title: '60 minutes',
      tariff: 'Transfer Tariff',
      zones: '3 zones',
      price: 50.00,
      durationMs: 60 * 60 * 1000,
      from: 'SEC Tech Park',
      icon: 'exchange-alt'
    },
    {
      id: '24_hours',
      title: '24 Hours Pass',
      tariff: 'Unlimited College Pass',
      zones: 'All zones',
      price: 150.00,
      durationMs: 24 * 60 * 60 * 1000,
      from: 'Campus Gate 1',
      icon: 'calendar-day'
    }
  ];

  const handlePurchase = async (ticket) => {
    if (currentBalance < ticket.price) {
      Alert.alert(
        'Insufficient Balance',
        `Your balance (₹${currentBalance.toFixed(2)}) is lower than the ticket price (₹${ticket.price.toFixed(2)}). Please top up.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(ticket.id);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'No user is logged in.');
        setLoading(null);
        return;
      }

      // Deduct balance
      const newBalance = currentBalance - ticket.price;
      const balanceRef = ref(db, `users/${user.uid}/balance`);
      await set(balanceRef, newBalance);
      onUpdateBalance(newBalance);

      // Create ticket
      const ticketsRef = ref(db, `tickets/${user.uid}`);
      const newTicketRef = push(ticketsRef);
      const ticketData = {
        id: newTicketRef.key,
        title: ticket.title,
        tariff: ticket.tariff,
        zones: ticket.zones,
        price: ticket.price,
        from: ticket.from,
        createdAt: Date.now(),
        durationMs: ticket.durationMs,
        status: 'active'
      };
      
      await set(newTicketRef, ticketData);

      // Increment global booked count for Admin console
      const bookedRef = ref(db, 'passengers/booked');
      await runTransaction(bookedRef, (curr) => {
        return (curr || 0) + 1;
      });
      
      Alert.alert(
        'Ticket Booked!',
        `Successfully booked "${ticket.title}" ticket. You can now use its QR code for travel.`,
        [{ text: 'View Ticket', onPress: () => {
          onClose();
          if (onTicketPurchased) onTicketPurchased(ticketData);
        }}]
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Purchase Failed', error.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Book Tickets</Text>
              <Text style={styles.subtitle}>Select a pass for your journey</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Current Balance */}
          <View style={styles.balanceContainer}>
            <Ionicons name="wallet-outline" size={20} color="#0284C7" />
            <Text style={styles.balanceText}>
              Available Balance: <Text style={styles.balanceHighlight}>₹{currentBalance.toFixed(2)}</Text>
            </Text>
          </View>

          {/* Ticket Options List */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
            {ticketOptions.map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketLeft}>
                  <View style={styles.iconContainer}>
                    <FontAwesome5 name={ticket.icon} size={20} color="#0284C7" />
                  </View>
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketTitle}>{ticket.title}</Text>
                    <Text style={styles.ticketMeta}>
                      {ticket.zones} • {ticket.tariff}
                    </Text>
                    <Text style={styles.ticketFrom}>From: {ticket.from}</Text>
                  </View>
                </View>
                
                <View style={styles.ticketRight}>
                  <Text style={styles.ticketPrice}>₹{ticket.price.toFixed(2)}</Text>
                  <TouchableOpacity
                    style={styles.buyBtn}
                    onPress={() => handlePurchase(ticket)}
                    disabled={loading !== null}
                  >
                    {loading === ticket.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="cart-outline" size={20} color="#FFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 30,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 50,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  balanceText: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: '#0369A1',
    marginLeft: 8,
  },
  balanceHighlight: {
    fontFamily: 'Poppins_700Bold',
  },
  listContainer: {
    paddingBottom: 20,
  },
  ticketCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  ticketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderRadius: 14,
    marginRight: 14,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: '#0F172A',
  },
  ticketMeta: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  ticketFrom: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: '#94A3B8',
    marginTop: 4,
  },
  ticketRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  ticketPrice: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  buyBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
});

export default BusBookingModal;
