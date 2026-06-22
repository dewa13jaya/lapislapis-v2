import { useState } from 'react';
import { fmtDate } from '../utils';
import { StatusBadge } from '../components/UI';
import { printSJ, sjLabel } from '../printSJ';

export default function SuratJalan({ orders, products, outlets, staff, showToast }) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const readyOrders = orders
    .filter(o => ['confirmed','packed','delivered','partial_delivered'].includes(o.status))
    .filter(o => {
      if (!search) return true;
      const s = search.toLowerCase();
      const outlet = outlets.find(x => x.id === o.outlet_id);
      return o.order_no?.toLowerCase().includes(s) || outlet?.name?.toLowerCase().includes(s);
    })
    .filter(o => {
      if (dateFrom && o.delivery_date < dateFrom) return false;
      if (dateTo && o.delivery_date > dateTo) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.delivery_date.localeCompare(a.delivery_date) || b.order_no.localeCompare(a.order_no);
      if (sortBy === 'oldest') return a.delivery_date.localeCompare(b.delivery_date) || a.order_no.localeCompare(b.order_no);
      return 0;
    });

  return (
    <div>
      <h2 style={{ margin:'0 0 8px', fontWeight:800, color:'#1C1208' }}>Surat Jalan</h2>
      <p style={{ margin:'0 0 12px', fontSize:13, color:'#64748b' }}>Order yang sudah dikonfirmasi atau dipacking siap cetak. Order yang sudah terkirim juga bisa dicetak ulang.</p>

      {/* Search + Date + Sort */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cari no. order / outlet..."
          style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, minWidth:200, flex:1 }}
        />
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>Tgl kirim:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding:'7px 8px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13 }} />
          <span style={{ fontSize:12, color:'#64748b' }}>–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding:'7px 8px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13 }} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, background:'#fff' }}>
          <option value="newest">⬇ Terbaru</option>
          <option value="oldest">⬆ Terlama</option>
        </select>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} style={{ padding:'7px 12px', borderRadius:8, border:'none', background:'#fee2e2', color:'#ef4444', fontSize:12, cursor:'pointer', fontWeight:600 }}>✕ Reset</button>
        )}
      </div>

      {readyOrders.length === 0
        ? <div style={{ background:'#fff', borderRadius:12, padding:48, textAlign:'center', color:'#94a3b8' }}>
            <div style={{ fontSize:48 }}>📋</div>
            <div style={{ fontSize:14, marginTop:8 }}>Belum ada order yang siap cetak</div>
            <div style={{ fontSize:12, marginTop:4 }}>Konfirmasi order di menu Order terlebih dahulu</div>
          </div>
        : readyOrders.map(order => {
          const outlet = outlets.find(o => o.id === order.outlet_id);
          const totalKirim    = (order.order_items||[]).reduce((s,i) => s + Number(i.qty), 0);
          const totalRejected = (order.order_items||[]).reduce((s,i) => s + Number(i.qty_rejected||0), 0);
          return (
            <div key={order.id} style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <span style={{ fontWeight:800, fontSize:15 }}>{order.order_no}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div style={{ fontSize:13, color:'#374151' }}>🏪 {outlet?.name||'-'}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                    📅 {fmtDate(order.delivery_date)} · 
                    🚗 {order.driver_name||'-'} {order.vehicle_no && `(${order.vehicle_no})`} · 
                    Kirim: {totalKirim} unit
                    {totalRejected > 0 && <span style={{ color:'#ef4444', marginLeft:4 }}>· Reject: {totalRejected} unit</span>}
                  </div>
                </div>
                {['packed','delivered','partial_delivered'].includes(order.status)
                  ? <button onClick={() => printSJ(order, products, outlets, staff||[])} style={{ padding:'10px 18px', background: ['delivered','partial_delivered'].includes(order.status) ? '#10b981' : '#1C1208', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                      {sjLabel(order)}
                    </button>
                  : <div style={{ padding:'10px 18px', background:'#e2e8f0', color:'#94a3b8', borderRadius:8, fontSize:12, fontWeight:600 }}>
                      🔒 Menunggu status Packed
                    </div>
                }
              </div>
            </div>
          );
        })}
    </div>
  );
}
