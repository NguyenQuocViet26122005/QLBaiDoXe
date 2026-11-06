import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../components/Button';
import { Field } from '../components/UI';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../utils/constants';
import parkingHero from '../../assets/visuals/mobile-parking-hero.webp';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('resident1@parking.local');
  const [password, setPassword] = useState('Parking@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function submit() {
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.layout}>
          <View style={styles.brand}>
            <View style={styles.brandCopy}>
              <Text style={styles.wordmark}>PARK<Text style={styles.brandAccent}>/OPS</Text></Text>
              <Text style={styles.brandSubtitle}>Quản lý gửi xe chung cư</Text>
            </View>
            <Image accessible={false} source={parkingHero} style={styles.hero} resizeMode="contain" />
          </View>
          <View style={styles.panel}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>Đăng nhập</Text>
              <Text style={styles.subtitle}>Sử dụng tài khoản cư dân hoặc bảo vệ được cấp.</Text>
            </View>
            {error ? (
              <View style={styles.error} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={20} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field
              label="Mật khẩu" value={password} onChangeText={setPassword}
              secureTextEntry={!show} autoComplete="current-password" onSubmitEditing={submit}
              trailing={
                <Pressable
                  accessibilityRole="button" accessibilityLabel={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onPress={() => setShow(value => !value)}
                  style={({ pressed }) => [styles.passwordAction, pressed && styles.pressed]}
                >
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.ink} />
                </Pressable>
              }
            />
            <Button title="Đăng nhập" icon="arrow-forward" loading={loading} onPress={submit} />
            <Text style={styles.demo}>Demo: resident1@parking.local hoặc guard1@parking.local · Parking@123</Text>
          </View>
          <Text style={styles.footer}>QR được xác thực tại máy chủ</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.graphite },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: 20 },
  layout: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 16 },
  brand: { minHeight: 120, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 4 },
  brandCopy: { flex: 1 },
  wordmark: { color: COLORS.surface, fontSize: 29, fontWeight: '800', letterSpacing: -.8 },
  brandAccent: { color: COLORS.primary },
  brandSubtitle: { color: '#d3cbbf', fontSize: 12, marginTop: 4 },
  hero: { width: '42%', maxWidth: 180, height: 116 },
  panel: { gap: 16, padding: 18, borderRadius: 16, backgroundColor: COLORS.surface },
  heading: { gap: 4 },
  title: { color: COLORS.ink, fontSize: 26, fontWeight: '800', letterSpacing: -.55 },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: COLORS.dangerSoft },
  errorText: { flex: 1, color: COLORS.danger, fontSize: 13 },
  passwordAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: .7 },
  demo: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  footer: { color: '#d3cbbf', fontSize: 12, textAlign: 'center' }
});
