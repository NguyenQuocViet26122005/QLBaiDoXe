import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
export function useAsync(loader, deps = [], focus = false) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (quiet = false) => { try { if (!quiet) setLoading(true); setError(''); setData(await loader()); } catch (e) { setError(e.message); } finally { setLoading(false); setRefreshing(false); } }, deps);
  useEffect(() => { if (!focus) load(); }, [load, focus]);
  useFocusEffect(useCallback(() => { if (focus) load(); }, [focus, load]));
  return { data, loading, error, reload: () => load(), refreshing, refresh: () => { setRefreshing(true); load(true); }, setData };
}
