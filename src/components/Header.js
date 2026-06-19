import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './UI';

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
  activitylog: '📝 Activity Log',
  staff:       '👥 Staff',
  products:    '🍰 Produk',
  outlets:     '🏪 Outlet',
};

export default function Header({ tab, setTab }) {
  const { user, logout } = useAuth();
  const tabs = TABS_BY_ROLE[user?.role] || [];

  return (
    <div style={{ background:'linear-gradient(135deg, #1C1208 0%, #140F06 100%)', color:'#fff', padding:'0 24px' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ borderRight:'1px solid rgba(180,154,53,.3)', paddingRight:14 }}>
              <div style={{ fontFamily:"'Cinzel', serif", fontWeight:600, fontSize:19, letterSpacing:'0.2em', color:'#B49A35', lineHeight:1 }}>LAPISLAPIS</div>
              <div style={{ fontSize:8, color:'rgba(180,154,53,.55)', letterSpacing:'0.25em', marginTop:4, fontWeight:600 }}>PRODUCTION & SALES SYSTEM</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{user?.name}</div>
              <div style={{ marginTop:2 }}><RoleBadge role={user?.role} /></div>
            </div>
            <button onClick={logout} style={{ padding:'6px 14px', background:'rgba(255,255,255,.1)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              Logout
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', gap:2, marginTop:12, overflowX:'auto', paddingBottom:0 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'9px 14px', background: tab===t ? '#B49A35' : 'transparent',
              color: tab===t ? '#1C1208' : '#94a3b8', border:'none', borderRadius:'8px 8px 0 0',
              cursor:'pointer', fontWeight: tab===t ? 700 : 500, fontSize:11, whiteSpace:'nowrap', transition:'all .15s'
            }}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
