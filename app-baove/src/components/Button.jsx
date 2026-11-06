import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

export default function Button({ title, onPress, variant = 'primary', icon, loading = false, disabled = false, style }) {
  const unavailable = disabled || loading;
  const color = variant === 'primary' ? COLORS.ink : variant === 'danger' ? '#fff' : COLORS.primaryDark;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      onPress={onPress}
      disabled={unavailable}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      {loading ? <ActivityIndicator color={color} /> : icon ? <Ionicons name={icon} size={19} color={color} /> : null}
      <Text style={[styles.text, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  primary: { backgroundColor: COLORS.primary },
  secondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: COLORS.danger },
  text: { flexShrink: 1, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: .8 },
  disabled: { opacity: .55 }
});
