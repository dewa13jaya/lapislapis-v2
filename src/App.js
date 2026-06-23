import { useState, useEffect, useCallback, useMemo } from 'react';
import { useIsMobile } from './utils';
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
  const isMobile = useIsMobile();
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

  // ── Per-table fetch functions ──────────────────────────────────────────────
  // Tiap fungsi hanya fetch tabelnya sendiri → realtime bisa trigger granular.
  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  }, []);

  const fetchOutlets = useCallback(async () => {
    const { data } = await supabase.from('outlets').select('*').order('name');
    if (data) setOutlets(data);
  }, []);

  const fetchStockIn = useCallback(async () => {
    const { data } = await supabase.from('stock_in').select('*').order('created_at', { ascending: false });
    if (data) setStockIn(data);
  }, []);

  const fetchStockOut = useCallback(async () => {
    const { data } = await supabase.from('stock_out').select('*').order('created_at', { ascending: false });
    if (data) setStockOut(data);
  }, []);

  const fetchReturns = useCallback(async () => {
    const { data } = await supabase.from('returns').select('*').order('created_at', { ascending: false });
    if (data) setReturns(data);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (data) setOrders(data);
  }, []);

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase.from('users_profile').select('*').order('name');
    if (data) setStaff(data);
  }, []);

  const fetchActivityLog = useCallback(async () => {
    const { data } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setActivityLog(data);
  }, []);

  // fetchAll: initial load & manual full-refresh
  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchProducts(), fetchOutlets(), fetchStockIn(), fetchStockOut(),
      fetchReturns(), fetchOrders(), fetchStaff(), fetchActivityLog(),
    ]);
    setLoading(false);
  }, [fetchProducts, fetchOutlets, fetchStockIn, fetchStockOut, fetchReturns, fetchOrders, fetchStaff, fetchActivityLog]);

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

  // ── Granular realtime ──────────────────────────────────────────────────────
  // Sebelumnya: semua event → fetchAll() (8 tabel sekaligus, tiap ada perubahan apapun).
  // Sekarang: tiap tabel hanya fetch dirinya sendiri.
  // order_items → fetchOrders (karena join).
  useEffect(() => {
    if (!user) return;
    const tableHandlers = {
      products:      fetchProducts,
      outlets:       fetchOutlets,
      stock_in:      fetchStockIn,
      stock_out:     fetchStockOut,
      returns:       fetchReturns,
      orders:        fetchOrders,
      order_items:   fetchOrders,   // join → fetch orders
      users_profile: fetchStaff,
      activity_log:  fetchActivityLog,
    };
    const channels = Object.entries(tableHandlers).map(([table, handler]) =>
      supabase.channel(`rt-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, handler)
        .subscribe()
    );
    return () => channels.forEach(c => supabase.removeChannel(c));
  }, [user, fetchProducts, fetchOutlets, fetchStockIn, fetchStockOut, fetchReturns, fetchOrders, fetchStaff, fetchActivityLog]);

  // ── currentStock — O(n+m) single-pass Map ─────────────────────────────────
  // Sebelumnya: O(n×m) — untuk tiap produk, .filter() ulang seluruh array stok.
  // Sekarang: satu kali pass per array → Map lookup O(1).
  const currentStock = useMemo(() => {
    const inMap     = {};
    const outMap    = {};
    const returMap  = {};
    const orderMap  = {};

    stockIn.forEach(x => {
      inMap[x.product_id] = (inMap[x.product_id] || 0) + Number(x.qty);
    });
    stockOut.forEach(x => {
      outMap[x.product_id] = (outMap[x.product_id] || 0) + Number(x.qty);
    });
    returns.forEach(x => {
      if (!['expired_rusak', 'konversi', 'rusak_pengiriman'].includes(x.return_type))
        returMap[x.product_id] = (returMap[x.product_id] || 0) + Number(x.qty);
    });
    orders
      .filter(o => ['delivered', 'partial_delivered'].includes(o.status))
      .flatMap(o => o.order_items || [])
      .forEach(i => {
        orderMap[i.product_id] = (orderMap[i.product_id] || 0) + Number(i.qty_delivered ?? i.qty);
      });

    return products.reduce((acc, p) => {
      acc[p.id] = (inMap[p.id] || 0) + (returMap[p.id] || 0) - (outMap[p.id] || 0) - (orderMap[p.id] || 0);
      return acc;
    }, {});
  }, [products, stockIn, stockOut, returns, orders]);

  if (!user) return <LoginPage />;

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#1C1208', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48 }}>🍰</div>
      <div style={{ color:'#fff', fontFamily:'Inter, sans-serif', fontSize:18, fontWeight:700, letterSpacing:2 }}>LAPISLAPIS</div>
      <div style={{ color:'#94a3b8', fontFamily:'Inter, sans-serif', fontSize:13 }}>Memuat data...</div>
    </div>
  );

  const pageProps = {
    products, outlets, stockIn, stockOut, returns, orders, staff, activityLog, currentStock,
    onRefresh: fetchAll,
    // Targeted refresh — post-mutation panggil ini bukan onRefresh()
    // Hanya re-fetch tabel yang berubah, bukan semua 8 tabel.
    refreshProducts:  fetchProducts,
    refreshOutlets:   fetchOutlets,
    refreshStockIn:   fetchStockIn,
    refreshStockOut:  fetchStockOut,
    refreshReturns:   fetchReturns,
    refreshOrders:    fetchOrders,
    refreshStaff:     fetchStaff,
    showToast,
  };

  return (
    <div style={{ minHeight:'100vh', background:'#f8f7f4', fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <Toast msg={toast} />
      <Header tab={tab} setTab={setTab} />
      <div style={{ maxWidth:1280, margin:'0 auto', padding: isMobile ? '12px' : '24px' }}>
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
