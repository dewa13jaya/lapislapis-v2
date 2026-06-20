import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fmtDate, today, useIsMobile } from '../utils';

const fmtRp = n => 'Rp ' + Number(n||0).toLocaleString('id-ID');
const thisMonthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);

// ── Small helper components ──────────────────────────────────────────────────
const TH = ({ children, right }) => (
  <th style={{ padding:'10px 12px', textAlign: right?'right':'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0', whiteSpace:'nowrap' }}>{children}</th>
);
const TD = ({ children, right, bold, color, small }) => (
  <td style={{ padding:'10px 12px', textAlign: right?'right':'left', fontWeight: bold?700:400, color: color||'inherit', fontSize: small?12:13 }}>{children}</td>
);
const Badge = ({ children, bg, color }) => (
  <span style={{ background: bg, color, padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>{children}</span>
);
const Card = ({ children, style }) => (
  <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16, ...style }}>{children}</div>
);
const StatCard = ({ label, val, color }) => (
  <div style={{ background:'#fff', borderRadius:12, padding:'14px 18px', boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
    <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, marginBottom:4 }}>{label}</div>
    <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
  </div>
);

// ── Role → visible tabs ──────────────────────────────────────────────────────
const SALES_TABS = [
  { id:'outlet', label:'🏪 Order per Outlet' },
  { id:'produk', label:'🍰 Order per Produk' },
  { id:'kirim',  label:'🚚 Detail Pengiriman' },
];
const STOK_TABS = [
  { id:'stok', label:'📦 Stok & Pergerakan' },
];
const RETUR_TABS = [
  { id:'retur', label:'↩️ Analisis Retur' },
];
const PRODUKSI_TABS = [
  { id:'produksi', label:'⚖️ Produksi vs Penjualan' },
];
const ROLE_TABS = {
  admin:           [...SALES_TABS, ...STOK_TABS, ...RETUR_TABS, ...PRODUKSI_TABS],
  kepala_sales:    [...SALES_TABS, ...RETUR_TABS],
  sales:           SALES_TABS,
  kepala_produksi: [...STOK_TABS, ...RETUR_TABS, ...PRODUKSI_TABS],
  produksi:        [],
};

const STATUS_BG   = { delivered:'#d1fae5', partial_delivered:'#fff7ed', confirmed:'#dbeafe', packed:'#FBF5DF', pending:'#f1f5f9', cancelled:'#fee2e2' };
const STATUS_TEXT = { delivered:'#065f46', partial_delivered:'#9a3412', confirmed:'#1e40af', packed:'#6B5418', pending:'#475569', cancelled:'#991b1b' };
const KAT_LIST    = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];

