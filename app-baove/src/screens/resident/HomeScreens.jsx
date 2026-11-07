import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Screen from '../../components/Screen';
import { Card, Divider, EmptyState, ErrorState, Loading, MenuRow, StatusBadge } from '../../components/UI';
import { useAsync } from '../../hooks/useAsync';
import { residentApi } from '../../api/mobile.api';
import { useAuth } from '../../store/AuthContext';
import { COLORS, STATUS_LABELS } from '../../utils/constants';
import { daysUntil, formatDate } from '../../utils/format';
import parkingHero from '../../../assets/visuals/mobile-parking-hero.webp';

const Body = ({ state, children }) => state.loading ? <Loading /> : state.error ? <ErrorState message={state.error} onRetry={state.reload} /> : children;
export const Meta = ({ label, value }) => <View style={s.meta}><Text style={s.metaLabel}>{label}</Text><Text style={s.metaValue}>{value ?? '-'}</Text></View>;

export function ResidentHomeScreen({ navigation }) {
  const { user } = useAuth();
  const state = useAsync(async () => { const [profile, vehicles, tickets, notifications] = await Promise.all([residentApi.getProfile(user.resident.id), residentApi.vehicles(), residentApi.tickets(), residentApi.notifications()]); return { profile, vehicles, tickets, notifications }; }, [user.resident.id], true);
  const active = state.data?.tickets.find((x) => x.status === 'ACTIVE'); const remaining = daysUntil(active?.endDate); const unread = state.data?.notifications.filter((x) => !x.readAt).length || 0;
  return <Screen title={`Chào ${user.fullName.split(' ').slice(-2).join(' ')}`} eyebrow="PARK/OPS · Cư dân" refreshing={state.refreshing} onRefresh={state.refresh} right={<Pressable accessibilityRole="button" accessibilityLabel={`${unread} thông báo chưa đọc`} onPress={() => navigation.navigate('Notifications')} style={s.bell}><Ionicons name="notifications-outline" size={22} color={COLORS.ink} />{unread ? <Text style={s.bellCount}>{unread}</Text> : null}</Pressable>}>
    <Body state={state}>{state.data && <>
      <View style={s.residentHero}><View style={s.residentHeroCopy}><Text style={s.apartment}>{state.data.profile.apartment ? `Tòa ${state.data.profile.apartment.building} · Căn ${state.data.profile.apartment.apartmentNumber}` : 'Chưa liên kết căn hộ'}</Text><Text style={s.heroText}>Vé tháng, phương tiện và lượt ra vào trong một nơi.</Text></View><Image accessible={false} source={parkingHero} style={s.heroImage} resizeMode="contain" /></View>
      {active ? <Card style={s.ticket}><View style={s.row}><Text style={s.kicker}>Vé tháng hiện tại</Text><StatusBadge status={active.status} /></View><Text style={s.plate}>{active.vehicle.licensePlate}</Text><Text style={s.expiry}>Hết hạn {formatDate(active.endDate)}</Text><Button title="Mở mã QR" icon="qr-code-outline" onPress={() => navigation.navigate('TicketQR', { ticket: active })} /></Card> : <EmptyState icon="ticket-outline" title="Chưa có vé hoạt động" message="Tạo đăng ký gửi xe để bắt đầu." />}
      {remaining !== null && remaining >= 0 && remaining <= 7 ? <Pressable onPress={() => navigation.navigate('Tickets')} style={s.warning}><Ionicons name="warning" size={22} color={COLORS.primary} /><View style={{ flex: 1 }}><Text style={s.warningTitle}>Sắp hết hạn trong {remaining} ngày</Text><Text style={s.warningText}>Gia hạn sớm để không gián đoạn ra vào.</Text></View><Ionicons name="chevron-forward" size={18} /></Pressable> : null}
      <View style={s.stats}><Pressable onPress={() => navigation.navigate('Vehicles')} style={s.stat}><Text style={s.statLabel}>Phương tiện</Text><Text style={s.statValue}>{state.data.vehicles.length}</Text><Text style={s.statUnit}>xe của bạn</Text></Pressable><Pressable onPress={() => navigation.navigate('Notifications')} style={s.stat}><Text style={s.statLabel}>Thông báo</Text><Text style={s.statValue}>{unread}</Text><Text style={s.statUnit}>chưa đọc</Text></Pressable></View>
      <View><Text style={s.sectionLabel}>Truy cập nhanh</Text><View style={s.serviceGrid}><Service icon="add-circle-outline" label="Đăng ký" onPress={() => navigation.navigate('RegistrationForm')}/><Service icon="ticket-outline" label="Vé tháng" onPress={() => navigation.navigate('Tickets')}/><Service icon="car-outline" label="Phương tiện" onPress={() => navigation.navigate('Vehicles')}/><Service icon="time-outline" label="Lịch sử" onPress={() => navigation.navigate('History')}/></View></View>
      <Card><MenuRow icon="document-text-outline" title="Đăng ký của tôi" subtitle="Theo dõi trạng thái duyệt" onPress={() => navigation.navigate('Registrations')} /><MenuRow icon="card-outline" title="Thanh toán" subtitle="Trạng thái và hướng dẫn" onPress={() => navigation.navigate('Payments')} /><MenuRow icon="person-outline" title="Tài khoản" subtitle="Hồ sơ và căn hộ" onPress={() => navigation.navigate('Profile')} /></Card>
    </>}</Body>
  </Screen>;
}
function Service({icon,label,onPress}){return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[s.service,pressed&&s.servicePressed]}><View style={s.serviceIcon}><Ionicons name={icon} size={23} color={COLORS.primary}/></View><Text style={s.serviceLabel}>{label}</Text></Pressable>}

