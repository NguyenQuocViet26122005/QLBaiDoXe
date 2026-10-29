import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import CommandPalette from '../components/layout/CommandPalette';
import RouteProgress from '../components/layout/RouteProgress';

export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <RouteProgress />
      <CommandPalette />
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="app-main">
        <Header onMenu={() => setOpen(true)} />
        <main id="main-content" className="page-content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