export default function Reports({ products, outlets, orders, stockIn, stockOut, returns, currentStock }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const role = user?.role || 'sales';
  const tabs = ROLE_TABS[role] || SALES_TABS;

  // For 'sales' role: restrict to assigned outlets
  const userOutletIds = user?.outlet_ids || [];
  const visibleOutlets = role === 'sales' && userOutletIds.length > 0
    ? outlets.filter(o => userOutletIds.includes(o.id))
    : outlets;

  // Only kepala_produksi and admin can fill stok opname
  const canFillOpname = ['admin', 'kepala_produksi'].includes(role);

  const [tab,         setTab]         = useState(tabs[0]?.id || '');
  const [dateFrom,    setDateFrom]    = useState(thisMonthStart());
  const [dateTo,      setDateTo]      = useState(today());
  const [showRevenue, setShowRevenue] = useState(false);
  const [filterOutlet, setFilterOutlet] = useState('');
  const [filterKat,    setFilterKat]    = useState('');
  const [filterProduk, setFilterProduk] = useState('');
  const [stokSubTab,  setStokSubTab]  = useState('saldo');
  const [opname,      setOpname]      = useState({});
  const [expandedOutlet, setExpandedOutlet] = useState(null);
  const [filterUkuran, setFilterUkuran] = useState('');

  const SIZE_OPTIONS = ['Slice','Quarter','Half','Round','Square','Loyang'];
  const matchUkuran = (product) => {
    if (!filterUkuran) return true;
    const name = product.name || '';
    if (filterUkuran === 'Loyang') {
      return !SIZE_OPTIONS.slice(0,5).some(s => name.endsWith('- ' + s)) && !name.includes(' - ');
    }
    return name.endsWith('- ' + filterUkuran);
  };

  const inRange = d => {
    const dt = (d||'').slice(0,10);
    return (!dateFrom || dt >= dateFrom) && (!dateTo || dt <= dateTo);
  };

  const resetFilters = () => { setFilterOutlet(''); setFilterKat(''); setFilterProduk(''); setFilterUkuran(''); };

  // ── Shared: orders in date range (non-cancelled) ─────────────────────────
  const rangeOrders = orders.filter(o =>
    !['cancelled'].includes(o.status) && inRange(o.delivery_date)
  );

  // ── TAB 1: Order per Outlet ───────────────────────────────────────────────
  const outletReport = visibleOutlets
    .filter(o => !filterOutlet || o.id === filterOutlet)
    .map(outlet => {
      const outletOrders = rangeOrders.filter(o => o.outlet_id === outlet.id);
      const allItems = outletOrders.flatMap(o => (o.order_items||[]).map(i => ({ ...i, order: o })));
      const filteredItems = allItems.filter(i => {
        const p = products.find(p => p.id === i.product_id);
        if (filterKat && p?.kategori !== filterKat) return false;
        if (filterProduk && i.product_id !== filterProduk) return false;
        return true;
      });
      if (filteredItems.length === 0 && !filterOutlet) return null;

      const totalQty   = filteredItems.reduce((s,i) => s + Number(i.qty), 0);
      const totalNilai = filteredItems.reduce((s,i) => {
        const p = products.find(p => p.id === i.product_id);
        return s + Number(i.qty) * Number(p?.price||0);
      }, 0);

      const byProduct = {};
      filteredItems.forEach(i => {
        if (!byProduct[i.product_id]) {
          const p = products.find(p => p.id === i.product_id);
          byProduct[i.product_id] = { name: p?.name||'-', unit: p?.unit||'-', price: Number(p?.price||0), qty: 0 };
        }
        byProduct[i.product_id].qty += Number(i.qty);
      });

      return { outlet, totalOrders: outletOrders.length, totalQty, totalNilai, byProduct: Object.values(byProduct).sort((a,b) => b.qty - a.qty) };
    })
    .filter(Boolean);

  // ── TAB 2: Order per Produk ───────────────────────────────────────────────
  const visibleOutletIds = visibleOutlets.map(o => o.id);
  const produkReport = (() => {
    const byProduct = {};
    rangeOrders
      .filter(o => role !== 'sales' || visibleOutletIds.includes(o.outlet_id))
      .flatMap(o => (o.order_items||[]).map(i => ({ ...i, outlet_id: o.outlet_id }))).forEach(i => {
      const p = products.find(p => p.id === i.product_id);
      if (!p) return;
      if (filterKat && p.kategori !== filterKat) return;
      if (filterProduk && i.product_id !== filterProduk) return;
      if (!matchUkuran(p)) return;
      if (!byProduct[i.product_id]) byProduct[i.product_id] = { product: p, qty: 0, nilai: 0, outlets: {} };
      byProduct[i.product_id].qty += Number(i.qty);
      byProduct[i.product_id].nilai += Number(i.qty) * Number(p.price||0);
      const outletName = outlets.find(o => o.id === i.outlet_id)?.name || '-';
      byProduct[i.product_id].outlets[outletName] = (byProduct[i.product_id].outlets[outletName]||0) + Number(i.qty);
    });
    return Object.values(byProduct).sort((a,b) => b.qty - a.qty);
  })();

  // ── TAB 3: Detail Pengiriman ──────────────────────────────────────────────
  const kirimReport = rangeOrders
    .filter(o => role !== 'sales' || visibleOutletIds.includes(o.outlet_id))
    .filter(o => !filterOutlet || o.outlet_id === filterOutlet)
    .map(o => {
      const outlet = outlets.find(x => x.id === o.outlet_id);
      const items  = o.order_items || [];
      const totalQtyOrder  = items.reduce((s,i) => s + Number(i.qty), 0);
      const totalQtyKirim  = items.reduce((s,i) => s + Number(i.qty_delivered ?? i.qty), 0);
      const totalQtyReject = items.reduce((s,i) => s + Number(i.qty_rejected||0), 0);
      const nilaiOrder = items.reduce((s,i) => s + Number(i.qty) * Number(products.find(p=>p.id===i.product_id)?.price||0), 0);
      const tglOrder         = o.created_at?.slice(0,10) || '';
      const tglRencana       = o.delivery_date || '';
      const tglAktual        = o.actual_delivery_date || '';
      const telatHari        = tglAktual && tglRencana ? Math.round((new Date(tglAktual) - new Date(tglRencana)) / 86400000) : null;
      const isRescheduled    = o.original_delivery_date && o.original_delivery_date !== o.delivery_date;
      return { order: o, outlet, totalQtyOrder, totalQtyKirim, totalQtyReject, nilaiOrder, tglOrder, tglRencana, tglAktual, telatHari, isRescheduled };
    })
    .sort((a,b) => b.tglRencana.localeCompare(a.tglRencana));

  // ── TAB 4: Stok ───────────────────────────────────────────────────────────
  const stokData = products
    .filter(p => !filterKat || p.kategori === filterKat)
    .filter(p => matchUkuran(p))
    .map(p => {
      const masuk  = stockIn.filter(x => x.product_id === p.id && inRange(x.date)).reduce((s,x) => s+Number(x.qty), 0);
      const keluar = stockOut.filter(x => x.product_id === p.id && inRange(x.date)).reduce((s,x) => s+Number(x.qty), 0);
      const retur  = returns.filter(x => x.product_id === p.id && inRange(x.date) && !['expired_rusak','konversi'].includes(x.return_type)).reduce((s,x) => s+Number(x.qty), 0);
      return { product: p, masuk, keluar, retur, saldo: currentStock[p.id] || 0 };
    });

  // ── TAB RETUR: Analisis Retur ─────────────────────────────────────────────
  const returInRange = returns.filter(r => inRange(r.date));

  const returByProduct = (() => {
    const map = {};
    returInRange.forEach(r => {
      const p = products.find(x => x.id === r.product_id);
      if (!p) return;
      if (!map[r.product_id]) map[r.product_id] = { name: p.name, unit: p.unit, qty: 0, count: 0 };
      map[r.product_id].qty += Number(r.qty || 0);
      map[r.product_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  })();

  const returByReason = (() => {
    const map = {};
    returInRange.forEach(r => {
      const key = r.reason || r.return_reason || 'Tidak diketahui';
      map[key] = (map[key] || 0) + Number(r.qty || 0);
    });
    return Object.entries(map).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
  })();

  const returByOutlet = (() => {
    const map = {};
    returInRange.forEach(r => {
      const outletName = outlets.find(o => o.id === r.outlet_id)?.name || 'Tidak diketahui';
      if (!map[outletName]) map[outletName] = { qty: 0, count: 0 };
      map[outletName].qty += Number(r.qty || 0);
      map[outletName].count += 1;
    });
    return Object.entries(map).map(([label, d]) => ({ label, ...d })).sort((a, b) => b.qty - a.qty);
  })();

  const returByKondisi = (() => {
    const labels = { kondisi_ok:'✅ Kondisi OK', expired_rusak:'🗑️ Expired/Rusak', konversi:'✂️ Konversi' };
    const map = {};
    returInRange.forEach(r => {
      const key = labels[r.return_type] || r.return_type || 'Lainnya';
      map[key] = (map[key] || 0) + Number(r.qty || 0);
    });
    return Object.entries(map).map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
  })();

  const totalReturQty = returInRange.reduce((s, r) => s + Number(r.qty || 0), 0);

  // ── TAB PRODUKSI VS PENJUALAN ─────────────────────────────────────────────
  const produksiReport = (() => {
    const produksiOrders = orders.filter(o =>
      ['delivered','partial_delivered'].includes(o.status) && inRange(o.delivery_date)
    );
    return products
      .filter(p => !filterKat || p.kategori === filterKat)
      .map(p => {
        const diproduksi = stockIn
          .filter(x => x.product_id === p.id && inRange(x.date))
          .reduce((s, x) => s + Number(x.qty || 0), 0);
        const terjual = produksiOrders
          .flatMap(o => o.order_items || [])
          .filter(i => i.product_id === p.id)
          .reduce((s, i) => s + Number(i.qty_delivered ?? i.qty ?? 0), 0);
        const diretur = returInRange
          .filter(r => r.product_id === p.id && r.return_type === 'expired_rusak')
          .reduce((s, r) => s + Number(r.qty || 0), 0);
        const efisiensi = diproduksi > 0 ? Math.round((terjual / diproduksi) * 100) : null;
        return { product: p, diproduksi, terjual, diretur, efisiensi };
      })
      .filter(r => r.diproduksi > 0 || r.terjual > 0)
      .sort((a, b) => b.diproduksi - a.diproduksi);
  })();

  const totalDiproduksi = produksiReport.reduce((s, r) => s + r.diproduksi, 0);
  const totalTerjual    = produksiReport.reduce((s, r) => s + r.terjual, 0);
  const globalEfisiensi = totalDiproduksi > 0 ? Math.round((totalTerjual / totalDiproduksi) * 100) : 0;

  // ── Export Excel ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const period = `${dateFrom} s/d ${dateTo}`;

    if (tab === 'outlet') {
      const rows = [['Outlet','Jumlah Order','Total Qty', ...(showRevenue ? ['Total Nilai'] : [])]];
      outletReport.forEach(r => rows.push([r.outlet.name, r.totalOrders, r.totalQty, ...(showRevenue ? [r.totalNilai] : [])]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['LAPORAN ORDER PER OUTLET'],['Periode:', period],[''], ...rows]), 'Order per Outlet');
    }
    if (tab === 'produk') {
      const rows = [['Produk','Kategori','Total Qty', ...(showRevenue ? ['Total Nilai'] : [])]];
      produkReport.forEach(r => rows.push([r.product.name, r.product.kategori||'-', r.qty, ...(showRevenue ? [r.nilai] : [])]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['LAPORAN ORDER PER PRODUK'],['Periode:', period],[''], ...rows]), 'Order per Produk');
    }
    if (tab === 'kirim') {
      const rows = [['No Order','Outlet','Tgl Order','Tgl Kirim Rencana','Tgl Kirim Aktual','Status','Qty Order','Qty Kirim','Qty Reject','Ketepatan', ...(showRevenue ? ['Nilai'] : [])]];
      kirimReport.forEach(r => {
        const tepat = r.telatHari === null ? '-' : r.telatHari <= 0 ? 'Tepat Waktu' : `Telat ${r.telatHari} hari`;
        rows.push([r.order.order_no, r.outlet?.name||'-', r.tglOrder, r.tglRencana, r.tglAktual||'-', r.order.status, r.totalQtyOrder, r.totalQtyKirim, r.totalQtyReject, tepat, ...(showRevenue ? [r.nilaiOrder] : [])]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['LAPORAN DETAIL PENGIRIMAN'],['Periode:', period],[''], ...rows]), 'Detail Pengiriman');
    }
    if (tab === 'stok') {
      if (stokSubTab === 'opname') {
        const rows = [['Produk','Kategori','Satuan','Stok Sistem','Stok Fisik','Selisih','Status']];
        stokData.forEach(r => {
          const fisik = opname[r.product.id] !== undefined ? Number(opname[r.product.id]) : null;
          const selisih = fisik !== null ? fisik - r.saldo : '-';
          const status = fisik === null ? 'Belum diisi' : fisik === r.saldo ? 'Sesuai' : fisik < r.saldo ? `Kurang ${r.saldo - fisik}` : `Lebih ${fisik - r.saldo}`;
          rows.push([r.product.name, r.product.kategori||'-', r.product.unit, r.saldo, fisik ?? '-', selisih, status]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['LAPORAN STOK OPNAME'],['Tanggal:', today()],[''], ...rows]), 'Stok Opname');
      } else {
        const rows = [['Produk','Kategori','Satuan','Stok Masuk','Retur Masuk','Keluar Defect','Saldo']];
        stokData.forEach(r => rows.push([r.product.name, r.product.kategori||'-', r.product.unit, r.masuk, r.retur, r.keluar, r.saldo]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['LAPORAN STOK & PERGERAKAN'],['Periode:', period],[''], ...rows]), 'Stok');
      }
    }
    XLSX.writeFile(wb, `LapisLapis_${tab}_${dateFrom}_${dateTo}.xlsx`);
  };

  // ── Export PDF (print) ────────────────────────────────────────────────────
  const exportPDF = () => window.print();

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (tabs.length === 0) {
    return (
      <div style={{ background:'#fff', borderRadius:12, padding:48, textAlign:'center', color:'#94a3b8', boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
        <div style={{ fontSize:15, fontWeight:700, color:'#64748b' }}>Tidak ada akses laporan</div>
        <div style={{ fontSize:13, marginTop:4 }}>Role Anda tidak memiliki akses ke halaman laporan.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ margin:0, fontWeight:800, color:'#1C1208' }}>Laporan</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportExcel} style={{ padding: isMobile ? '7px 12px' : '8px 16px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize: isMobile ? 12 : 13, fontWeight:700 }}>⬇ Excel</button>
          <button onClick={exportPDF}   style={{ padding: isMobile ? '7px 12px' : '8px 16px', background:'#ef4444', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize: isMobile ? 12 : 13, fontWeight:700 }}>🖨 Print</button>
        </div>
      </div>

      {/* Tab selector */}
      <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); resetFilters(); }}
            style={{ padding: isMobile ? '8px 12px' : '10px 18px', fontSize: isMobile ? 12 : 13, fontWeight:700, background: tab===t.id ? '#1C1208' : '#fff', color: tab===t.id ? '#fff' : '#64748b', border: `2px solid ${tab===t.id ? '#1C1208' : '#e2e8f0'}`, borderRadius:10, cursor:'pointer', whiteSpace:'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ background:'#fff', borderRadius:12, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>

          {/* Date range */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DARI</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13 }} />
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>SAMPAI</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13 }} />
          </div>

          {/* Outlet filter */}
          {(tab === 'outlet' || tab === 'kirim') && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>OUTLET</div>
              <select value={filterOutlet} onChange={e => setFilterOutlet(e.target.value)}
                style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, background:'#fff', minWidth:170 }}>
                <option value=''>Semua Outlet</option>
                {visibleOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          {/* Kategori filter */}
          {(tab === 'outlet' || tab === 'produk' || tab === 'stok') && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>KATEGORI</div>
              <select value={filterKat} onChange={e => { setFilterKat(e.target.value); setFilterProduk(''); }}
                style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, background:'#fff' }}>
                <option value=''>Semua Kategori</option>
                {KAT_LIST.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          )}

          {/* Produk filter */}
          {tab === 'produk' && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>PRODUK</div>
              <select value={filterProduk} onChange={e => setFilterProduk(e.target.value)}
                style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, background:'#fff', minWidth:200 }}>
                <option value=''>Semua Produk</option>
                {products.filter(p => !filterKat || p.kategori === filterKat).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Ukuran filter — tab 2 (produk) and tab 4 (stok) */}
          {(tab === 'produk' || tab === 'stok') && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>UKURAN</div>
              <select value={filterUkuran} onChange={e => setFilterUkuran(e.target.value)}
                style={{ padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, background:'#fff' }}>
                <option value=''>Semua Ukuran</option>
                {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Revenue toggle */}
          {tab !== 'stok' && (
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'#374151', cursor:'pointer', marginLeft:'auto', padding:'8px 14px', background: showRevenue ? '#FBF5DF' : '#f1f5f9', borderRadius:8 }}>
              <input type="checkbox" checked={showRevenue} onChange={e => setShowRevenue(e.target.checked)} />
              Tampilkan Nilai (Rp)
            </label>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — ORDER PER OUTLET                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'outlet' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
            <StatCard label="Total Outlet"     val={outletReport.length}                                              color="#3b82f6" />
            <StatCard label="Total Order"      val={outletReport.reduce((s,r) => s+r.totalOrders, 0)}                 color="#10b981" />
            <StatCard label="Total Qty"        val={outletReport.reduce((s,r) => s+r.totalQty, 0)}                    color="#B49A35" />
            {showRevenue && <StatCard label="Total Nilai" val={fmtRp(outletReport.reduce((s,r) => s+r.totalNilai, 0))} color="#8b5cf6" />}
          </div>

          <Card>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                <TH>Outlet</TH>
                <TH right>Jml Order</TH>
                <TH right>Total Qty</TH>
                {showRevenue && <TH right>Total Nilai</TH>}
                <TH>Produk Terbanyak</TH>
                <TH></TH>
              </tr></thead>
              <tbody>
                {outletReport.length === 0
                  ? <tr><td colSpan={showRevenue?6:5} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Tidak ada data untuk periode ini</td></tr>
                  : outletReport.map(r => (
                  <React.Fragment key={r.outlet.id}>
                    <tr style={{ borderBottom:'1px solid #f1f5f9', cursor:'pointer', background: expandedOutlet===r.outlet.id ? '#f8fafc' : '#fff' }}
                        onClick={() => setExpandedOutlet(expandedOutlet===r.outlet.id ? null : r.outlet.id)}>
                      <TD>
                        <div style={{ fontWeight:700 }}>{r.outlet.name}</div>
                        {r.outlet.address && <div style={{ fontSize:11, color:'#94a3b8' }}>{r.outlet.address}</div>}
                      </TD>
                      <TD right bold color="#3b82f6">{r.totalOrders}</TD>
                      <TD right bold color="#B49A35">{r.totalQty}</TD>
                      {showRevenue && <TD right bold color="#8b5cf6">{fmtRp(r.totalNilai)}</TD>}
                      <TD><span style={{ fontSize:12, color:'#64748b' }}>{r.byProduct[0]?.name||'-'} ({r.byProduct[0]?.qty||0})</span></TD>
                      <td style={{ padding:'10px 12px', color:'#cbd5e1', fontSize:12 }}>{expandedOutlet===r.outlet.id ? '▲' : '▼'}</td>
                    </tr>
                    {expandedOutlet === r.outlet.id && r.byProduct.map(p => (
                      <tr key={p.name} style={{ background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'8px 12px 8px 28px', fontSize:12, color:'#64748b' }}>↳ {p.name}</td>
                        <td colSpan={showRevenue?2:1} />
                        <TD right small bold>{p.qty} <span style={{ fontWeight:400, color:'#94a3b8' }}>{p.unit}</span></TD>
                        {showRevenue && <TD right small color="#8b5cf6">{fmtRp(p.qty * p.price)}</TD>}
                        <td colSpan={2} />
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — ORDER PER PRODUK                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'produk' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
            <StatCard label="Total Produk"  val={produkReport.length}                                       color="#3b82f6" />
            <StatCard label="Total Qty"     val={produkReport.reduce((s,r) => s+r.qty, 0)}                  color="#B49A35" />
            {showRevenue && <StatCard label="Total Nilai" val={fmtRp(produkReport.reduce((s,r) => s+r.nilai, 0))} color="#8b5cf6" />}
          </div>

          <Card>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                <TH>#</TH>
                <TH>Produk</TH>
                <TH>Kategori</TH>
                <TH right>Total Qty</TH>
                {showRevenue && <TH right>Total Nilai</TH>}
                <TH>Dipesan oleh Outlet</TH>
              </tr></thead>
              <tbody>
                {produkReport.length === 0
                  ? <tr><td colSpan={showRevenue?6:5} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Tidak ada data</td></tr>
                  : produkReport.map((r, idx) => {
                    const rowBg = idx === 0 ? '#fffbeb' : idx === 1 ? '#f0fdf4' : idx === 2 ? '#eff6ff' : '#fff';
                    return (
                      <tr key={r.product.id} style={{ borderBottom:'1px solid #f1f5f9', background: rowBg }}>
                        <TD color="#94a3b8">{idx+1}</TD>
                        <TD bold>{r.product.name}</TD>
                        <TD small color="#64748b">{r.product.kategori||'-'}</TD>
                        <TD right bold color="#B49A35">{r.qty} <span style={{ fontWeight:400, color:'#94a3b8', fontSize:11 }}>{r.product.unit}</span></TD>
                        {showRevenue && <TD right bold color="#8b5cf6">{fmtRp(r.nilai)}</TD>}
                        <td style={{ padding:'10px 12px', fontSize:11, color:'#64748b' }}>
                          {Object.entries(r.outlets).sort((a,b) => b[1]-a[1]).slice(0,3).map(([name,qty]) => `${name} (${qty})`).join(' · ')}
                          {Object.keys(r.outlets).length > 3 && <span style={{ color:'#94a3b8' }}> +{Object.keys(r.outlets).length-3} lainnya</span>}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — DETAIL PENGIRIMAN                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'kirim' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
            <StatCard label="Total Pengiriman"  val={kirimReport.length}                                                        color="#3b82f6" />
            <StatCard label="Tepat Waktu"        val={kirimReport.filter(r => r.telatHari !== null && r.telatHari <= 0).length}  color="#10b981" />
            <StatCard label="Terlambat"          val={kirimReport.filter(r => r.telatHari !== null && r.telatHari > 0).length}   color="#ef4444" />
            <StatCard label="Dijadwal Ulang"     val={kirimReport.filter(r => r.isRescheduled).length}                           color="#B49A35" />
          </div>

          <Card>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:800 }}>
                <thead><tr style={{ background:'#f8f7f4' }}>
                  <TH>No Order</TH>
                  <TH>Outlet</TH>
                  <TH>Tgl Order</TH>
                  <TH>Rencana Kirim</TH>
                  <TH>Aktual Kirim</TH>
                  <TH>Status</TH>
                  <TH right>Qty Order</TH>
                  <TH right>Qty Kirim</TH>
                  <TH right>Reject</TH>
                  {showRevenue && <TH right>Nilai</TH>}
                  <TH>Ketepatan</TH>
                </tr></thead>
                <tbody>
                  {kirimReport.length === 0
                    ? <tr><td colSpan={showRevenue?11:10} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Tidak ada data</td></tr>
                    : kirimReport.map(r => {
                      const tepatColor  = r.telatHari === null ? '#94a3b8' : r.telatHari <= 0 ? '#10b981' : '#ef4444';
                      const tepatLabel  = r.telatHari === null ? '—' : r.telatHari <= 0 ? '✓ Tepat' : `+${r.telatHari}h`;
                      return (
                        <tr key={r.order.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <TD>
                            <div style={{ fontWeight:700 }}>{r.order.order_no}</div>
                            {r.isRescheduled && <div style={{ marginTop:2 }}><Badge bg="#FBF5DF" color="#6B5418">🔄 Reschedule</Badge></div>}
                          </TD>
                          <TD>{r.outlet?.name||'-'}</TD>
                          <TD small color="#64748b">{r.tglOrder ? fmtDate(r.tglOrder) : '-'}</TD>
                          <TD small>{r.tglRencana ? fmtDate(r.tglRencana) : '-'}</TD>
                          <TD small>{r.tglAktual ? fmtDate(r.tglAktual) : <span style={{ color:'#cbd5e1' }}>—</span>}</TD>
                          <td style={{ padding:'10px 12px' }}>
                            <Badge bg={STATUS_BG[r.order.status]||'#f1f5f9'} color={STATUS_TEXT[r.order.status]||'#475569'}>{r.order.status}</Badge>
                          </td>
                          <TD right bold>{r.totalQtyOrder}</TD>
                          <TD right bold color="#10b981">{r.totalQtyKirim}</TD>
                          <TD right bold color={r.totalQtyReject > 0 ? '#ef4444' : '#94a3b8'}>{r.totalQtyReject || '—'}</TD>
                          {showRevenue && <TD right color="#8b5cf6">{fmtRp(r.nilaiOrder)}</TD>}
                          <td style={{ padding:'10px 12px', fontWeight:700, color: tepatColor, fontSize:12 }}>{tepatLabel}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4 — STOK & PERGERAKAN                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'stok' && (
        <>
          {/* Sub-tabs */}
          <div style={{ display:'flex', gap:6, marginBottom:16 }}>
            {[
              { id:'saldo',   label:'📊 Saldo Saat Ini' },
              { id:'gerakan', label:'📈 Pergerakan Periode' },
              { id:'opname',  label:'📋 Stok Opname', kepalaOnly: true },
            ].filter(t => !t.kepalaOnly || canFillOpname).map(t => (
              <button key={t.id} onClick={() => setStokSubTab(t.id)}
                style={{ padding:'8px 16px', fontSize:12, fontWeight:700, background: stokSubTab===t.id ? '#1C1208' : '#f1f5f9', color: stokSubTab===t.id ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Sub-tab: Saldo */}
          {stokSubTab === 'saldo' && (
            <Card>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8f7f4' }}>
                  <TH>Produk</TH><TH>Kategori</TH><TH>Satuan</TH><TH right>Saldo</TH><TH right>Min Stok</TH><TH>Status</TH>
                </tr></thead>
                <tbody>
                  {stokData.map(r => {
                    const min  = r.product.stok_minimum || 5;
                    const isLow  = r.saldo > 0 && r.saldo <= min;
                    const isEmpty = r.saldo <= 0;
                    return (
                      <tr key={r.product.id} style={{ borderBottom:'1px solid #f1f5f9', background: isEmpty ? '#fff5f5' : isLow ? '#fffbeb' : '' }}>
                        <TD bold>{r.product.name}</TD>
                        <TD small color="#64748b">{r.product.kategori||'-'}</TD>
                        <TD small color="#94a3b8">{r.product.unit}</TD>
                        <TD right bold color={isEmpty ? '#ef4444' : isLow ? '#B49A35' : '#1C1208'}>{r.saldo}</TD>
                        <TD right small color="#94a3b8">{min}</TD>
                        <td style={{ padding:'10px 12px' }}>
                          {isEmpty ? <Badge bg="#fee2e2" color="#dc2626">🔴 Habis</Badge>
                          : isLow  ? <Badge bg="#FBF5DF" color="#6B5418">⚠️ Rendah</Badge>
                          :          <Badge bg="#d1fae5" color="#065f46">✓ Aman</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* Sub-tab: Pergerakan */}
          {stokSubTab === 'gerakan' && (
            <Card>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8f7f4' }}>
                  <TH>Produk</TH><TH>Kategori</TH><TH>Satuan</TH>
                  <TH right>Masuk</TH><TH right>Retur Masuk</TH><TH right>Keluar Defect</TH><TH right>Saldo</TH>
                </tr></thead>
                <tbody>
                  {(() => {
                    const active = stokData.filter(r => r.masuk > 0 || r.keluar > 0 || r.retur > 0);
                    return active.length === 0
                      ? <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Tidak ada pergerakan stok di periode ini</td></tr>
                      : active.map(r => (
                        <tr key={r.product.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <TD bold>{r.product.name}</TD>
                          <TD small color="#64748b">{r.product.kategori||'-'}</TD>
                          <TD small color="#94a3b8">{r.product.unit}</TD>
                          <TD right bold color="#10b981">{r.masuk > 0 ? `+${r.masuk}` : '—'}</TD>
                          <TD right bold color="#B49A35">{r.retur > 0 ? `+${r.retur}` : '—'}</TD>
                          <TD right bold color="#ef4444">{r.keluar > 0 ? `-${r.keluar}` : '—'}</TD>
                          <TD right bold color="#1C1208">{r.saldo}</TD>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </Card>
          )}

          {/* Sub-tab: Stok Opname */}
          {stokSubTab === 'opname' && (
            <Card>
              <div style={{ marginBottom:14, padding:'10px 14px', background:'#FBF5DF', borderRadius:8, fontSize:13, color:'#6B5418', fontWeight:600 }}>
                📋 Masukkan jumlah stok fisik yang sudah dihitung. Sistem otomatis menghitung selisih vs stok sistem.
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8f7f4' }}>
                  <TH>Produk</TH><TH>Satuan</TH><TH right>Stok Sistem</TH><TH right>Stok Fisik</TH><TH right>Selisih</TH><TH>Keterangan</TH>
                </tr></thead>
                <tbody>
                  {stokData.map(r => {
                    const fisik   = opname[r.product.id] !== undefined ? Number(opname[r.product.id]) : null;
                    const selisih = fisik !== null ? fisik - r.saldo : null;
                    return (
                      <tr key={r.product.id} style={{ borderBottom:'1px solid #f1f5f9', background: selisih !== null && selisih !== 0 ? (selisih < 0 ? '#fff5f5' : '#f0fdf4') : '' }}>
                        <TD bold>{r.product.name}</TD>
                        <TD small color="#94a3b8">{r.product.unit}</TD>
                        <TD right bold>{r.saldo}</TD>
                        <td style={{ padding:'8px 12px', textAlign:'right' }}>
                          <input type="number" min="0"
                            value={opname[r.product.id] ?? ''}
                            onChange={e => setOpname(prev => ({ ...prev, [r.product.id]: e.target.value }))}
                            style={{ width:80, padding:'6px 8px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, textAlign:'right' }}
                            placeholder="—" />
                        </td>
                        <TD right bold color={selisih === null ? '#cbd5e1' : selisih === 0 ? '#10b981' : selisih < 0 ? '#ef4444' : '#B49A35'}>
                          {selisih === null ? '—' : selisih > 0 ? `+${selisih}` : selisih}
                        </TD>
                        <td style={{ padding:'10px 12px' }}>
                          {selisih === null   ? <span style={{ color:'#cbd5e1', fontSize:12 }}>belum diisi</span>
                          : selisih === 0     ? <Badge bg="#d1fae5" color="#065f46">✓ Sesuai</Badge>
                          : selisih < 0       ? <Badge bg="#fee2e2" color="#dc2626">⬇ Kurang {Math.abs(selisih)}</Badge>
                          :                     <Badge bg="#FBF5DF" color="#6B5418">⬆ Lebih {selisih}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB RETUR — ANALISIS RETUR                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'retur' && (
        <>
          {/* Stat cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
            <StatCard label="Total Retur (Qty)"   val={totalReturQty}          color="#B49A35" />
            <StatCard label="Transaksi Retur"      val={returInRange.length}    color="#3b82f6" />
            <StatCard label="Produk Berbeda"       val={returByProduct.length}  color="#8b5cf6" />
            <StatCard label="Outlet Retur"         val={returByOutlet.length}   color="#ef4444" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12, marginBottom:12 }}>
            {/* Top produk diretur */}
            <Card style={{ marginBottom:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#1C1208', marginBottom:12 }}>🏆 Produk Paling Sering Diretur</div>
              {returByProduct.length === 0
                ? <div style={{ color:'#94a3b8', textAlign:'center', padding:24 }}>Tidak ada retur di periode ini</div>
                : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#f8f7f4' }}>
                    <TH>#</TH><TH>Produk</TH><TH right>Qty Retur</TH><TH right>Frekuensi</TH>
                  </tr></thead>
                  <tbody>
                    {returByProduct.map((r, i) => (
                      <tr key={r.name} style={{ borderBottom:'1px solid #f1f5f9', background: i === 0 ? '#fff8f0' : '#fff' }}>
                        <TD color="#94a3b8">{i+1}</TD>
                        <TD bold>{r.name}</TD>
                        <TD right bold color="#ef4444">{r.qty} <span style={{ fontWeight:400, color:'#94a3b8', fontSize:11 }}>{r.unit}</span></TD>
                        <TD right color="#64748b">{r.count}x</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </Card>

            {/* Top outlet retur */}
            <Card style={{ marginBottom:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#1C1208', marginBottom:12 }}>🏪 Outlet dengan Retur Terbanyak</div>
              {returByOutlet.length === 0
                ? <div style={{ color:'#94a3b8', textAlign:'center', padding:24 }}>Tidak ada data</div>
                : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#f8f7f4' }}>
                    <TH>Outlet</TH><TH right>Qty</TH><TH right>Frekuensi</TH>
                  </tr></thead>
                  <tbody>
                    {returByOutlet.map((r, i) => (
                      <tr key={r.label} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <TD bold>{r.label}</TD>
                        <TD right bold color="#ef4444">{r.qty}</TD>
                        <TD right color="#64748b">{r.count}x</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </Card>
          </div>

          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12 }}>
            {/* Alasan retur */}
            <Card style={{ marginBottom:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#1C1208', marginBottom:12 }}>📋 Alasan Retur Terbanyak</div>
              {returByReason.length === 0
                ? <div style={{ color:'#94a3b8', textAlign:'center', padding:24 }}>Tidak ada data</div>
                : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#f8f7f4' }}>
                    <TH>Alasan</TH><TH right>Qty</TH><TH right>%</TH>
                  </tr></thead>
                  <tbody>
                    {returByReason.map(r => (
                      <tr key={r.label} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <TD>{r.label}</TD>
                        <TD right bold color="#B49A35">{r.v}</TD>
                        <TD right color="#64748b">{totalReturQty > 0 ? Math.round(r.v/totalReturQty*100) : 0}%</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </Card>

            {/* Kondisi barang retur */}
            <Card style={{ marginBottom:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#1C1208', marginBottom:12 }}>🔍 Kondisi Barang Retur</div>
              {returByKondisi.length === 0
                ? <div style={{ color:'#94a3b8', textAlign:'center', padding:24 }}>Tidak ada data</div>
                : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#f8f7f4' }}>
                    <TH>Kondisi</TH><TH right>Qty</TH><TH right>%</TH>
                  </tr></thead>
                  <tbody>
                    {returByKondisi.map(r => (
                      <tr key={r.label} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <TD bold>{r.label}</TD>
                        <TD right bold color="#3b82f6">{r.v}</TD>
                        <TD right color="#64748b">{totalReturQty > 0 ? Math.round(r.v/totalReturQty*100) : 0}%</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </Card>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB PRODUKSI VS PENJUALAN                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'produksi' && (
        <>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:16 }}>
            <StatCard label="Total Diproduksi"  val={totalDiproduksi}        color="#3b82f6" />
            <StatCard label="Total Terjual"      val={totalTerjual}           color="#10b981" />
            <StatCard label="Efisiensi Global"   val={`${globalEfisiensi}%`}  color={globalEfisiensi >= 80 ? '#10b981' : globalEfisiensi >= 50 ? '#B49A35' : '#ef4444'} />
            <StatCard label="Sisa / Tidak Terjual" val={totalDiproduksi - totalTerjual} color="#B49A35" />
          </div>

          {/* Info bar efisiensi */}
          <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, background: globalEfisiensi >= 80 ? '#d1fae5' : globalEfisiensi >= 50 ? '#FBF5DF' : '#fee2e2', border: `1px solid ${globalEfisiensi >= 80 ? '#6ee7b7' : globalEfisiensi >= 50 ? '#D4B340' : '#fca5a5'}` }}>
            <span style={{ fontWeight:700, fontSize:13, color: globalEfisiensi >= 80 ? '#065f46' : globalEfisiensi >= 50 ? '#6B5418' : '#991b1b' }}>
              {globalEfisiensi >= 80 ? '✅ Efisiensi Baik' : globalEfisiensi >= 50 ? '⚠️ Efisiensi Sedang' : '🔴 Efisiensi Rendah'}
              {' '}— {globalEfisiensi}% produksi berhasil terjual di periode ini.
            </span>
          </div>

          {/* Filter kategori */}
          <div style={{ marginBottom:12 }}>
            <select value={filterKat} onChange={e => setFilterKat(e.target.value)}
              style={{ padding:'8px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, background:'#fff' }}>
              <option value=''>Semua Kategori</option>
              {KAT_LIST.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <Card>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:600 }}>
                <thead><tr style={{ background:'#f8f7f4' }}>
                  <TH>Produk</TH>
                  <TH>Kategori</TH>
                  <TH right>Diproduksi</TH>
                  <TH right>Terjual</TH>
                  <TH right>Retur Rusak</TH>
                  <TH right>Sisa</TH>
                  <TH right>Efisiensi</TH>
                </tr></thead>
                <tbody>
                  {produksiReport.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Tidak ada data produksi di periode ini</td></tr>
                    : produksiReport.map(r => {
                      const sisa = r.diproduksi - r.terjual;
                      const ef = r.efisiensi;
                      const efColor = ef === null ? '#94a3b8' : ef >= 80 ? '#10b981' : ef >= 50 ? '#B49A35' : '#ef4444';
                      return (
                        <tr key={r.product.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <TD bold>{r.product.name}</TD>
                          <TD small color="#64748b">{r.product.kategori||'-'}</TD>
                          <TD right bold color="#3b82f6">{r.diproduksi}</TD>
                          <TD right bold color="#10b981">{r.terjual}</TD>
                          <TD right bold color={r.diretur > 0 ? '#ef4444' : '#94a3b8'}>{r.diretur > 0 ? r.diretur : '—'}</TD>
                          <TD right bold color={sisa > 0 ? '#B49A35' : '#94a3b8'}>{sisa > 0 ? sisa : '—'}</TD>
                          <td style={{ padding:'10px 12px', textAlign:'right' }}>
                            {ef === null
                              ? <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>
                              : <span style={{ fontWeight:800, fontSize:13, color: efColor }}>{ef}%</span>
                            }
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
