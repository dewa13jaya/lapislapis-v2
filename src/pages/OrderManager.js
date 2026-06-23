import React, { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, today, fmtDate, S, REJECT_REASONS, STATUS_CFG, useIsMobile } from '../utils';
import { StatusBadge, Btn, FieldGroup, Modal } from '../components/UI';
import ProductionDetail from './ProductionDetail';
import { printSJ, sjLabel } from '../printSJ';

const logActivity = async (user, action, description) => {
  await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action, description });
};

export default function OrderManager({ products, outlets, orders, currentStock, onRefresh, refreshOrders, refreshReturns, showToast }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // ── Core state ────────────────────────────────────────────────────────────
  const [showForm, setShowForm]           = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(null); // order.id
  const [detailOrder, setDetailOrder]     = useState(null);
  const [productionOrder, setProductionOrder] = useState(null);
  const [form, setForm]                   = useState({ outlet_id:'', delivery_date: today(), notes:'', items:[] });
  const [newItem, setNewItem]             = useState({ kat:'', variant:'', product_id:'', qty:'' });
  const [rejectData, setRejectData]       = useState({});
  const [saving, setSaving]               = useState(false);
  const [filter, setFilter]               = useState('all');
  const [search, setSearch]               = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [sortBy, setSortBy]               = useState('newest');

  // ── Mass Order mode ───────────────────────────────────────────────────────
  const [massOrderMode, setMassOrderMode] = useState(false);
  const [massOrderQty, setMassOrderQty]   = useState({}); // { product_id: qty_string }

  // ── Modal state (menggantikan window.prompt) ──────────────────────────────
  const [packingModal, setPackingModal]       = useState(null); // order object
  const [packingData, setPackingData]         = useState({ driver:'', vehicle:'' });
  const [rescheduleModal, setRescheduleModal] = useState(null); // order object
  const [rescheduleData, setRescheduleData]   = useState({ date:'', notes:'' });
  const [cancelModal, setCancelModal]         = useState(null); // order object

  // ── Helpers ───────────────────────────────────────────────────────────────
  const KAT_LIST   = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
  const SIZES_RE   = /\s*[-–]?\s*(Slice|Quarter|Half|Round|Square|Loyang)\s*$/i;
  const getSizeName = name => { const m = name.match(SIZES_RE); return m ? m[1] : ''; };
  const getVariant  = name => name.replace(SIZES_RE, '').trim();
  const variantsFor = kat => [...new Set(products.filter(p => !kat || p.kategori === kat).map(p => getVariant(p.name)))].sort();
  const sizesFor   = variant => products.filter(p => getVariant(p.name) === variant);

  const canCreate = ['admin','sales','kepala_sales'].includes(user?.role);
  const canStatus = ['admin','produksi','kepala_produksi'].includes(user?.role);
  const assignedOutletIds  = user?.outlet_ids || [];
  const availableOutlets   = (user?.role === 'sales' && assignedOutletIds.length > 0)
    ? outlets.filter(o => assignedOutletIds.includes(o.id))
    : outlets;

  // ── Order form ────────────────────────────────────────────────────────────
  const addItem = () => {
    if (!newItem.product_id || !newItem.qty) return;
    const existing = form.items.findIndex(i => i.product_id === newItem.product_id);
    if (existing >= 0) {
      const items = [...form.items]; items[existing].qty = Number(items[existing].qty) + Number(newItem.qty);
      setForm(f => ({...f, items}));
    } else {
      setForm(f => ({...f, items:[...f.items, { product_id: newItem.product_id, qty: Number(newItem.qty) }]}));
    }
    setNewItem({ kat:'', variant:'', product_id:'', qty:'' });
  };

  const submitOrder = async () => {
    if (!form.outlet_id) return showToast('❌ Pilih outlet tujuan');
    if (form.items.length === 0) return showToast('❌ Tambahkan minimal 1 produk');
    setSaving(true);
    const orderNo = 'ORD-' + new Date().getFullYear() + '-' + String(orders.length+1).padStart(4,'0');
    const orderId = uid();
    const { error: oErr } = await supabase.from('orders').insert({ id: orderId, order_no: orderNo, outlet_id: form.outlet_id, delivery_date: form.delivery_date, notes: form.notes, original_delivery_date: form.delivery_date, status:'pending', created_by: user.id, created_by_name: user.name });
    if (oErr) { setSaving(false); return showToast('❌ ' + oErr.message); }
    await supabase.from('order_items').insert(form.items.map((item,idx) => ({ id: uid(), order_id: orderId, product_id: item.product_id, qty: item.qty, qty_delivered: item.qty, qty_rejected: 0, no: idx+1 })));
    await logActivity(user, 'order_buat', `Order ${orderNo} dibuat untuk ${outlets.find(o=>o.id===form.outlet_id)?.name}`);
    setSaving(false);
    showToast('✅ Order ' + orderNo + ' berhasil dibuat!');
    setForm({ outlet_id:'', delivery_date: today(), notes:'', items:[] });
    setNewItem({ kat:'', variant:'', product_id:'', qty:'' });
    setShowForm(false);
    refreshOrders();
  };

  // ── Mass Order submit ─────────────────────────────────────────────────────
  const submitMassOrder = async () => {
    if (!form.outlet_id) return showToast('❌ Pilih outlet tujuan');
    const items = products
      .filter(p => Number(massOrderQty[p.id] || 0) > 0)
      .map(p => ({ product_id: p.id, qty: Number(massOrderQty[p.id]) }));
    if (items.length === 0) return showToast('❌ Isi qty minimal 1 produk');
    setSaving(true);
    const orderNo = 'ORD-' + new Date().getFullYear() + '-' + String(orders.length + 1).padStart(4, '0');
    const orderId = uid();
    const { error: oErr } = await supabase.from('orders').insert({
      id: orderId, order_no: orderNo, outlet_id: form.outlet_id,
      delivery_date: form.delivery_date, notes: form.notes,
      original_delivery_date: form.delivery_date,
      status: 'pending', created_by: user.id, created_by_name: user.name,
    });
    if (oErr) { setSaving(false); return showToast('❌ ' + oErr.message); }
    await supabase.from('order_items').insert(
      items.map((item, idx) => ({
        id: uid(), order_id: orderId, product_id: item.product_id,
        qty: item.qty, qty_delivered: item.qty, qty_rejected: 0, no: idx + 1,
      }))
    );
    await logActivity(user, 'order_buat', `Order ${orderNo} (mass) dibuat untuk ${outlets.find(o => o.id === form.outlet_id)?.name}`);
    setSaving(false);
    showToast('✅ Order ' + orderNo + ' berhasil dibuat!');
    setMassOrderQty({});
    setMassOrderMode(false);
    setForm({ outlet_id: '', delivery_date: today(), notes: '', items: [] });
    refreshOrders();
  };

  // ── Status updates — pakai modal, bukan window.prompt ────────────────────
  const updateStatus = async (order, status) => {
    if (status === 'packed') {
      setPackingData({ driver:'', vehicle:'' });
      setPackingModal(order);
      return;
    }
    if (status === 'cancelled') {
      setCancelModal(order);
      return;
    }
    await supabase.from('orders').update({ status }).eq('id', order.id);
    await logActivity(user, 'order_status', `Order ${order.order_no} → ${STATUS_CFG[status]?.label}`);
    showToast('✅ Status diupdate');
    refreshOrders();
  };

  const confirmPacking = async () => {
    if (!packingData.driver.trim()) return showToast('❌ Nama driver wajib diisi');
    const order = packingModal;
    const todayDate = today();
    setSaving(true);
    await supabase.from('orders').update({
      status: 'packed',
      driver_name: packingData.driver.trim(),
      vehicle_no: packingData.vehicle.trim() || '',
      actual_delivery_date: todayDate,
    }).eq('id', order.id);
    if (order.delivery_date !== todayDate) {
      await logActivity(user, 'order_status', `Order ${order.order_no} → Packing. Aktual: ${todayDate} (rencana: ${order.delivery_date}). Driver: ${packingData.driver}`);
    } else {
      await logActivity(user, 'order_status', `Order ${order.order_no} → Packing. Driver: ${packingData.driver}`);
    }
    setSaving(false);
    setPackingModal(null);
    showToast('✅ Status diupdate ke Packing');
    refreshOrders();
  };

  const openReschedule = (order) => {
    setRescheduleData({ date: order.delivery_date, notes: '' });
    setRescheduleModal(order);
  };

  const confirmReschedule = async () => {
    const order = rescheduleModal;
    const { date, notes } = rescheduleData;
    if (!date || date === order.delivery_date) return showToast('❌ Masukkan tanggal baru yang berbeda');
    const oldDate = order.delivery_date;
    await supabase.from('orders').update({
      delivery_date: date,
      original_delivery_date: order.original_delivery_date || oldDate,
      reschedule_notes: notes,
    }).eq('id', order.id);
    await logActivity(user, 'order_reschedule', `Order ${order.order_no} — jadwal: ${oldDate} → ${date}${notes ? '. Alasan: ' + notes : ''}`);
    setRescheduleModal(null);
    showToast(`✅ Jadwal diubah ke ${fmtDate(date)}`);
    refreshOrders();
  };

  const confirmCancel = async () => {
    const order = cancelModal;
    await supabase.from('orders').update({ status:'cancelled' }).eq('id', order.id);
    await logActivity(user, 'order_status', `Order ${order.order_no} → Dibatalkan`);
    setCancelModal(null);
    showToast('✅ Order dibatalkan');
    refreshOrders();
  };

  // ── Konfirmasi Terima / Reject ────────────────────────────────────────────
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
    refreshOrders(); refreshReturns();
  };

  // ── Filtered + sorted orders ──────────────────────────────────────────────
  const filteredOrders = useMemo(() => orders
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
    }), [orders, filter, search, dateFrom, dateTo, sortBy, outlets]);

  // ── ProductionDetail full-page view ──────────────────────────────────────
  if (productionOrder) {
    return (
      <ProductionDetail
        order={productionOrder}
        products={products}
        outlets={outlets}
        currentStock={currentStock}
        onBack={() => setProductionOrder(null)}
        onRefresh={refreshOrders}
        showToast={showToast}
      />
    );
  }

  // ── Shared action buttons for an order card ───────────────────────────────
  const ActionButtons = ({ order }) => (
    <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 6, flexWrap:'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end', marginTop: isMobile ? 12 : 0 }}>
      <Btn small={!isMobile} onClick={() => setDetailOrder(order)} color="#64748b" style={isMobile ? { width:'100%' } : {}}>👁 Detail</Btn>
      {canStatus && order.status === 'pending' && <>
        <Btn small={!isMobile} onClick={() => setProductionOrder(order)} color="#3b82f6" style={isMobile ? { width:'100%' } : {}}>📋 Proses & Checklist</Btn>
        <Btn small={!isMobile} onClick={() => openReschedule(order)} color="#B49A35" style={isMobile ? { width:'100%' } : {}}>📅 Ubah Jadwal</Btn>
        <Btn small={!isMobile} onClick={() => updateStatus(order,'cancelled')} color="#ef4444" style={isMobile ? { width:'100%' } : {}}>✕ Batal</Btn>
      </>}
      {canStatus && order.status === 'confirmed' && <>
        <Btn small={!isMobile} onClick={() => openReschedule(order)} color="#B49A35" style={isMobile ? { width:'100%' } : {}}>📅 Ubah Jadwal</Btn>
        <Btn small={!isMobile} onClick={() => updateStatus(order,'packed')} color="#8b5cf6" style={isMobile ? { width:'100%' } : {}}>📦 Packing</Btn>
      </>}
      {canStatus && order.status === 'packed' && (
        <Btn small={!isMobile} onClick={() => setShowRejectForm(order.id)} color="#10b981" style={isMobile ? { width:'100%' } : {}}>✅ Konfirmasi Terima</Btn>
      )}
    </div>
  );

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ margin:0, fontWeight:800, color:'#1C1208', fontSize: isMobile ? 20 : 24 }}>Order Sales</h2>
        {canCreate && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Btn onClick={() => { setMassOrderMode(m => !m); setShowForm(false); setMassOrderQty({}); }} color={massOrderMode ? '#64748b' : '#3b82f6'}>
              {massOrderMode ? '✕ Tutup' : '⊞ Mass Input'}
            </Btn>
            <Btn onClick={() => { setShowForm(f => !f); setMassOrderMode(false); }} color="#1C1208">
              {showForm ? '✕ Tutup' : '+ Buat Order'}
            </Btn>
          </div>
        )}
      </div>

      {/* ── New Order Form ──────────────────────────────────────────────────── */}
      {showForm && canCreate && (
        <div style={{ background:'#fff', borderRadius:12, padding: isMobile ? 16 : 24, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>🛒 Form Order Baru</h3>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:12, marginBottom:16 }}>
            <FieldGroup label="Outlet Tujuan">
              <select value={form.outlet_id} onChange={e => setForm(f => ({...f, outlet_id: e.target.value}))} style={S.input}>
                <option value=''>-- Pilih --</option>
                {availableOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {user?.role === 'sales' && assignedOutletIds.length === 0 && (
                <div style={{ fontSize:12, color:'#ef4444', marginTop:4 }}>⚠️ Belum di-assign ke outlet. Hubungi admin.</div>
              )}
            </FieldGroup>
            <FieldGroup label="Tanggal Kirim">
              <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({...f, delivery_date: e.target.value}))} style={S.input} />
            </FieldGroup>
            <FieldGroup label="Catatan">
              <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} style={S.input} placeholder="Opsional..." />
            </FieldGroup>
          </div>

          {/* Add items */}
          <div style={{ background:'#f8f7f4', borderRadius:8, padding:12, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Tambah Produk</div>
            {isMobile ? (
              // Mobile: tiap field full width, stacked vertikal
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <FieldGroup label="Kategori">
                  <select value={newItem.kat} onChange={e => setNewItem(i => ({...i, kat: e.target.value, variant:'', product_id:''}))} style={S.input}>
                    <option value=''>-- Semua Kategori --</option>
                    {KAT_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </FieldGroup>
                <FieldGroup label="Varian / Produk">
                  <select value={newItem.variant} onChange={e => {
                    const v = e.target.value;
                    const sizes = sizesFor(v);
                    setNewItem(i => ({...i, variant: v, product_id: sizes.length === 1 ? sizes[0].id : ''}));
                  }} style={S.input}>
                    <option value=''>-- Pilih Varian --</option>
                    {variantsFor(newItem.kat).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FieldGroup>
                {newItem.variant && (
                  <FieldGroup label="Ukuran">
                    {sizesFor(newItem.variant).length > 1
                      ? <select value={newItem.product_id} onChange={e => setNewItem(i => ({...i, product_id: e.target.value}))} style={S.input}>
                          <option value=''>-- Pilih Ukuran --</option>
                          {sizesFor(newItem.variant).map(p => {
                            const size = p.name.includes(' - ') ? p.name.split(' - ').pop() : p.name;
                            return <option key={p.id} value={p.id}>{size} — Stok: {currentStock[p.id]||0}</option>;
                          })}
                        </select>
                      : <div style={{ ...S.input, background:'#f1f5f9', color:'#64748b' }}>
                          Stok: {currentStock[newItem.product_id]||0}
                        </div>
                    }
                  </FieldGroup>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'flex-end' }}>
                  <FieldGroup label="Qty">
                    <input type="number" min="1" value={newItem.qty} onChange={e => setNewItem(i => ({...i, qty: e.target.value}))} style={S.input} placeholder="0" />
                  </FieldGroup>
                  <div style={{ paddingBottom:0 }}>
                    <Btn onClick={addItem} color="#3b82f6" style={{ width:'100%', marginTop:22 }}>+ Tambah</Btn>
                  </div>
                </div>
              </div>
            ) : (
              // Desktop: grid 5 kolom
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto auto', gap:8, alignItems:'flex-end' }}>
                <div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:4 }}>Kategori</div>
                  <select value={newItem.kat} onChange={e => setNewItem(i => ({...i, kat: e.target.value, variant:'', product_id:''}))} style={S.input}>
                    <option value=''>-- Semua --</option>
                    {KAT_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:4 }}>Varian</div>
                  <select value={newItem.variant} onChange={e => {
                    const v = e.target.value;
                    const sizes = sizesFor(v);
                    setNewItem(i => ({...i, variant: v, product_id: sizes.length === 1 ? sizes[0].id : ''}));
                  }} style={S.input}>
                    <option value=''>-- Pilih Varian --</option>
                    {variantsFor(newItem.kat).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:4 }}>Ukuran</div>
                  {newItem.variant && sizesFor(newItem.variant).length > 1
                    ? <select value={newItem.product_id} onChange={e => setNewItem(i => ({...i, product_id: e.target.value}))} style={S.input}>
                        <option value=''>-- Pilih --</option>
                        {sizesFor(newItem.variant).map(p => {
                          const size = p.name.includes(' - ') ? p.name.split(' - ').pop() : p.name;
                          return <option key={p.id} value={p.id}>{size} (Stok: {currentStock[p.id]||0})</option>;
                        })}
                      </select>
                    : <div style={{ ...S.input, background:'#f1f5f9', color:'#94a3b8', fontSize:14 }}>
                        {newItem.product_id ? `Stok: ${currentStock[newItem.product_id]||0}` : '-'}
                      </div>
                  }
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:4 }}>Qty</div>
                  <input type="number" min="1" value={newItem.qty} onChange={e => setNewItem(i => ({...i, qty: e.target.value}))} style={{ ...S.input, width:80 }} placeholder="0" />
                </div>
                <Btn onClick={addItem} color="#3b82f6">+ Tambah</Btn>
              </div>
            )}
          </div>

          {form.items.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14, marginBottom:16 }}>
              <thead><tr style={{ background:'#f1f5f9' }}>
                <th style={{ ...{ padding:'10px 12px', textAlign:'left', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' } }}>No</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Produk</th>
                <th style={{ padding:'10px 12px', textAlign:'right', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Qty</th>
                <th style={{ padding:'10px 12px', borderBottom:'2px solid #e2e8f0' }}></th>
              </tr></thead>
              <tbody>
                {form.items.map((item,idx) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'10px 12px', fontSize:14 }}>{idx+1}</td>
                      <td style={{ padding:'10px 12px', fontSize:14 }}>{p?.name}</td>
                      <td style={{ padding:'10px 12px', fontSize:14, textAlign:'right', fontWeight:700 }}>{item.qty} {p?.unit}</td>
                      <td style={{ padding:'10px 12px' }}><button onClick={() => setForm(f => ({...f, items: f.items.filter((_,i) => i!==idx)}))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:18, padding:4 }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <Btn onClick={submitOrder} disabled={saving} color="#10b981" style={{ width: isMobile ? '100%' : 'auto' }}>{saving ? 'Menyimpan...' : '✅ Kirim Order ke Produksi'}</Btn>
        </div>
      )}

      {/* ── Mass Order Grid ─────────────────────────────────────────────────── */}
      {massOrderMode && canCreate && (() => {
        const MASS_SIZES  = ['Slice','Quarter','Half','Round','Square'];
        const MASS_LABELS = { Slice:'Slc', Quarter:'Qtr', Half:'Half', Round:'Rnd', Square:'Sqr' };
        const KAT_ORDER   = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
        const KAT_COLOR   = { 'Lapis Legit':'#FBF5DF','Lapis Surabaya':'#dbeafe','Cookies':'#fce7f3','Gift Box':'#d1fae5' };

        // Build pivot: { kat: { variant: { size: product } } }
        const mp = {};
        products.forEach(p => {
          const kat     = p.kategori || 'Lainnya';
          const variant = getVariant(p.name);
          let sz = getSizeName(p.name);
          if (!sz || sz.toLowerCase() === 'loyang') sz = 'Square';
          if (!mp[kat]) mp[kat] = {};
          if (!mp[kat][variant]) mp[kat][variant] = {};
          mp[kat][variant][sz] = p;
        });

        const activeCols  = MASS_SIZES.filter(sz => Object.values(mp).some(vs => Object.values(vs).some(ss => ss[sz])));
        const sortedKats  = [...KAT_ORDER.filter(k => mp[k]), ...Object.keys(mp).filter(k => !KAT_ORDER.includes(k)).sort()];
        const totalFilled = Object.values(massOrderQty).filter(v => Number(v) > 0).length;

        return (
          <div style={{ background:'#fff', borderRadius:12, padding: isMobile ? 16 : 24, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
            <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>⊞ Mass Input Order</h3>

            {/* Header fields: outlet, tanggal, catatan */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:12, marginBottom:16 }}>
              <FieldGroup label="Outlet Tujuan *">
                <select value={form.outlet_id} onChange={e => setForm(f => ({...f, outlet_id: e.target.value}))} style={S.input}>
                  <option value=''>-- Pilih --</option>
                  {availableOutlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {user?.role === 'sales' && assignedOutletIds.length === 0 && (
                  <div style={{ fontSize:12, color:'#ef4444', marginTop:4 }}>⚠️ Belum di-assign ke outlet. Hubungi admin.</div>
                )}
              </FieldGroup>
              <FieldGroup label="Tanggal Kirim *">
                <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({...f, delivery_date: e.target.value}))} style={S.input} />
              </FieldGroup>
              <FieldGroup label="Catatan">
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} style={S.input} placeholder="Opsional..." />
              </FieldGroup>
            </div>

            {/* Grid — mobile: list vertikal, desktop: pivot table */}
            {isMobile ? (
              // Mobile: tiap produk satu baris, tidak ada scroll horizontal
              <div style={{ border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden' }}>
                {sortedKats.map(kat => (
                  <React.Fragment key={kat}>
                    <div style={{ background: KAT_COLOR[kat]||'#f1f5f9', padding:'7px 12px', fontWeight:700, fontSize:12, color:'#374151', borderTop:'2px solid #e2e8f0' }}>
                      {kat}
                    </div>
                    {Object.keys(mp[kat]).sort().flatMap(variant =>
                      MASS_SIZES
                        .filter(sz => mp[kat][variant][sz])
                        .map(sz => {
                          const p = mp[kat][variant][sz];
                          const stok = currentStock[p.id] || 0;
                          const hasVal = Number(massOrderQty[p.id] || 0) > 0;
                          const multiSize = Object.keys(mp[kat][variant]).length > 1;
                          return (
                            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom:'1px solid #f1f5f9', background: hasVal ? '#eff6ff' : '#fff' }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:'#1C1208' }}>{variant}</div>
                                <div style={{ fontSize:11, color:'#64748b' }}>
                                  {multiSize ? <span style={{ marginRight:6 }}>{MASS_LABELS[sz]||sz}</span> : null}
                                  stok: <span style={{ fontWeight:700, color: stok <= 0 ? '#ef4444' : '#94a3b8' }}>{stok}</span>
                                </div>
                              </div>
                              <input
                                type="number" min="0"
                                value={massOrderQty[p.id] || ''}
                                onChange={e => setMassOrderQty(q => ({ ...q, [p.id]: e.target.value }))}
                                placeholder="0"
                                style={{ width:76, padding:'8px 6px', textAlign:'center', border:`2px solid ${hasVal ? '#3b82f6' : '#e2e8f0'}`, borderRadius:8, fontSize:18, fontWeight:700, outline:'none', color:'#111', colorScheme:'light', background: hasVal ? '#eff6ff' : '#fff' }}
                              />
                            </div>
                          );
                        })
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              // Desktop: pivot table
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'auto', minWidth:'100%' }}>
                  <colgroup>
                    <col style={{ width:180 }} />
                    {activeCols.map(sz => <col key={sz} style={{ width:76 }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ background:'#f8f7f4' }}>
                      <th style={{ padding:'6px 10px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Varian</th>
                      {activeCols.map(sz => (
                        <th key={sz} style={{ padding:'6px 8px', textAlign:'center', fontSize:10, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>
                          {MASS_LABELS[sz] || sz}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKats.map(kat => (
                      <React.Fragment key={kat}>
                        <tr>
                          <td colSpan={activeCols.length + 1} style={{ background: KAT_COLOR[kat]||'#f1f5f9', padding:'5px 10px', fontWeight:700, fontSize:11, color:'#374151', borderTop:'2px solid #e2e8f0' }}>
                            {kat}
                          </td>
                        </tr>
                        {Object.keys(mp[kat]).sort().map(variant => {
                          const sizes = mp[kat][variant];
                          return (
                            <tr key={variant} style={{ borderBottom:'1px solid #f1f5f9' }}>
                              <td style={{ padding:'4px 10px', fontSize:11, fontWeight:600, color:'#1C1208', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                {variant}
                              </td>
                              {activeCols.map(sz => {
                                const p = sizes[sz];
                                if (!p) return <td key={sz} style={{ padding:'3px 4px', textAlign:'center', color:'#d1d5db', fontSize:11 }}>—</td>;
                                const stok = currentStock[p.id] || 0;
                                const hasVal = Number(massOrderQty[p.id] || 0) > 0;
                                return (
                                  <td key={sz} style={{ padding:'3px 4px', textAlign:'center' }}>
                                    <input
                                      type="number" min="0"
                                      value={massOrderQty[p.id] || ''}
                                      onChange={e => setMassOrderQty(q => ({ ...q, [p.id]: e.target.value }))}
                                      placeholder="0"
                                      style={{ width:'100%', padding:'5px 4px', textAlign:'center', border:`2px solid ${hasVal ? '#3b82f6' : '#e2e8f0'}`, borderRadius:6, fontSize:13, fontWeight:700, outline:'none', boxSizing:'border-box', background: hasVal ? '#eff6ff' : '#fff', color:'#111', colorScheme:'light' }}
                                    />
                                    <div style={{ fontSize:9, color: stok <= 0 ? '#ef4444' : '#94a3b8', marginTop:1 }}>stok:{stok}</div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Submit */}
            <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <Btn
                onClick={submitMassOrder}
                disabled={saving || totalFilled === 0 || !form.outlet_id}
                color={totalFilled > 0 && form.outlet_id ? '#10b981' : '#94a3b8'}
              >
                {saving ? 'Menyimpan...' : `✅ Kirim Order${totalFilled > 0 ? ` (${totalFilled} produk)` : ''}`}
              </Btn>
              {totalFilled > 0 && (
                <button onClick={() => setMassOrderQty({})} style={{ padding:'10px 16px', background:'none', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, cursor:'pointer', color:'#64748b' }}>
                  Reset
                </button>
              )}
              {!form.outlet_id && <span style={{ fontSize:12, color:'#ef4444' }}>⚠️ Pilih outlet dulu</span>}
            </div>
          </div>
        );
      })()}

      {/* ── Search + Filter ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cari no. order / outlet..."
          style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #e2e8f0', fontSize:15, flex:1, minWidth:160 }}
        />
        {!isMobile && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:13, color:'#64748b', whiteSpace:'nowrap' }}>Tgl kirim:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding:'9px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:14 }} />
            <span style={{ fontSize:13, color:'#64748b' }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding:'9px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:14 }} />
          </div>
        )}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding:'10px 12px', borderRadius:10, border:'1px solid #e2e8f0', fontSize:14, background:'#fff' }}>
          <option value="newest">⬇ Terbaru</option>
          <option value="oldest">⬆ Terlama</option>
        </select>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} style={{ padding:'10px 14px', borderRadius:10, border:'none', background:'#fee2e2', color:'#ef4444', fontSize:13, cursor:'pointer', fontWeight:600 }}>✕ Reset</button>
        )}
      </div>
      {isMobile && (
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.input, flex:1 }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.input, flex:1 }} />
        </div>
      )}

      {/* ── Status Filter Pills ─────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {['all','pending','confirmed','packed','delivered','partial_delivered','rejected','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: isMobile ? '8px 14px' : '6px 12px', fontSize: isMobile ? 13 : 11, fontWeight:600, border:'none', borderRadius:20, cursor:'pointer', background: filter===s ? '#1C1208' : '#e2e8f0', color: filter===s ? '#fff' : '#64748b' }}>
            {s === 'all' ? 'Semua' : STATUS_CFG[s]?.label||s}
          </button>
        ))}
      </div>

      {/* ── Order Detail Modal ──────────────────────────────────────────────── */}
      {detailOrder && (() => {
        const o = detailOrder;
        const outlet = outlets.find(x => x.id === o.outlet_id);
        return (
          <Modal title={o.order_no} onClose={() => setDetailOrder(null)} wide>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
              <StatusBadge status={o.status} />
            </div>
            <div style={{ fontSize:14, color:'#64748b', marginBottom:4 }}>🏪 {outlet?.name||'-'} · 📅 {fmtDate(o.delivery_date)} · Oleh: {o.created_by_name||'-'}</div>
            {o.original_delivery_date && o.original_delivery_date !== o.delivery_date && (
              <div style={{ fontSize:13, color:'#B49A35', marginBottom:4 }}>🔄 Dijadwal ulang dari {fmtDate(o.original_delivery_date)}{o.reschedule_notes ? ` — ${o.reschedule_notes}` : ''}</div>
            )}
            {o.actual_delivery_date && <div style={{ fontSize:13, color:'#8b5cf6', marginBottom:4 }}>📦 Aktual kirim: {fmtDate(o.actual_delivery_date)}</div>}
            {o.driver_name && <div style={{ fontSize:14, color:'#64748b', marginBottom:4 }}>🚗 {o.driver_name} {o.vehicle_no && `· ${o.vehicle_no}`}</div>}
            {o.notes && <div style={{ fontSize:14, color:'#94a3b8', marginBottom:12 }}>📝 {o.notes}</div>}
            {['confirmed','packed','delivered','partial_delivered','rejected'].includes(o.status) && (
              <div style={{ marginBottom:16 }}>
                <Btn onClick={() => printSJ(o, products, outlets)} color={['delivered','partial_delivered','rejected'].includes(o.status) ? '#10b981' : '#1C1208'} style={{ width:'100%' }}>
                  {sjLabel(o)}
                </Btn>
              </div>
            )}
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>No</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Produk</th>
                <th style={{ padding:'10px 12px', textAlign:'right', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Order</th>
                <th style={{ padding:'10px 12px', textAlign:'right', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Terima</th>
                <th style={{ padding:'10px 12px', textAlign:'right', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Reject</th>
              </tr></thead>
              <tbody>
                {(o.order_items||[]).map((item,i) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <tr key={item.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'10px 12px', fontSize:14 }}>{item.no||i+1}</td>
                      <td style={{ padding:'10px 12px', fontSize:14 }}>{p?.name||'-'}</td>
                      <td style={{ padding:'10px 12px', fontSize:14, textAlign:'right', fontWeight:700 }}>{item.qty} {p?.unit}</td>
                      <td style={{ padding:'10px 12px', fontSize:14, textAlign:'right', color:'#10b981' }}>{item.qty_delivered??item.qty}</td>
                      <td style={{ padding:'10px 12px', fontSize:14, textAlign:'right', color: item.qty_rejected>0?'#ef4444':'#94a3b8' }}>{item.qty_rejected||0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Modal>
        );
      })()}

      {/* ── Order List ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filteredOrders.length === 0
          ? <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', color:'#94a3b8', fontSize:15 }}>Tidak ada order</div>
          : filteredOrders.map(order => {
            const outlet = outlets.find(o => o.id === order.outlet_id);
            return (
              <div key={order.id} style={{ background:'#fff', borderRadius:12, padding: isMobile ? 16 : 20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Order no + status */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                      <span style={{ fontWeight:800, fontSize: isMobile ? 17 : 15 }}>{order.order_no}</span>
                      <StatusBadge status={order.status} />
                      {!isMobile && order.driver_name && <span style={{ fontSize:12, color:'#64748b' }}>🚗 {order.driver_name} {order.vehicle_no && `· ${order.vehicle_no}`}</span>}
                    </div>
                    {/* Outlet + pembuat */}
                    <div style={{ fontSize: isMobile ? 14 : 13, color:'#64748b', marginBottom:4 }}>
                      🏪 {outlet?.name||'-'} · Oleh: {order.created_by_name||'-'}
                    </div>
                    {isMobile && order.driver_name && (
                      <div style={{ fontSize:13, color:'#64748b', marginBottom:4 }}>🚗 {order.driver_name} {order.vehicle_no && `· ${order.vehicle_no}`}</div>
                    )}
                    {/* Tanggal kirim */}
                    {(() => {
                      const todayStr = today();
                      const diff = Math.round((new Date(order.delivery_date) - new Date(todayStr)) / 86400000);
                      const isRescheduled = order.original_delivery_date && order.original_delivery_date !== order.delivery_date;
                      const dateColor = diff < 0 ? '#ef4444' : diff === 0 ? '#B49A35' : '#64748b';
                      const dateLabel = diff < 0 ? `(${Math.abs(diff)} hari lalu)` : diff === 0 ? '(hari ini)' : diff === 1 ? '(besok)' : `(${diff} hari lagi)`;
                      return (
                        <div style={{ fontSize: isMobile ? 14 : 13, marginBottom:4, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ color: dateColor, fontWeight:600 }}>📅 Kirim: {fmtDate(order.delivery_date)} {dateLabel}</span>
                          {order.actual_delivery_date && order.actual_delivery_date !== order.delivery_date && (
                            <span style={{ color:'#8b5cf6', fontSize:12 }}>· Aktual: {fmtDate(order.actual_delivery_date)}</span>
                          )}
                          {isRescheduled && (
                            <span style={{ background:'#FBF5DF', color:'#6B5418', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700 }}>🔄 Dijadwal ulang</span>
                          )}
                        </div>
                      );
                    })()}
                    {order.notes && <div style={{ fontSize: isMobile ? 13 : 12, color:'#94a3b8', marginBottom:2 }}>📝 {order.notes}</div>}
                    {order.reschedule_notes && <div style={{ fontSize: isMobile ? 13 : 11, color:'#B49A35', marginBottom:2 }}>📋 Alasan reschedule: {order.reschedule_notes}</div>}
                  </div>
                  {/* Desktop action buttons — on right */}
                  {!isMobile && <ActionButtons order={order} />}
                </div>

                {/* Items pills */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop: isMobile ? 10 : 8 }}>
                  {(order.order_items||[]).map((item,i) => {
                    const p = products.find(x => x.id === item.product_id);
                    return (
                      <span key={i} style={{ background:'#f8f7f4', border:'1px solid #e2e8f0', padding: isMobile ? '6px 12px' : '4px 10px', borderRadius:6, fontSize: isMobile ? 13 : 12 }}>
                        {p?.name} × {item.qty}
                        {item.qty_rejected > 0 && <span style={{ color:'#ef4444', marginLeft:4 }}>(-{item.qty_rejected} reject)</span>}
                      </span>
                    );
                  })}
                </div>

                {/* Mobile action buttons — below */}
                {isMobile && <ActionButtons order={order} />}
              </div>
            );
          })}
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Packing Modal */}
      {packingModal && (
        <Modal title={`📦 Packing — ${packingModal.order_no}`} onClose={() => setPackingModal(null)}>
          <div style={{ marginBottom:16, fontSize:14, color:'#64748b' }}>
            🏪 {outlets.find(o=>o.id===packingModal.outlet_id)?.name||'-'} · 📅 {fmtDate(packingModal.delivery_date)}
          </div>
          <div style={{ marginBottom:14 }}>
            <FieldGroup label="Nama Driver / Kurir *">
              <input
                value={packingData.driver}
                onChange={e => setPackingData(d => ({...d, driver: e.target.value}))}
                style={S.input}
                placeholder="Nama driver..."
                autoFocus
              />
            </FieldGroup>
          </div>
          <div style={{ marginBottom:22 }}>
            <FieldGroup label="Nomor Kendaraan (opsional)">
              <input
                value={packingData.vehicle}
                onChange={e => setPackingData(d => ({...d, vehicle: e.target.value}))}
                style={S.input}
                placeholder="B 1234 XYZ"
              />
            </FieldGroup>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn onClick={confirmPacking} disabled={saving || !packingData.driver.trim()} color="#8b5cf6" style={{ flex:1 }}>
              {saving ? 'Menyimpan...' : '📦 Konfirmasi Packing'}
            </Btn>
            <Btn onClick={() => setPackingModal(null)} color="#64748b">Batal</Btn>
          </div>
        </Modal>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <Modal title={`📅 Ubah Jadwal — ${rescheduleModal.order_no}`} onClose={() => setRescheduleModal(null)}>
          <div style={{ marginBottom:16, padding:'10px 14px', background:'#f8f7f4', borderRadius:8, fontSize:14, color:'#64748b' }}>
            Tanggal saat ini: <b style={{ color:'#1C1208' }}>{fmtDate(rescheduleModal.delivery_date)}</b>
          </div>
          <div style={{ marginBottom:14 }}>
            <FieldGroup label="Tanggal Kirim Baru">
              <input
                type="date"
                value={rescheduleData.date}
                onChange={e => setRescheduleData(d => ({...d, date: e.target.value}))}
                style={S.input}
              />
            </FieldGroup>
          </div>
          <div style={{ marginBottom:22 }}>
            <FieldGroup label="Alasan Perubahan (opsional)">
              <input
                value={rescheduleData.notes}
                onChange={e => setRescheduleData(d => ({...d, notes: e.target.value}))}
                style={S.input}
                placeholder="Contoh: produksi belum selesai..."
              />
            </FieldGroup>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn
              onClick={confirmReschedule}
              disabled={!rescheduleData.date || rescheduleData.date === rescheduleModal.delivery_date}
              color="#B49A35"
              style={{ flex:1 }}
            >
              ✅ Simpan Jadwal Baru
            </Btn>
            <Btn onClick={() => setRescheduleModal(null)} color="#64748b">Batal</Btn>
          </div>
        </Modal>
      )}

      {/* Cancel Confirm Modal */}
      {cancelModal && (
        <Modal title="Batalkan Order?" onClose={() => setCancelModal(null)}>
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:15, marginBottom:8 }}>
              Yakin membatalkan order <b>{cancelModal.order_no}</b>?
            </div>
            <div style={{ fontSize:14, color:'#64748b' }}>
              🏪 {outlets.find(o=>o.id===cancelModal.outlet_id)?.name||'-'} · 📅 {fmtDate(cancelModal.delivery_date)}
            </div>
            <div style={{ fontSize:13, color:'#ef4444', marginTop:8 }}>Tindakan ini tidak bisa diurungkan.</div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn onClick={confirmCancel} color="#ef4444" style={{ flex:1 }}>Ya, Batalkan</Btn>
            <Btn onClick={() => setCancelModal(null)} color="#64748b" style={{ flex:1 }}>Tidak</Btn>
          </div>
        </Modal>
      )}

      {/* Konfirmasi Terima / Reject Modal */}
      {showRejectForm && (() => {
        const order = orders.find(o => o.id === showRejectForm);
        if (!order) return null;
        return (
          <Modal title={`✅ Konfirmasi Terima — ${order.order_no}`} onClose={() => { setShowRejectForm(null); setRejectData({}); }} wide>
            <div style={{ fontSize:14, color:'#64748b', marginBottom:16 }}>
              Isi qty reject jika ada barang yang ditolak. Kosongkan jika semua diterima.
            </div>
            {(order.order_items||[]).map(item => {
              const p = products.find(x => x.id === item.product_id);
              return (
                <div key={item.id} style={{ marginBottom:14, padding:14, background:'#f8f7f4', borderRadius:10 }}>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{p?.name||'-'}</div>
                  <div style={{ fontSize:13, color:'#64748b', marginBottom:10 }}>
                    Qty dikirim: <b>{item.qty} {p?.unit}</b>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <FieldGroup label="Qty Reject">
                      <input
                        type="number" min="0" max={item.qty} placeholder="0"
                        value={rejectData[item.id]?.qty||''}
                        onChange={e => setRejectData(d => ({...d, [item.id]: {...(d[item.id]||{}), qty: e.target.value}}))}
                        style={S.input}
                      />
                    </FieldGroup>
                    <FieldGroup label="Alasan Reject">
                      <select
                        value={rejectData[item.id]?.reason||''}
                        onChange={e => setRejectData(d => ({...d, [item.id]: {...(d[item.id]||{}), reason: e.target.value}}))}
                        style={S.input}
                      >
                        <option value=''>-- Alasan --</option>
                        {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </FieldGroup>
                  </div>
                </div>
              );
            })}
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <Btn onClick={() => submitReject(order)} disabled={saving} color="#10b981" style={{ flex:1 }}>
                {saving ? 'Menyimpan...' : '✅ Simpan Konfirmasi'}
              </Btn>
              <Btn onClick={() => { setShowRejectForm(null); setRejectData({}); }} color="#64748b">Batal</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
