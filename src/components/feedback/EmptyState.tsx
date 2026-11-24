import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONTS } from '../../constants/theme';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  customIcon?: React.ReactNode;
  title?: string;
  message?: string;
  description?: string;
  subtitle?: string;
  boxed?: boolean;
  style?: StyleProp<ViewStyle>;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * EmptyState component aligned with Web LMS (components/ui/empty-state.tsx)
 * Default: Unboxed, clean, airy layout with Slate typography (#0F172A, #475569, #94A3B8)
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  customIcon,
  title,
  message,
  description,
  subtitle,
  boxed = false,
  style,
  actionLabel,
  onAction,
}) => {
  const displayTitle = title || message || 'Nothing here yet.';
  const displayDesc = description || subtitle;

  return (
    <View style={[styles.container, boxed && styles.boxedContainer, style]}>
      {customIcon ? (
        <View style={[styles.icon, boxed && styles.boxedIcon]}>{customIcon}</View>
      ) : icon ? (
        <Ionicons name={icon} size={32} color="#94A3B8" style={[styles.icon, boxed && styles.boxedIcon]} />
      ) : null}
      <Text style={[styles.title, boxed && styles.boxedTitle]}>{displayTitle}</Text>
      {displayDesc ? <Text style={styles.description}>{displayDesc}</Text> : null}

      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  boxedContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    marginBottom: 16,
  },
  boxedIcon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontFamily: FONTS.medium,
    fontWeight: '500',
    color: '#0F172A',
    textAlign: 'center',
  },
  boxedTitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    fontWeight: '400',
    color: '#475569',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 320,
  },
  actionBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  actionBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontFamily: FONTS.bold,
    fontWeight: '600',
  },
});

export default EmptyState;
