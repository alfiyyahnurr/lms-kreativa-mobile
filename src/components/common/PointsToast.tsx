import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../constants/theme';
import { ToastNotification } from '../../types';

interface PointsToastProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}

export const PointsToast: React.FC<PointsToastProps> = ({ toast, onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    // Slide in & Fade in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after duration (default 4000ms)
    const timer = setTimeout(() => {
      handleClose();
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -15,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const isError = toast.type === 'error';
  const bgColor = isError ? '#DC2626' : '#16A34A';
  const iconName = isError ? 'close-circle' : 'checkmark-circle';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.contentRow}>
        <Ionicons name={iconName} size={18} color="#FFFFFF" />
        <Text style={styles.toastText}>{toast.message}</Text>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16A34A', // Web LMS bg-green-600
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 8,
    alignSelf: 'flex-end',
    maxWidth: '92%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toastText: {
    fontFamily: FONTS.medium,
    fontWeight: '500',
    fontSize: 14,
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  closeBtn: {
    marginLeft: 6,
    padding: 2,
  },
});

export default PointsToast;
