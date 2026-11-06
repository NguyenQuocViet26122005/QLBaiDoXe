import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';

export default function Screen({ title, eyebrow, children, navigation, scroll = true, refreshing = false, onRefresh, right, dark = false }) {
  const insets = useSafeAreaInsets();
  const content = <View style={styles.content}>{children}</View>;

  return (
    <View style={[styles.safe, dark && styles.dark, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={[styles.header, dark && styles.darkHeader]}>
        <View style={styles.headerInner}>
          {navigation?.canGoBack() && (
            <Pressable
              accessibilityRole="button" accessibilityLabel="Quay lại"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.back, dark && styles.darkBack, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={21} color={dark ? '#fff' : COLORS.ink} />
            </Pressable>
          )}
          <View style={styles.titleWrap}>
            {eyebrow ? <Text style={[styles.eyebrow, dark && styles.darkMuted]}>{eyebrow}</Text> : null}
            <Text accessibilityRole="header" style={[styles.title, dark && styles.darkText]}>{title}</Text>
          </View>
          {right}
        </View>
      </View>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryDark} /> : undefined}
        >
          {content}
        </ScrollView>
      ) : content}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  dark: { backgroundColor: COLORS.graphite },
  header: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  darkHeader: { borderBottomColor: '#3d423b' },
  headerInner: {
    width: '100%', maxWidth: 660, alignSelf: 'center', minHeight: 72,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10
  },
  back: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: COLORS.surface
  },
  darkBack: { borderColor: '#3d423b', backgroundColor: COLORS.graphiteSoft },
  titleWrap: { flex: 1, minWidth: 0 },
  eyebrow: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  title: { color: COLORS.ink, fontSize: 23, fontWeight: '800', letterSpacing: -.55 },
  darkText: { color: COLORS.surface },
  darkMuted: { color: '#d3cbbf' },
  pressed: { opacity: .72 },
  content: { width: '100%', maxWidth: 660, alignSelf: 'center', flexGrow: 1, gap: 14, padding: 16 }
});
