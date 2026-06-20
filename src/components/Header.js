import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './UI';
import { useIsMobile } from '../utils';

const TABS_BY_ROLE = {
  admin:           ['dashboard','stok','orders','suratjalan','laporan','activitylog','staff','products','outlets'],
  kepala_produksi: ['dashboard','stok','orders','suratjalan','laporan','products','outlets'],
  produksi:        ['dashboard','stok','orders','suratjalan','products','outlets'],
  kepala_sales:    ['dashboard','orders','suratjalan','laporan','outlets'],
  sales:           ['dashboard','orders','stok','outlets'],
};

const TAB_LABELS = {
  dashboard:   '📊 Dashboard',
  stok:        '📦 Stok',
  orders:      '🛒 Order',
  suratjalan:  '🚚 Surat Jalan',
  laporan:     '📈 Laporan',
  activitylog: '📝 Log',
  staff:       '👥 Staff',
  products:    '🍰 Produk',
  outlets:     '🏪 Outlet',
};

export default function Header({ tab, setTab }) {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = TABS_BY_ROLE[user?.role] || [];

  const handleTab = (t) => { setTab(t); setMenuOpen(false); };

  return (
    <div style={{ background:'linear-gradient(135deg, #1C1208 0%, #140F06 100%)', color:'#fff' }}>
      <div style={{ maxWidth:1280, margin:'0 auto', padding: isMobile ? '0 12px' : '0 24px' }}>

        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: isMobile ? '10px 0' : '14px 0 0' }}>
          {/* Logo */}
          <div style={{ borderRight:'1px solid rgba(180,154,53,.3)', paddingRight:14 }}>
            <div style={{ fontFamily:"'Cinzel', serif", fontWeight:600, fontSize: isMobile ? 15 : 19, letterSpacing:'0.2em', color:'#B49A35', lineHeight:1 }}>LAPISLAPIS</div>
            {!isMobile && <div style={{ fontSize:8, color:'rgba(180,154,53,.55)', letterSpacing:'0.25em', marginTop:4, fontWeight:600 }}>PRODUCTION & SALES SYSTEM</div>}
          </div>

          {/* Right side */}
          <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 8 : 12 }}>
            {!isMobile && (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{user?.name}</div>
                <div style={{ marginTop:2 }}><RoleBadge role={user?.role} /></div>
              </div>
            )}
            {isMobile && (
              <div style={{ fontSize:12, fontWeight:600, color:'#B49A35' }}>{user?.name?.split(' ')[0]}</div>
            )}
            <button onClick={logout} style={{ padding: isMobile ? '5px 10px' : '6px 14px', background:'rgba(255,255,255,.1)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, cursor:'pointer', fontSize: isMobile ? 11 : 12, fontWeight:600 }}>
              Logout
            </button>
            {/* Hamburger — mobile only */}
            {isMobile && (
              <button onClick={() => setMenuOpen(m => !m)} style={{ padding:'6px 8px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, cursor:'pointer', color:'#fff', fontSize:16, lineHeight:1 }}>
                {menuOpen ? '✕' : '☰'}
              </button>
            )}
          </div>
        </div>

        {/* Desktop tabs — horizontal scrollable */}
        {!isMobile && (
          <div style={{ display:'flex', gap:2, marginTop:12, overflowX:'auto', paddingBottom:0 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:'9px 14px', background: tab===t ? '#B49A35' : 'transparent',
                color: tab===t ? '#1C1208' : '#94a3b8', border:'none', borderRadius:'8px 8px 0 0',
                cursor:'pointer', fontWeight: tab===t ? 700 : 500, fontSize:11, whiteSpace:'nowrap', transition:'all .15s'
              }}>{TAB_LABELS[t]}</button>
            ))}
          </div>
        )}

        {/* Mobile tabs — current tab label + dropdown */}
        {isMobile && (
          <>
            {/* Current tab indicator */}
            <div style={{ padding:'8px 0 0', fontSize:12, color:'#94a3b8' }}>
              <span style={{ color:'#B49A35', fontWeight:700 }}>{TAB_LABELS[tab]}</span>
            </div>
            {/* Dropdown menu */}
            {menuOpen && (
              <div style={{ position:'absolute', top:'auto', left:0, right:0, background:'#1C1208', zIndex:999, borderTop:'1px solid rgba(180,154,53,.2)', boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
                {tabs.map(t => (
                  <button key={t} onClick={() => handleTab(t)} style={{
                    display:'block', width:'100%', padding:'14px 20px', textAlign:'left',
                    background: tab===t ? 'rgba(180,154,53,.15)' : 'transparent',
                    color: tab===t ? '#B49A35' : '#e2e8f0', border:'none', borderBottom:'1px solid rgba(255,255,255,.05)',
                    cursor:'pointer', fontSize:14, fontWeight: tab===t ? 700 : 400
                  }}>{TAB_LABELS[t]}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
