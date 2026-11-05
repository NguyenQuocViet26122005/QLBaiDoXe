import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import { ResidentHomeScreen, ProfileScreen, ApartmentScreen } from '../screens/resident/HomeScreens';
import { VehiclesScreen, VehicleFormScreen, RegistrationsScreen, RegistrationFormScreen } from '../screens/resident/VehicleRegistrationScreens';
import { TicketsScreen, TicketQRScreen, LostQRScreen, PaymentsScreen, HistoryScreen, NotificationsScreen } from '../screens/resident/TicketInfoScreens';
import { GuardHomeScreen, GuardResultScreen, GuardHistoryScreen, GuardViolationsScreen, GuardViolationFormScreen, GuardMenuScreen } from '../screens/guard/GuardScreens';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../utils/constants';

const Stack = createNativeStackNavigator();
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: COLORS.background, card: COLORS.background, text: COLORS.ink, primary: COLORS.primary, border: COLORS.line } };
const options = { headerShown: false, contentStyle: { backgroundColor: COLORS.background }, animation: 'slide_from_right', gestureEnabled: true };
export default function AppNavigator() {
  const { user, checking } = useAuth();
  if (checking) return <View style={styles.loading}><View style={styles.mark} /><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  return <NavigationContainer theme={theme}><Stack.Navigator screenOptions={options} key={user?.role || 'guest'}>
    {!user ? <Stack.Screen name="Login" component={LoginScreen} /> : user.role === 'RESIDENT' ? <>
      <Stack.Screen name="ResidentHome" component={ResidentHomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} /><Stack.Screen name="Apartment" component={ApartmentScreen} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} /><Stack.Screen name="VehicleForm" component={VehicleFormScreen} />
      <Stack.Screen name="Registrations" component={RegistrationsScreen} /><Stack.Screen name="RegistrationForm" component={RegistrationFormScreen} />
      <Stack.Screen name="Tickets" component={TicketsScreen} /><Stack.Screen name="TicketQR" component={TicketQRScreen} /><Stack.Screen name="LostQR" component={LostQRScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} /><Stack.Screen name="History" component={HistoryScreen} /><Stack.Screen name="Notifications" component={NotificationsScreen} />
    </> : <>
      <Stack.Screen name="GuardHome" component={GuardHomeScreen} /><Stack.Screen name="GuardResult" component={GuardResultScreen} />
      <Stack.Screen name="GuardMenu" component={GuardMenuScreen} /><Stack.Screen name="GuardHistory" component={GuardHistoryScreen} />
      <Stack.Screen name="GuardViolations" component={GuardViolationsScreen} /><Stack.Screen name="GuardViolationForm" component={GuardViolationFormScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </>}
  </Stack.Navigator></NavigationContainer>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: COLORS.graphite }, mark: { width: 44, height: 44, borderRadius: 7, backgroundColor: COLORS.primary } });
