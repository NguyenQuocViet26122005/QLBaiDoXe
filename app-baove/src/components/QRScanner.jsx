import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { COLORS } from '../utils/constants';

function ScannerState({ icon, title, message, action }) {
  return (
    <View style={styles.placeholder}>
      <Ionicons name={icon} size={30} color="#f8a484" />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {action}
    </View>
  );
}

export default function QRScanner({ active = true, locked = false, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);

  if (!active) {
    return <ScannerState icon="scan-outline" title="Camera đang chờ" message="Chọn bãi, nhập cổng và biển số để bắt đầu quét." />;
  }
  if (!permission) {
    return <ScannerState icon="camera-outline" title="Đang kiểm tra quyền camera…" />;
  }
  if (!permission.granted) {
    const canOpenSettings = !permission.canAskAgain && Platform.OS !== 'web';
    const action = permission.canAskAgain
      ? <Button title="Cho phép camera" onPress={requestPermission} />
      : canOpenSettings ? <Button title="Mở cài đặt" onPress={() => Linking.openSettings()} /> : null;
    return (
      <ScannerState
        icon="camera-outline" title="Cần quyền truy cập camera"
        message={permission.canAskAgain ? 'Ứng dụng dùng camera để đọc mã QR trên vé tháng.' : 'Bật lại quyền camera trong phần cài đặt để tiếp tục.'}
        action={action}
      />
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill} facing="back" active={active}
        enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked ? undefined : ({ data }) => onScanned(data)}
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.scanBox}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.hint} accessibilityLiveRegion="polite">{locked ? 'Đang kiểm tra vé…' : 'Đưa mã QR vào giữa khung'}</Text>
      </View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={torch ? 'Tắt đèn pin' : 'Bật đèn pin'}
        accessibilityState={{ selected: torch }} onPress={() => setTorch(value => !value)}
        style={({ pressed }) => [styles.torch, torch && styles.torchOn, pressed && styles.pressed]}
      >
        <Ionicons name={torch ? 'flash' : 'flash-outline'} size={21} color={torch ? COLORS.ink : '#fff'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 278, overflow: 'hidden', borderRadius: 14, backgroundColor: COLORS.camera },
  overlay: { minHeight: 278, gap: 12, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: 'rgba(10,12,10,.26)' },
  scanBox: { width: '60%', maxWidth: 176, aspectRatio: 1, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#fff8ed' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 5 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 5 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 5 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 5 },
  hint: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(18,20,18,.9)', color: '#fff8ed', fontSize: 13, textAlign: 'center' },
  torch: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(18,20,18,.82)' },
  torchOn: { backgroundColor: '#ffc5ae' },
  pressed: { opacity: .72 },
  placeholder: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 14, backgroundColor: COLORS.graphite },
  title: { color: COLORS.surface, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  message: { color: '#d3cbbf', fontSize: 13, lineHeight: 19, textAlign: 'center' }
});
