import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LayoutGrid, List } from 'lucide-react-native';
import { ViewMode } from '../../hooks/useViewPreference';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ view, onChange }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => onChange('table')}
        style={[styles.btn, view === 'table' ? styles.btnActive : styles.btnInactive]}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Table view"
      >
        <List size={16} color={view === 'table' ? '#FFFFFF' : '#475569'} strokeWidth={2} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChange('card')}
        style={[styles.btn, view === 'card' ? styles.btnActive : styles.btnInactive]}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Card view"
      >
        <LayoutGrid size={16} color={view === 'card' ? '#FFFFFF' : '#475569'} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  btn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: '#2563EB',
  },
  btnInactive: {
    backgroundColor: '#FFFFFF',
  },
});

export default ViewToggle;

