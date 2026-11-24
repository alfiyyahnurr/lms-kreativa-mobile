import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONTS } from '../../constants/theme';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
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
      {icon ? (
        <Ionicons name={icon} size={38} color="#94A3B8" style={styles.icon} />
      ) : null}
      <Text style={styles.title}>{displayTitle}</Text>
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
    backgroundColor: '#FAFAF8',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E5E0D8',
    marginVertical: 12,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: FONTS.medium,
    fontWeight: '500',
    color: '#0F172A',
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
