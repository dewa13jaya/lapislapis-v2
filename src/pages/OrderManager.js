import { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, today, fmtDate, S, REJECT_REASONS, STATUS_CFG } from '../utils';
import { StatusBadge, Btn, FieldGroup } from '../components/UI';
import ProductionDetail from './ProductionDetail';
import { printSJ, sjLabel } from '../printSJ';

const logActivity = async (user, action, description) => {
  await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action, description });
};

export default function OrderManager({ products, outlets, orders, currentStock, onRefresh, showToast }) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [form, setForm] = useState({ outlet_id:'', delivery_date: today(), notes:'', items:[] });
  const [newItem, setNewItem] = useState({ kat:'', variant:'', product_id:'', qty:'' });
  const [rejectData, setRejectData] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [productionOrder, setProductionOrder] = useState(null);

  // Two-step product selector helpers
  const KAT_LIST = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
  const getVariant = name => { const m = name.match(/^(.+?)\s*-\s*(Slice|Quarter|Half|Round|Square)$/i); return m ? m[1].trim() : name; };
  const variantsFor = kat => [...new Set(products.filter(p => !kat || p.kategori === kat).map(p => getVariant(p.name)))].sort();
  const sizesFor = variant => products.filter(p => getVariant(p.name) === variant);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const canCreate  = ['admin','sales','kepala_sales'].includes(user?.role);
  const canStatus  = ['admin','produksi','kepala_produksi'].includes(user?.role);

  const addItem = () => {
    if (!newItem.product_id || !newItem.qty) return;
    const existing = form.items.findIndex(i => i.product_id === newItem.product_id);
    if (existing >= 0) {
      const items = [...form.items]; items[existing].qty = Number(items[existing].qty) + Number(newItem.qty);
      setForm(f => ({...f, items}));
    } else {
      setForm(f => ({...f, items:[...f.items, { product_id: newItem.product_id, qty: Number(newItem.qty) }]}));
    }
    setNewItem({ product_id:'', qty:'' });
  };

  const submitOrder = async () => {
    if (!form.outlet_id) return showToast('❌ Pilih outlet tujuan');
    if (form.items.length === 0) return showToast('❌ Tambahkan minimal 1 produk');
    setSaving(true);
    const orderNo  = 'ORD-' + new Date().getFullYear() + '-' + String(orders.length+1).padStart(4,'0');
    const orderId  = uid();
    const { error: oErr } = await supabase.from('orders').insert({ id: orderId, order_no: orderNo, outlet_id: form.outlet_id, delivery_date: form.delivery_date, notes: form.notes, original_delivery_date: form.delivery_date, status:'pending', created_by: user.id, created_by_name: user.name });
    if (oErr) { setSaving(false); return showToast('❌ ' + oErr.message); }
    await supabase.from('order_items').insert(form.items.map((item,idx) => ({ id: uid(), order_id: orderId, product_id: item.product_id, qty: item.qty, qty_delivered: item.qty, qty_rejected: 0, no: idx+1 })));
    await logActivity(user, 'order_buat', `Order ${orderNo} dibuat untuk ${outlets.find(o=>o.id===form.outlet_id)?.name}`);
    setSaving(false);
    showToast('✅ Order ' + orderNo + ' berhasil dibuat!');
    setForm({ outlet_id:'', delivery_date: today(), notes:'', items:[] });
    setNewItem({ kat:'', variant:'', product_id:'', qty:'' });
    setShowForm(false);
    onRefresh();
  };

  const updateStatus = async (order, status) => {
    const todayDate = today();
    if (status === 'packed') {
      const driver = window.prompt('Nama driver/kurir:');
      if (!driver) return;
      const vehicle = window.prompt('Nomor kendaraan:');
      // Catat actual_delivery_date saat packing
      await supabase.from('orders').update({ status, driver_name: driver, vehicle_no: vehicle||'', actual_delivery_date: todayDate }).eq('id', order.id);
      if (order.delivery_date !== todayDate) {
        await logActivity(user, 'order_status', `Order ${order.order_no} → Packing. Tanggal kirim aktual: ${todayDate} (rencana: ${order.delivery_date})`);
      } else {
        await logActivity(user, 'order_status', `Order ${order.order_no} → Packing. Driver: ${driver}`);
      }
    } else {
      await supabase.from('orders').update({ status }).eq('id', order.id);
      await logActivity(user, 'order_status', `Order ${order.order_no} → ${STATUS_CFG[status]?.label}`);
    }
    showToast('✅ Status diupdate');
    onRefresh();
  };

  const rescheduleOrder = async (order) => {
    const newDate = window.prompt(`Ubah tanggal kirim untuk ${order.order_no}\nTanggal saat ini: ${order.delivery_date}\nMasukkan tanggal baru (YYYY-MM-DD):`, order.delivery_date);
    if (!newDate || newDate === order.delivery_date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return showToast('❌ Format tanggal salah. Gunakan YYYY-MM-DD');
    const oldDate = order.delivery_date;
    const note    = window.prompt('Alasan perubahan jadwal (opsional):') || '';
    await supabase.from('orders').update({
      delivery_date: newDate,
      original_delivery_date: order.original_delivery_date || oldDate,
      reschedule_notes: note
    }).eq('id', order.id);
    await logActivity(user, 'order_reschedule', `Order ${order.order_no} — jadwal kirim diubah: ${oldDate} → ${newDate}${note ? '. Alasan: ' + note : ''}`);
    showToast(`✅ Jadwal diubah ke ${newDate}`);
    onRefresh();
  };

  const submitReject = async (order) => {
    const items = order.order_items || [];
    let hasReject = false;
    let allRejected = true;
    setSaving(true);
    for (const item of items) {
      const rd = rejectData[item.id] || {};
      const rejQty = Number(rd.qty || 0);
      if (rejQty > 0) {
        hasReject = true;
        await supabase.from('order_items').update({ qty_rejected: rejQty, qty_delivered: item.qty - rejQty, reject_reason: rd.reason||'' }).eq('id', item.id);
        // Return stock
        await supabase.from('returns').insert({ id: uid(), product_id: item.product_id, qty: rejQty, date: today(), outlet_id: order.outlet_id, order_id: order.id, reason: rd.reason||'Reject pengiriman', return_type: 'reject_pengiriman', created_by: user.id, created_by_name: user.name });
        const p = products.find(x => x.id === item.product_id);
        await logActivity(user, 'reject', `Reject ${rejQty} ${p?.unit||''} ${p?.name||''} dari order ${order.order_no} — ${rd.reason||''}`);
      }
      if (item.qty - Number(rd.qty||0) > 0) allRejected = false;
    }
    const newStatus = !hasReject ? 'delivered' : allRejected ? 'rejected' : 'partial_delivered';
    await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    setSaving(false);
    setShowRejectForm(null);
    setRejectData({});
    showToast('✅ Konfirmasi penerimaan tersimpan');
    onRefresh();
  };

  const filteredOrders = orders
    .filter(o => filter === 'all' || o.status === filter)
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

  // Show ProductionDetail full page
  if (productionOrder) {
    return (
      <ProductionDetail
        order={productionOrder}
        products={products}
        outlets={outlets}
        currentStock={currentStock}
        onBack={() => setProductionOrder(null)}
        onRefresh={onRefresh}
        showToast={showToast}
      />
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ margin:0, fontWeight:800, color:'#1C1208' }}>Order Sales</h2>
        {canCreate && <Btn onClick={() => setShowForm(!showForm)} color="#1C1208">{showForm ? '✕ Tutup' : '+ Buat Order Baru'}</Btn>}
      </div>

      {/* New Order Form */}
      {showForm && canCreate && (
        <div style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700 }}>🛒 Form Order Baru</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
            <FieldGroup label="Outlet Tujuan">
              <select value={form.outlet_id} onChange={e => setForm(f => ({...f, outlet_id: e.target.value}))} style={S.input}>
                <option value=''>-- Pilih --</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Tanggal Kirim">
              <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({...f, delivery_date: e.target.value}))} style={S.input} />
            </FieldGroup>
            <FieldGroup label="Catatan">
              <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} style={S.input} placeholder="Opsional..." />
            </FieldGroup>
          </div>

          {/* Add items — two-step selector */}
          <div style={{ background:'#f8f7f4', borderRadius:8, padding:12, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Tambah Produk</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto auto', gap:8, alignItems:'flex-end' }}>
              {/* Step 1: Kategori */}
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>Kategori</div>
                <select value={newItem.kat} onChange={e => setNewItem(i => ({...i, kat: e.target.value, variant:'', product_id:''}))} style={S.input}>
                  <option value=''>-- Semua --</option>
                  {KAT_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              {/* Step 2: Varian */}
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>Varian / Produk</div>
                <select value={newItem.variant} onChange={e => {
                  const v = e.target.value;
                  const sizes = sizesFor(v);
                  setNewItem(i => ({...i, variant: v, product_id: sizes.length === 1 ? sizes[0].id : ''}));
                }} style={S.input}>
                  <option value=''>-- Pilih Varian --</option>
                  {variantsFor(newItem.kat).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {/* Step 3: Ukuran (jika ada) */}
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>Ukuran</div>
                {newItem.variant && sizesFor(newItem.variant).length > 1
                  ? <select value={newItem.product_id} onChange={e => setNewItem(i => ({...i, product_id: e.target.value}))} style={S.input}>
                      <option value=''>-- Pilih Ukuran --</option>
                      {sizesFor(newItem.variant).map(p => {
                        const size = p.name.includes(' - ') ? p.name.split(' - ').pop() : p.name;
                        return <option key={p.id} value={p.id}>{size} (Stok: {currentStock[p.id]||0})</option>;
                      })}
                    </select>
                  : <div style={{ ...S.input, background:'#f1f5f9', color:'#94a3b8', fontSize:12 }}>
                      {newItem.product_id ? `Stok: ${currentStock[newItem.product_id]||0}` : '-'}
                    </div>
                }
              </div>
              {/* Qty */}
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>Qty</div>
                <input type="number" min="1" value={newItem.qty} onChange={e => setNewItem(i => ({...i, qty: e.target.value}))} style={{ ...S.input, width:70 }} placeholder="0" />
              </div>
              <Btn onClick={addItem} color="#3b82f6">+ Tambah</Btn>
            </div>
          </div>

          {form.items.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:16 }}>
              <thead><tr style={{ background:'#f1f5f9' }}>
                <th style={S.th}>No</th><th style={S.th}>Produk</th><th style={{...S.th, textAlign:'right'}}>Qty</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {form.items.map((item,idx) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={S.td}>{idx+1}</td>
                      <td style={S.td}>{p?.name}</td>
                      <td style={{...S.td, textAlign:'right', fontWeight:700}}>{item.qty} {p?.unit}</td>
                      <td style={S.td}><button onClick={() => setForm(f => ({...f, items: f.items.filter((_,i) => i!==idx)}))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer' }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <Btn onClick={submitOrder} disabled={saving} color="#10b981">{saving ? 'Menyimpan...' : '✅ Kirim Order ke Produksi'}</Btn>
        </div>
      )}

      {/* Search + Date + Sort */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
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

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {['all','pending','confirmed','packed','delivered','partial_delivered','rejected','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding:'6px 12px', fontSize:11, fontWeight:600, border:'none', borderRadius:20, cursor:'pointer', background: filter===s ? '#1C1208' : '#e2e8f0', color: filter===s ? '#fff' : '#64748b' }}>
            {s === 'all' ? 'Semua' : STATUS_CFG[s]?.label||s}
          </button>
        ))}
      </div>

      {/* Order Detail Modal (read-only, all roles) */}
      {detailOrder && (() => {
        const o = detailOrder;
        const outlet = outlets.find(x => x.id === o.outlet_id);
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={() => setDetailOrder(null)}>
            <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:560, width:'90%', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}><span style={{ fontWeight:800, fontSize:18 }}>{o.order_no}</span><StatusBadge status={o.status} /></div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>🏪 {outlet?.name||'-'} · 📅 {fmtDate(o.delivery_date)} · Oleh: {o.created_by_name||'-'}</div>
                  {o.original_delivery_date && o.original_delivery_date !== o.delivery_date && (
                    <div style={{ fontSize:11, color:'#B49A35', marginTop:2 }}>🔄 Dijadwal ulang dari {fmtDate(o.original_delivery_date)}{o.reschedule_notes ? ` — ${o.reschedule_notes}` : ''}</div>
                  )}
                  {o.actual_delivery_date && <div style={{ fontSize:11, color:'#8b5cf6', marginTop:2 }}>📦 Aktual kirim: {fmtDate(o.actual_delivery_date)}</div>}
                  {o.driver_name && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>🚗 {o.driver_name} {o.vehicle_no && `· ${o.vehicle_no}`}</div>}
                  {o.notes && <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>📝 {o.notes}</div>}
                </div>
                <button onClick={() => setDetailOrder(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>✕</button>
              </div>
              {/* Print SJ button — only for orders that have been confirmed or beyond */}
              {['confirmed','packed','delivered','partial_delivered','rejected'].includes(o.status) && (
                <div style={{ marginBottom:12 }}>
                  <button onClick={() => printSJ(o, products, outlets)} style={{ padding:'8px 16px', background: ['delivered','partial_delivered','rejected'].includes(o.status) ? '#10b981' : '#1C1208', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    {sjLabel(o)}
                  </button>
                </div>
              )}
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr style={{ background:'#f8f7f4' }}>
                  <th style={S.th}>No</th><th style={S.th}>Produk</th><th style={{...S.th,textAlign:'right'}}>Order</th><th style={{...S.th,textAlign:'right'}}>Terima</th><th style={{...S.th,textAlign:'right'}}>Reject</th>
                </tr></thead>
                <tbody>
                  {(o.order_items||[]).map((item,i) => {
                    const p = products.find(x => x.id === item.product_id);
                    return (
                      <tr key={item.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={S.td}>{item.no||i+1}</td>
                        <td style={S.td}>{p?.name||'-'}</td>
                        <td style={{...S.td,textAlign:'right',fontWeight:700}}>{item.qty} {p?.unit}</td>
                        <td style={{...S.td,textAlign:'right',color:'#10b981'}}>{item.qty_delivered??item.qty}</td>
                        <td style={{...S.td,textAlign:'right',color: item.qty_rejected>0?'#ef4444':'#94a3b8'}}>{item.qty_rejected||0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Order List */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filteredOrders.length === 0
          ? <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', color:'#94a3b8' }}>Tidak ada order</div>
          : filteredOrders.map(order => {
          const outlet = outlets.find(o => o.id === order.outlet_id);
          return (
            <div key={order.id} style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:800, fontSize:15 }}>{order.order_no}</span>
                    <StatusBadge status={order.status} />
                    {order.driver_name && <span style={{ fontSize:11, color:'#64748b' }}>🚗 {order.driver_name} {order.vehicle_no && `· ${order.vehicle_no}`}</span>}
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>
                    🏪 {outlet?.name||'-'} · Oleh: {order.created_by_name||'-'}
                  </div>
                  {/* Tanggal kirim dengan indikator */}
                  {(() => {
                    const todayStr = today();
                    const diff = Math.round((new Date(order.delivery_date) - new Date(todayStr)) / 86400000);
                    const isRescheduled = order.original_delivery_date && order.original_delivery_date !== order.delivery_date;
                    const dateColor = diff < 0 ? '#ef4444' : diff === 0 ? '#B49A35' : '#64748b';
                    const dateLabel = diff < 0 ? `(${Math.abs(diff)} hari lalu)` : diff === 0 ? '(hari ini)' : diff === 1 ? '(besok)' : `(${diff} hari lagi)`;
                    return (
                      <div style={{ fontSize:12, marginTop:3, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ color: dateColor, fontWeight:600 }}>📅 Kirim: {fmtDate(order.delivery_date)} {dateLabel}</span>
                        {order.actual_delivery_date && order.actual_delivery_date !== order.delivery_date && (
                          <span style={{ color:'#8b5cf6', fontSize:11 }}>· Aktual: {fmtDate(order.actual_delivery_date)}</span>
                        )}
                        {isRescheduled && (
                          <span style={{ background:'#FBF5DF', color:'#6B5418', padding:'1px 7px', borderRadius:10, fontSize:10, fontWeight:700 }}>
                            🔄 Dijadwal ulang
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {order.notes && <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>📝 {order.notes}</div>}
                  {order.reschedule_notes && <div style={{ fontSize:11, color:'#B49A35', marginTop:2 }}>📋 Alasan reschedule: {order.reschedule_notes}</div>}
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  <Btn small onClick={() => setDetailOrder(order)} color="#64748b">👁 Detail</Btn>
                  {canStatus && order.status === 'pending' && <>
                    <Btn small onClick={() => setProductionOrder(order)} color="#3b82f6">📋 Proses & Checklist</Btn>
                    <Btn small onClick={() => rescheduleOrder(order)} color="#B49A35">📅 Ubah Jadwal</Btn>
                    <Btn small onClick={() => updateStatus(order,'cancelled')} color="#ef4444">✕ Batal</Btn>
                  </>}
                  {canStatus && order.status === 'confirmed' && <>
                    <Btn small onClick={() => rescheduleOrder(order)} color="#B49A35">📅 Ubah Jadwal</Btn>
                    <Btn small onClick={() => updateStatus(order,'packed')} color="#8b5cf6">📦 Packing</Btn>
                  </>}
                  {canStatus && order.status === 'packed' && <Btn small onClick={() => setShowRejectForm(order.id)} color="#10b981">✅ Konfirmasi Terima</Btn>}
                </div>
              </div>

              {/* Items */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: showRejectForm === order.id ? 16 : 0 }}>
                {(order.order_items||[]).map((item,i) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <span key={i} style={{ background:'#f8f7f4', border:'1px solid #e2e8f0', padding:'4px 10px', borderRadius:6, fontSize:12 }}>
                      {p?.name} × {item.qty}
                      {item.qty_rejected > 0 && <span style={{ color:'#ef4444', marginLeft:4 }}>(-{item.qty_rejected} reject)</span>}
                    </span>
                  );
                })}
              </div>

              {/* Reject Form */}
              {showRejectForm === order.id && (
                <div style={{ background:'#f8f7f4', borderRadius:8, padding:16, marginTop:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1C1208' }}>Konfirmasi Penerimaan — {order.order_no}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>Isi qty reject jika ada barang yang ditolak. Kosongkan jika semua diterima.</div>
                  {(order.order_items||[]).map(item => {
                    const p = products.find(x => x.id === item.product_id);
                    return (
                      <div key={item.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 2fr', gap:8, marginBottom:8, alignItems:'center' }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{p?.name} <span style={{ color:'#64748b', fontWeight:400 }}>(kirim: {item.qty})</span></div>
                        <input type="number" min="0" max={item.qty} placeholder="Qty reject" value={rejectData[item.id]?.qty||''} onChange={e => setRejectData(d => ({...d, [item.id]: {...(d[item.id]||{}), qty: e.target.value}}))} style={{...S.input, textAlign:'center'}} />
                        <select value={rejectData[item.id]?.reason||''} onChange={e => setRejectData(d => ({...d, [item.id]: {...(d[item.id]||{}), reason: e.target.value}}))} style={S.input}>
                          <option value=''>-- Alasan reject --</option>
                          {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <Btn onClick={() => submitReject(order)} disabled={saving} color="#10b981">{saving ? 'Menyimpan...' : '✅ Simpan Konfirmasi'}</Btn>
                    <Btn onClick={() => { setShowRejectForm(null); setRejectData({}); }} color="#64748b">Batal</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
