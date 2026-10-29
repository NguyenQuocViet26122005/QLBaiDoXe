import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';

/** Thanh tiến trình mảnh ở đỉnh trang mỗi khi chuyển route (chỉ hiệu ứng). */
export default function RouteProgress() {
  const { pathname } = useLocation();
  const bar = useRef(null);
  useLayoutEffect(() => {
    if (!bar.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const tl = gsap.timeline();
    tl.set(bar.current, { scaleX: 0, opacity: 1 })
      .to(bar.current, { scaleX: 0.7, duration: 0.35, ease: 'power2.out' })
      .to(bar.current, { scaleX: 1, duration: 0.25, ease: 'power1.in' })
      .to(bar.current, { opacity: 0, duration: 0.3 }, '+=0.05');
    return () => tl.kill();
  }, [pathname]);
  return <div className="route-progress" ref={bar} aria-hidden="true" />;
}
