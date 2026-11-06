import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, STATUS_LABELS } from '../utils/constants';
import emptyParking from '../../assets/visuals/empty-parking.webp';

export const Card = ({ children, style, dark = false }) => <View style={[styles.card, dark && styles.darkCard, style]}>{children}</View>;
export const Divider = () => <View style={styles.divider} />;
export function StatusBadge({ status }) {
  const positive = ['ACTIVE', 'PAID', 'APPROVED', 'COMPLETED', 'RESOLVED'].includes(status);
  const warning = ['PENDING', 'OPEN'].includes(status);
  const negative = ['REJECTED', 'EXPIRED', 'LOCKED', 'FAILED', 'ABNORMAL'].includes(status);
  return <View style={[styles.badge, positive && styles.good, warning && styles.warning, negative && styles.bad]}><View style={[styles.dot, positive && styles.goodDot, warning && styles.warningDot, negative && styles.badDot]} /><Text style={[styles.badgeText, positive && styles.goodText, warning && styles.warningText, negative && styles.badText]}>{STATUS_LABELS[status] || status}</Text></View>;
}
export function EmptyState({ title = 'Chưa có dữ liệu', message, actionLabel, onAction }) { return <View style={styles.empty}><Image source={emptyParking} style={styles.emptyImage} resizeMode="contain" /><Text style={styles.emptyTitle}>{title}</Text>{message ? <Text style={styles.emptyText}>{message}</Text> : null}{onAction ? <Pressable onPress={onAction} style={styles.emptyAction}><Ionicons name="add" size={18} color="#fff"/><Text style={styles.emptyActionText}>{actionLabel || 'Tạo mới'}</Text></Pressable> : null}</View>; }
export function Loading() {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Đang tải dữ liệu" accessibilityState={{ busy: true }}>
      <View style={styles.skeletonHero} />
      {[1, 2, 3].map(row => <View key={row} style={styles.skeletonRow} />)}
    </View>
  );
}
export function ErrorState({ message, onRetry }) { return <View style={styles.empty}><View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={28} color={COLORS.danger} /></View><Text style={styles.emptyTitle}>Không tải được dữ liệu</Text><Text style={styles.emptyText}>{message}</Text>{onRetry ? <Pressable onPress={onRetry} style={styles.retryButton}><Ionicons name="refresh" size={17} color={COLORS.primary}/><Text style={styles.retry}>Thử lại</Text></Pressable> : null}</View>; }
export function Field({ label, error, multiline, style, trailing, onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={COLORS.muted}
          style={[styles.input, trailing && styles.inputTrailing, multiline && styles.textarea, focused && styles.inputFocus, error && styles.inputError, style]}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={event => { setFocused(true); onFocus?.(event); }}
          onBlur={event => { setFocused(false); onBlur?.(event); }}
          {...props}
        />
        {trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}
export function MenuRow({ icon, title, subtitle, onPress, accent }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}><View style={[styles.menuIcon, accent && styles.menuAccent]}><Ionicons name={icon} size={20} color={accent ? '#fff' : COLORS.ink} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text>{subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}</View><View style={styles.chevron}><Ionicons name="chevron-forward" size={17} color={COLORS.muted} /></View></Pressable>; }
export function Segmented({ options, value, onChange, dark = false }) { return <View style={[styles.segment, dark && styles.segmentDark]}>{options.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={[styles.segmentItem, value === key && styles.segmentActive]}><Text style={[styles.segmentText, dark && styles.segmentDarkText, value === key && styles.segmentActiveText]}>{label}</Text></Pressable>)}</View>; }

const styles = StyleSheet.create({
  card: { padding: 18, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, backgroundColor: COLORS.surface }, darkCard: { borderColor: '#3c403f', backgroundColor: COLORS.graphiteSoft },
  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: 14 }, badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, backgroundColor: '#ecebe6' }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.muted }, badgeText: { color: COLORS.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }, warning: { backgroundColor: COLORS.warningSoft }, warningDot: { backgroundColor: COLORS.warning }, warningText: { color: COLORS.warning }, good: { backgroundColor: COLORS.successSoft }, goodDot: { backgroundColor: COLORS.success }, goodText: { color: COLORS.success }, bad: { backgroundColor: COLORS.dangerSoft }, badDot: { backgroundColor: COLORS.danger }, badText: { color: COLORS.danger },
  empty: { alignItems: 'center', gap: 9, paddingHorizontal: 24, paddingVertical: 30, borderWidth: 1, borderColor: COLORS.line, borderStyle: 'dashed', borderRadius: 18, backgroundColor: COLORS.surface }, emptyImage: { width: 190, height: 126 }, emptyTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: -.3 }, emptyText: { maxWidth: 290, color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }, emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12, backgroundColor: COLORS.ink }, emptyActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  loading: { gap: 12, paddingVertical: 20 }, skeletonHero: { height: 164, borderRadius: 18, backgroundColor: '#dedbd2' }, skeletonRow: { height: 74, borderRadius: 14, backgroundColor: '#e7e3da' }, errorIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: COLORS.dangerSoft }, retryButton: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11, backgroundColor: COLORS.primarySoft }, retry: { color: COLORS.primary, fontWeight: '900' },
  field: { gap: 6 }, label: { color: COLORS.ink, fontSize: 12, fontWeight: '700' }, inputWrap: { justifyContent: 'center' }, inputTrailing: { paddingRight: 58 }, trailing: { position: 'absolute', right: 4 }, inputFocus: { borderColor: COLORS.primaryDark }, input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: COLORS.surface, color: COLORS.ink, fontSize: 16 }, textarea: { minHeight: 112, paddingTop: 14 }, inputError: { borderColor: COLORS.danger }, error: { color: COLORS.danger, fontSize: 11 },
  menu: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line }, pressed: { opacity: .68, transform: [{ scale: .99 }] }, menuIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#ece9e1' }, menuAccent: { backgroundColor: COLORS.primary }, menuCopy: { flex: 1 }, menuTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' }, menuSub: { marginTop: 3, color: COLORS.muted, fontSize: 11 }, chevron: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#f0eee7' },
  segment: { flexDirection: 'row', gap: 5, padding: 5, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, backgroundColor: '#e8e5dc' }, segmentDark: { borderColor: '#444846', backgroundColor: '#101211' }, segmentItem: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, segmentActive: { backgroundColor: COLORS.primary }, segmentText: { color: COLORS.muted, fontSize: 13, fontWeight: '900' }, segmentDarkText: { color: '#b7bcb9' }, segmentActiveText: { color: COLORS.ink }
});
