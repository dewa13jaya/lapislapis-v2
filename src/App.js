import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './supabase';
import { Toast } from './components/UI';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import StockManager from './pages/StockManager';
import OrderManager from './pages/OrderManager';
import SuratJalan from './pages/SuratJalan';
import Reports from './pages/Reports';
import { StaffManager, ActivityLog, ProductManager, OutletManager } from './pages/OtherPages';

function MainApp() {
  const { user } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const [products, setProducts]       = useState([]);
  const [outlets, setOutlets]         = useState([]);
  const [stockIn, setStockIn]         = useState([]);
  const [stockOut, setStockOut]       = useState([]);
  const [returns, setReturns]         = useState([]);
  const [orders, setOrders]           = useState([]);
  const [staff, setStaff]             = useState([]);
  const [activityLog, setActivityLog] = useState([]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, o, si, so, r, ord, st, al] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('outlets').select('*').order('name'),
      supabase.from('stock_in').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_out').select('*').order('created_at', { ascending: false }),
      supabase.from('returns').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
      supabase.from('users_profile').select('*').order('name'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (p.data)   setProducts(p.data);
    if (o.data)   setOutlets(o.data);
    if (si.data)  setStockIn(si.data);
    if (so.data)  setStockOut(so.data);
    if (r.data)   setReturns(r.data);
    if (ord.data) setOrders(ord.data);
    if (st.data)  setStaff(st.data);
    if (al.data)  setActivityLog(al.data);
    setLoading(false);
  }, []);

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const tables = ['products','outlets','stock_in','stock_out','returns','orders','order_items','users_profile','activity_log'];
    const channels = tables.map(table =>
      supabase.channel(`rt-${table}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchAll()).subscribe()
    );
    return () => channels.forEach(c => supabase.removeChannel(c));
  }, [user, fetchAll]);

  // Computed stock
  const currentStock = products.reduce((acc, p) => {
    const totalIn    = stockIn.filter(x => x.product_id === p.id).reduce((s,x) => s+Number(x.qty), 0);
    const totalOut   = stockOut.filter(x => x.product_id === p.id).reduce((s,x) => s+Number(x.qty), 0);
    const totalRetur = returns.filter(x => x.product_id === p.id && !['expired_rusak','konversi'].includes(x.return_type)).reduce((s,x) => s+Number(x.qty), 0);
    const orderOut   = orders.filter(o => ['delivered','partial_delivered'].includes(o.status))
      .flatMap(o => o.order_items||[]).filter(i => i.product_id === p.id)
      .reduce((s,i) => s+Number(i.qty_delivered??i.qty), 0);
    acc[p.id] = totalIn + totalRetur - totalOut - orderOut;
    return acc;
  }, {});

  if (!user) return <LoginPage />;

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#1C1208', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48 }}>🍰</div>
      <div style={{ color:'#fff', fontFamily:'Inter, sans-serif', fontSize:18, fontWeight:700, letterSpacing:2 }}>LAPISLAPIS</div>
      <div style={{ color:'#94a3b8', fontFamily:'Inter, sans-serif', fontSize:13 }}>Memuat data...</div>
    </div>
  );

  const pageProps = { products, outlets, stockIn, stockOut, returns, orders, staff, activityLog, currentStock, onRefresh: fetchAll, showToast };

  return (
    <div style={{ minHeight:'100vh', background:'#f8f7f4', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Toast msg={toast} />
      <Header tab={tab} setTab={setTab} />
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'24px' }}>
        {tab === 'dashboard'   && <Dashboard {...pageProps} />}
        {tab === 'stok'        && <StockManager {...pageProps} />}
        {tab === 'orders'      && <OrderManager {...pageProps} />}
        {tab === 'suratjalan'  && <SuratJalan {...pageProps} />}
        {tab === 'laporan'     && <Reports {...pageProps} />}
        {tab === 'activitylog' && <ActivityLog {...pageProps} />}
        {tab === 'staff'       && <StaffManager {...pageProps} />}
        {tab === 'products'    && <ProductManager {...pageProps} />}
        {tab === 'outlets'     && <OutletManager {...pageProps} />}
      </div>
    </div>
  );
}

export default function App() {
  return <AuthProvider><MainApp /></AuthProvider>;
}
