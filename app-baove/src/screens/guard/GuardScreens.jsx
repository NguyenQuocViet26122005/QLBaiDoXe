import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import Button from '../../components/Button';
import QRScanner from '../../components/QRScanner';
import Screen from '../../components/Screen';
import { Card, EmptyState, ErrorState, Field, Loading, MenuRow, Segmented, StatusBadge } from '../../components/UI';
import { useAsync } from '../../hooks/useAsync';
import { guardApi } from '../../api/mobile.api';
import { useAuth } from '../../store/AuthContext';
import { COLORS, VIOLATION_TYPES } from '../../utils/constants';
import { formatDate, formatMoney, formatTime } from '../../utils/format';

const Body = ({ state, children }) => state.loading ? <Loading /> : state.error ? <ErrorState message={state.error} onRetry={state.reload} /> : children;
export function GuardHomeScreen({ navigation }) {
  const { user } = useAuth();
  const focused = useIsFocused(), lock = useRef(false), pending = useRef(null);
  const [mode, setMode] = useState('IN'), [gate, setGate] = useState('Cổng A'), [areaId, setArea] = useState(null), [plate, setPlate] = useState(''), [loading, setLoading] = useState(false);
  const areas = useAsync(guardApi.areas, [], false);
  const scan = async (raw) => {
    if (lock.current) return;
    if (gate.trim().length < 2 || !areaId || plate.trim().length < 4) return Alert.alert('Cần đối chiếu xe', 'Chọn bãi đang trực, nhập cổng và biển số thực tế trước khi quét.');
    if (!raw || raw.length < 20) return Alert.alert('QR không hợp lệ', 'Mã QR không đúng định dạng của hệ thống.');
    lock.current = true; setLoading(true);
    const details = { areaId, licensePlate: plate.trim().toUpperCase(), gate: gate.trim(), mode };
    const fingerprint = JSON.stringify({ raw, ...details });
    let ticket;
    try {
      const retry = pending.current?.fingerprint === fingerprint ? pending.current : null;
      ticket = retry?.ticket || await guardApi.verifyQr(raw, details);
      const confirmed = await new Promise(resolve => Alert.alert(
        mode === 'IN' ? 'Xác nhận cho xe vào?' : 'Xác nhận xe đã ra?',
        `Biển số trên vé: ${ticket.vehicle.licensePlate}\nBãi: ${ticket.area.name}\nHãy đối chiếu xe thực tế trước khi xác nhận.${ticket.status === 'EXPIRED' ? '\nVé đã hết hạn: chỉ cho phép ra bãi.' : ''}`,
        [{ text: 'Hủy', style: 'cancel', onPress: () => resolve(false) }, { text: 'Đã đối chiếu', onPress: () => resolve(true) }],
        { cancelable: false },
      ));
      if (!confirmed) return;
      const attempt = retry || { fingerprint, ticket, requestId: `scan-${mode}-${Date.now()}-${Math.random().toString(36).slice(2)}` };
      pending.current = attempt;
      const session = mode === 'IN'
        ? await guardApi.checkIn(raw, details.gate, attempt.requestId, details)
        : await guardApi.checkOut(raw, details.gate, attempt.requestId, details);
      pending.current = null;
      navigation.navigate('GuardResult', { success: true, mode, ticket, session });
    } catch (e) {
      if (!e.isNetwork && !['NETWORK_ERROR', 'API_TIMEOUT'].includes(e.code)) pending.current = null;
      navigation.navigate('GuardResult', { success: false, mode, ticket, message: e.message, code: e.code, networkError: e.isNetwork });
    } finally {
      setLoading(false);
      setTimeout(() => { lock.current = false; }, 1000);
    }
  };
  const canScan = focused && Boolean(areaId) && plate.trim().length >= 4 && gate.trim().length >= 2;

  return (
    <Screen
      title="Điều phối tại cổng"
      eyebrow={`PARK/OPS · ${user.fullName}`}
      right={
        <Pressable
          accessibilityRole="button" accessibilityLabel="Tài khoản"
          onPress={() => navigation.navigate('Profile')}
          style={({ pressed }) => [s.profile, pressed && s.pressed]}
        >
          <Ionicons name="person-outline" size={20} color={COLORS.ink} />
        </Pressable>
      }
    >
      <Card style={s.controls}>
        <Text accessibilityRole="header" style={s.sectionTitle}>Thông tin đối chiếu</Text>
        <Segmented value={mode} onChange={setMode} options={[[ 'IN', 'Vào bãi' ], [ 'OUT', 'Ra bãi' ]]} />
        <Text style={s.label}>Bãi đang trực</Text>
        {areas.loading ? (
          <Text accessibilityRole="progressbar" accessibilityLabel="Đang tải danh sách bãi" style={s.help}>Đang tải danh sách bãi…</Text>
        ) : areas.error ? (
          <ErrorState message={areas.error} onRetry={areas.reload} />
        ) : areas.data?.length ? (
          <View style={s.chips}>
            {areas.data.map(area => {
              const selected = areaId === area.id;
              return (
                <Pressable
                  key={area.id} accessibilityRole="button" accessibilityState={{ selected }}
                  onPress={() => setArea(area.id)}
                  style={({ pressed }) => [s.areaChip, selected && s.areaSelected, pressed && s.pressed]}
                >
                  {selected ? <Ionicons name="checkmark-circle" size={17} color={COLORS.primaryDark} /> : null}
                  <View style={s.areaCopy}>
                    <Text style={[s.chipText, selected && s.areaTextSelected]}>{area.name}</Text>
                    {area.status !== 'ACTIVE' ? <Text style={s.help}>Chỉ ra</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : <Text style={s.help}>Chưa có bãi để chọn.</Text>}
        <Field label="Cổng thực hiện" value={gate} onChangeText={setGate} placeholder="Ví dụ: Cổng A" />
        <Field label="Biển số hoặc mã xe quan sát" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="Nhập biển số thực tế" />
      </Card>
      <View style={s.scannerSection}>
        <Text accessibilityRole="header" style={s.sectionTitle}>Quét mã QR</Text>
        <QRScanner active={canScan} locked={loading} onScanned={scan} />
        <Text style={s.help}>Chỉ ghi nhận sau khi đối chiếu xe và xác nhận. Mất QR hoặc vé khóa cần quản lý xác minh lượt ra.</Text>
      </View>
      <Card style={s.shortcuts}>
        <MenuRow icon="time-outline" title="Lịch sử ra vào" onPress={() => navigation.navigate('GuardHistory')} />
        <MenuRow icon="warning-outline" title="Biên bản vi phạm" onPress={() => navigation.navigate('GuardViolations')} />
      </Card>
    </Screen>
  );
}

export function GuardResultScreen({ navigation, route }) {
  const { success, mode, ticket, session, message, code, networkError } = route.params;
  const uncertain = networkError || ['NETWORK_ERROR', 'API_TIMEOUT'].includes(code);
  const tone = success
    ? { accent: COLORS.success, background: COLORS.successSoft, icon: 'checkmark' }
    : uncertain
      ? { accent: COLORS.warning, background: COLORS.warningSoft, icon: 'cloud-offline-outline' }
      : { accent: COLORS.danger, background: COLORS.dangerSoft, icon: 'close' };
  const title = success
    ? mode === 'IN' ? 'Đã ghi nhận xe vào' : 'Đã ghi nhận xe ra'
    : uncertain ? 'Chưa có kết quả' : 'Không thể ghi nhận lượt';

  return (
    <Screen title="Kết quả xác thực" navigation={navigation}>
      <View style={[s.resultNotice, { backgroundColor: tone.background }]} accessibilityLiveRegion="polite">
        <View style={[s.resultIcon, { backgroundColor: tone.accent }]}>
          <Ionicons name={tone.icon} size={24} color="#fff" />
        </View>
        <View style={s.resultCopy}>
          <Text style={s.resultTitle}>{title}</Text>
          <Text style={s.resultMessage}>{success ? 'Dữ liệu đã được ghi nhận tại máy chủ.' : message}</Text>
        </View>
      </View>
      <Card>
        {success ? (
          <>
            <View style={s.resultVehicle}>
              <Text style={s.resultPlate}>{ticket.vehicle.licensePlate}</Text>
              <StatusBadge status={ticket.status} />
            </View>
            <Info label="Mã vé" value={ticket.ticketCode} />
            <Info label="Bãi xe" value={ticket.area.name} />
            <Info label="Cổng" value={mode === 'IN' ? session.checkInGate : session.checkOutGate} />
          </>
        ) : <Info label="Mã lỗi" value={code || 'UNKNOWN'} />}
      </Card>
      <Button title={uncertain ? 'Thử quét lại khi có mạng' : 'Quét vé tiếp theo'} icon="scan-outline" onPress={() => navigation.popToTop()} />
      {!success && !uncertain ? (
        <Button
          variant="danger" title="Lập biên bản" icon="document-text-outline"
          onPress={() => navigation.navigate('GuardViolationForm', { reason: message, vehicleId: ticket?.vehicleId })}
        />
      ) : null}
    </Screen>
  );
}
const Info = ({ label, value }) => <View style={s.info}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value ?? '-'}</Text></View>;
export function GuardHistoryScreen({ navigation }) { const state = useAsync(guardApi.sessions, [], true); return <Screen title="Lịch sử ra vào" eyebrow="Toàn bộ bãi xe" navigation={navigation} refreshing={state.refreshing} onRefresh={state.refresh}><Body state={state}>{state.data?.length ? state.data.map((x) => <Card key={x.id}><View style={s.row}><Text style={s.date}>{formatDate(x.checkInAt)}</Text><StatusBadge status={x.status} /></View><Text style={s.plate}>{x.vehicle.licensePlate}</Text><Info label="Vào" value={`${formatTime(x.checkInAt)} · ${x.checkInGate}`} /><Info label="Ra" value={x.checkOutAt ? `${formatTime(x.checkOutAt)} · ${x.checkOutGate}` : 'Chưa rời bãi'} /><Info label="Khu vực" value={x.area.name} /></Card>) : <EmptyState icon="time-outline" title="Chưa có lượt ra vào" />}</Body></Screen>; }
export function GuardViolationsScreen({ navigation }) { const state = useAsync(guardApi.violations, [], true); return <Screen title="Biên bản vi phạm" eyebrow="Ghi nhận tại cổng" navigation={navigation} refreshing={state.refreshing} onRefresh={state.refresh} right={<Pressable accessibilityRole="button" accessibilityLabel="Lập biên bản" onPress={() => navigation.navigate('GuardViolationForm')} style={s.add}><Ionicons name="add" size={23} color="#fff" /></Pressable>}><Body state={state}>{state.data?.length ? state.data.map((x) => <Card key={x.id}><View style={s.row}><Text style={s.code}>BIÊN BẢN #{x.id}</Text><StatusBadge status={x.status} /></View><Text style={s.plate}>{x.vehicle.licensePlate}</Text><Text style={s.description}>{x.description}</Text><Info label="Loại" value={VIOLATION_TYPES.find(([k]) => k === x.type)?.[1] || x.type} /><Info label="Thời gian" value={formatDate(x.occurredAt, true)} /><Info label="Mức phạt" value={formatMoney(x.fineAmount)} /></Card>) : <EmptyState icon="warning-outline" title="Chưa có biên bản" />}</Body></Screen>; }
export function GuardViolationFormScreen({ navigation, route }) { const requestId=useRef(`violation-${Date.now()}-${Math.random().toString(36).slice(2)}`); const [licensePlate, setLicensePlate] = useState(''); const vehicleId = route.params?.vehicleId; const [type, setType] = useState('OTHER'); const [description, setDescription] = useState(route.params?.reason || ''); const [fine, setFine] = useState('0'); const [loading, setLoading] = useState(false); const submit = async () => { if ((!vehicleId && licensePlate.trim().length < 4) || description.trim().length < 3) return Alert.alert('Thiếu thông tin', 'Nhập biển số thực tế và mô tả ít nhất 3 ký tự.'); setLoading(true); try { const resolvedVehicleId = vehicleId || (await guardApi.lookupVehicle(licensePlate.trim())).id; await guardApi.createViolation({ vehicleId: Number(resolvedVehicleId), type, description: description.trim(), fineAmount: Number(fine || 0), requestId:requestId.current }); Alert.alert('Đã lập biên bản', 'Cư dân sẽ nhận được thông báo.', [{ text: 'Hoàn tất', onPress: () => navigation.replace('GuardViolations') }]); } catch (e) { Alert.alert('Không thể lưu', e.message); } finally { setLoading(false); } }; return <Screen title="Lập biên bản" eyebrow="Xử lý tại cổng" navigation={navigation}><Card style={s.form}>{vehicleId ? <Text>Phương tiện đã đối chiếu từ QR</Text> : <Field label="BIỂN SỐ / MÃ XE THỰC TẾ" value={licensePlate} onChangeText={setLicensePlate} autoCapitalize="characters" />}<Text style={s.label}>LOẠI VI PHẠM</Text><View style={s.chips}>{VIOLATION_TYPES.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: type === key }} onPress={() => setType(key)} style={[s.chip, type === key && s.chipActive]}><Text style={[s.chipText, type === key && s.chipTextActive]}>{label}</Text></Pressable>)}</View><Field label="MÔ TẢ SỰ VIỆC" value={description} onChangeText={setDescription} multiline /><Field label="MỨC PHẠT DỰ KIẾN" value={fine} onChangeText={setFine} keyboardType="number-pad" /></Card><Button title="Lưu biên bản" loading={loading} onPress={submit} /></Screen>; }
export function GuardMenuScreen({ navigation }) { return <Screen title="Nghiệp vụ bảo vệ" eyebrow="Truy cập nhanh" navigation={navigation}><Card><MenuRow icon="scan-outline" title="Quét mã QR" onPress={() => navigation.navigate('GuardHome')} /><MenuRow icon="time-outline" title="Lịch sử ra vào" onPress={() => navigation.navigate('GuardHistory')} /><MenuRow icon="warning-outline" title="Biên bản vi phạm" onPress={() => navigation.navigate('GuardViolations')} /><MenuRow icon="person-outline" title="Tài khoản" onPress={() => navigation.navigate('Profile')} /></Card></Screen>; }
const s = StyleSheet.create({
  controls: { gap: 12 },
  sectionTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '800' },
  profile: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: COLORS.surface
  },
  pressed: { opacity: .7 },
  areaChip: {
    minHeight: 44, minWidth: 0, flexBasis: 115, flexGrow: 1, flexDirection: 'row', alignItems: 'center',
    gap: 6, padding: 9, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.surface
  },
  areaSelected: { borderColor: COLORS.primaryDark, backgroundColor: COLORS.primarySoft },
  areaCopy: { flex: 1 },
  areaTextSelected: { color: COLORS.primaryDark },
  scannerSection: { gap: 9 },
  help: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  shortcuts: { paddingVertical: 0 },
  resultNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14 },
  resultIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  resultCopy: { flex: 1, gap: 4 },
  resultTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800' },
  resultMessage: { color: COLORS.ink, fontSize: 13, lineHeight: 19 },
  resultVehicle: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 },
  resultPlate: { color: COLORS.ink, fontSize: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  info: { width: '100%', minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: COLORS.line },
  infoLabel: { color: COLORS.muted, fontSize: 12 },
  infoValue: { flex: 1, color: COLORS.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, date: { color: COLORS.ink, fontSize: 13, fontWeight: '900' }, plate: { marginVertical: 9, color: COLORS.ink, fontSize: 22, fontWeight: '900' }, add: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: COLORS.primary }, code: { color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, description: { marginBottom: 8, color: COLORS.ink, fontSize: 12, lineHeight: 18 }, form: { gap: 16 }, label: { color: COLORS.ink, fontSize: 11, fontWeight: '900' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6 }, chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary }, chipText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' }, chipTextActive: { color: COLORS.ink }
});
