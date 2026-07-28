import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref, get, set } from 'firebase/database';
import { db, auth } from '../config/firebase';

const TopUpModal = ({ visible, onClose, currentBalance, onUpdateBalance }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const quickAmounts = ['50', '100', '200', '500'];

  const handleTopUp = async (selectedAmount) => {
    const topUpVal = parseFloat(selectedAmount || amount);
    if (isNaN(topUpVal) || topUpVal <= 0) {
      Alert.alert('Invalid Amount', 'Please select or enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'No user is logged in.');
        setLoading(false);
        return;
      }

      const balanceRef = ref(db, `users/${user.uid}/balance`);
      const snapshot = await get(balanceRef);
      const current = snapshot.exists() ? parseFloat(snapshot.val()) : 0;
      const newBalance = current + topUpVal;
      
      await set(balanceRef, newBalance);
      onUpdateBalance(newBalance);
      
      Alert.alert('Success!', `₹${topUpVal.toFixed(2)} added to your wallet.`);
      setAmount('');
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert('Top Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Top Up Wallet</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Quick Amounts */}
          <Text style={styles.label}>Select Quick Amount</Text>
          <View style={styles.quickGrid}>
            {quickAmounts.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={styles.quickBtn}
                onPress={() => handleTopUp(amt)}
              >
                <Text style={styles.quickBtnText}>+₹{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Input */}
          <Text style={styles.label}>Or Enter Custom Amount (₹)</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencyPrefix}>₹</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => handleTopUp()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Confirm Top Up</Text>
            )}
          </TouchableOpacity>
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
    paddingBottom: 40,
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
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#0F172A',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 50,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#64748B',
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  quickBtnText: {
    color: '#000000',
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  currencyPrefix: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
    color: '#334155',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 54,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: '#0F172A',
  },
  submitBtn: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
  },
});

export default TopUpModal;
