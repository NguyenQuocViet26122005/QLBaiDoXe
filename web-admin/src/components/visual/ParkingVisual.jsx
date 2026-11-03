import { Component, Suspense, lazy, useCallback, useMemo, useState, useSyncExternalStore } from 'react';

// three.js chỉ được tải khi cần (tách chunk riêng) để không làm chậm lần tải đầu.
const ParkingScene3D = lazy(() => import('./ParkingScene3D'));

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Hiển thị cảnh 3D; nếu thiết bị không hỗ trợ WebGL thì giữ nguyên ảnh tĩnh cũ. */
export default function ParkingVisual({ image, alt = '', className = '', minWidth = 0, ...sceneProps }) {
  const media = useMemo(() => minWidth ? window.matchMedia(`(min-width: ${minWidth}px)`) : null, [minWidth]);
  const subscribe = useCallback((listener) => {
    media?.addEventListener('change', listener);
    return () => media?.removeEventListener('change', listener);
  }, [media]);
  const getSnapshot = useCallback(() => media?.matches ?? true, [media]);
  const canShowScene = useSyncExternalStore(subscribe, getSnapshot);
  const [fallback, setFallback] = useState(false);
  const onFallback = useCallback(() => setFallback(true), []);
  const still = <img className={`${className} parking-visual-still`} src={image} alt={alt} />;
  if (fallback || !canShowScene) return still;
  return (
    <SceneBoundary fallback={still}>
      <Suspense fallback={still}>
        <div className={`${className} parking-visual`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
          <ParkingScene3D {...sceneProps} onFallback={onFallback} />
        </div>
      </Suspense>
    </SceneBoundary>
  );
}