export function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const state = useAsync(() => user.role === 'RESIDENT' ? residentApi.getProfile(user.resident.id) : Promise.resolve({ user }), [user.id], true);
  const profile = state.data;
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  function closeConfirmation() {
    if (!loggingOut) setConfirming(false);
  }

  async function confirmLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
    } catch {
      setLogoutError('Chưa thể xóa phiên đăng nhập trên thiết bị. Vui lòng thử lại.');
      setLoggingOut(false);
    }
  }

  return (
    <Screen title="Tài khoản" eyebrow={user.role === 'RESIDENT' ? 'Cư dân' : 'Bảo vệ'} navigation={navigation}>
      <Body state={state}>
        {profile && (
          <>
            <Card>
              <Text style={s.profileName}>{user.fullName}</Text>
              <Text style={s.muted}>{user.email}</Text>
              <Divider />
              <Meta label="Vai trò" value={user.role === 'RESIDENT' ? 'Cư dân' : 'Bảo vệ'} />
              <Meta label="Điện thoại" value={user.phone} />
              {profile.residentCode ? <Meta label="Mã cư dân" value={profile.residentCode} /> : null}
            </Card>
            {profile.apartment && (
              <Card>
                <Text style={s.sectionTitle}>Căn hộ</Text>
                <Meta label="Tòa" value={profile.apartment.building} />
                <Meta label="Số căn" value={profile.apartment.apartmentNumber} />
                <Meta label="Tầng" value={profile.apartment.floor} />
                <Meta label="Chủ hộ" value={profile.apartment.ownerName} />
                <Button variant="secondary" title="Xem căn hộ" onPress={() => navigation.navigate('Apartment')} />
              </Card>
            )}
          </>
        )}
      </Body>
      <Button
        title="Đăng xuất" variant="secondary" icon="log-out-outline" disabled={state.loading}
        onPress={() => { setLogoutError(''); setConfirming(true); }}
      />
      <Modal visible={confirming} transparent onRequestClose={closeConfirmation} accessibilityLabel="Xác nhận đăng xuất">
        <View style={s.modalBackdrop}>
          <Card style={s.logoutDialog}>
            <Text accessibilityRole="header" style={s.profileName}>Đăng xuất?</Text>
            <Text style={s.logoutMessage}>Bạn sẽ cần đăng nhập lại.</Text>
            {logoutError ? <Text accessibilityRole="alert" style={s.logoutError}>{logoutError}</Text> : null}
            <View style={s.logoutActions}>
              <Button title="Ở lại" variant="secondary" disabled={loggingOut} onPress={closeConfirmation} style={s.logoutButton} />
              <Button title="Đăng xuất" variant="danger" loading={loggingOut} onPress={confirmLogout} style={s.logoutButton} />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
export function ApartmentScreen({ navigation }) { const { user } = useAuth(); const state = useAsync(() => residentApi.getProfile(user.resident.id), [user.resident.id], true); return <Screen title="Căn hộ" eyebrow="Thông tin cư trú" navigation={navigation}><Body state={state}>{state.data?.apartment ? <Card><Text style={s.apartmentBig}>{state.data.apartment.building} / {state.data.apartment.apartmentNumber}</Text><Divider /><Meta label="Tầng" value={state.data.apartment.floor} /><Meta label="Chủ hộ" value={state.data.apartment.ownerName} /><Meta label="Trạng thái" value={STATUS_LABELS[state.data.apartment.status]} /></Card> : <EmptyState title="Chưa liên kết căn hộ" />}</Body></Screen>; }

const s = StyleSheet.create({
  modalBackdrop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 20, backgroundColor: 'rgba(18,20,18,.52)'
  },
  logoutDialog: { width: '100%', maxWidth: 380, gap: 10 },
  logoutMessage: { color: COLORS.muted, fontSize: 14 },
  logoutError: { color: COLORS.danger, fontSize: 13 },
  logoutActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  logoutButton: { flex: 1 },
  residentHero: { minHeight: 138, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', paddingLeft: 18, borderRadius: 14, backgroundColor: COLORS.graphite }, residentHeroCopy: { zIndex: 1, flex: 1 }, apartment: { marginTop: 7, color: '#fff', fontSize: 18, fontWeight: '900' }, heroText: { maxWidth: 190, marginTop: 6, color: '#aeb4af', fontSize: 11, lineHeight: 16 }, heroImage: { width: 142, height: 128, marginRight: -18, marginBottom: -10 }, bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, backgroundColor: COLORS.surface }, bellCount: { position: 'absolute', top: 3, right: 3, minWidth: 17, height: 17, borderRadius: 9, overflow: 'hidden', backgroundColor: COLORS.primary, color: '#fff', fontSize: 9, lineHeight: 17, textAlign: 'center', fontWeight: '900' },
  ticket: { gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, kicker: { color: COLORS.muted, fontSize: 13, fontWeight: '700' }, plate: { color: COLORS.ink, fontSize: 32, fontWeight: '900', letterSpacing: .5 }, expiry: { color: COLORS.ink, fontSize: 15 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: COLORS.primary, backgroundColor: COLORS.primarySoft }, warningTitle: { color: COLORS.primaryDark, fontSize: 14, fontWeight: '900' }, warningText: { marginTop: 3, color: COLORS.muted, fontSize: 11 }, stats: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, padding: 16, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, backgroundColor: COLORS.surface }, statLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' }, statValue: { marginTop: 9, color: COLORS.ink, fontSize: 31, fontWeight: '900' }, statUnit: { color: COLORS.muted, fontSize: 11 }, sectionLabel: { marginBottom: 9, color: COLORS.ink, fontSize: 16, fontWeight: '800' }, serviceGrid: { flexDirection: 'row', gap: 8 }, service: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, backgroundColor: COLORS.surface }, servicePressed: { opacity: .65, transform: [{scale:.98}] }, serviceIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.primarySoft }, serviceLabel: { color: COLORS.ink, fontSize: 10, fontWeight: '800' },
  meta: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, metaLabel: { color: COLORS.muted, fontSize: 12 }, metaValue: { flex: 1, color: COLORS.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' }, profileName: { color: COLORS.ink, fontSize: 24, fontWeight: '900' }, muted: { color: COLORS.muted, fontSize: 12, lineHeight: 18 }, sectionTitle: { marginBottom: 8, color: COLORS.ink, fontSize: 16, fontWeight: '900' }, apartmentBig: { color: COLORS.ink, fontSize: 30, fontWeight: '900' }
});
