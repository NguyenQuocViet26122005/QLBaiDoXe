import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const webStorage = {
  getItemAsync: async (key) => globalThis.localStorage?.getItem(key) ?? null,
  setItemAsync: async (key, value) => globalThis.localStorage?.setItem(key, value),
  deleteItemAsync: async (key) => globalThis.localStorage?.removeItem(key)
};

export const storage = Platform.OS === 'web' ? webStorage : SecureStore;
