import { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, today, fmtDate } from '../utils';
import { Btn } from '../components/UI';

const logActivity = async (user, action, description) => {
  await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action, description });
};

export default function ProductionDetail({ order, products, outlets, currentStock, onBack, onRefresh, showToast }) {
  const { user } = useAuth();
  const outlet = outlets.find(o => o.id === order.outlet_id) || {};
  const items = order.order_items || [];

  // checked: { [itemId]: bool }
  // revised: { [itemId]: qty string }
  const [checked, setChecked] = useState({});
  const [revised, setRevised] = useState({});
  const [saving, setSaving] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Must be defined before stockIssues (no hoisting for const)
  const getRevQty = (item) => {
    const v = revised[item.id];
    return v !== undefined ? Number(v) : Number(item.qty);
  };

  const checkedCount   = items.filter(i => checked[i.id]).length;
  const allChecked     = items.length > 0 && checkedCount === items.length;
  const progress       = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
  const stockIssues    = items.filter(i => (currentStock[i.product_id] || 0) < getRevQty(i) && getRevQty(i) > 0);
  const hasStockIssue  = stockIssues.length > 0;

  // Tanggal kirim vs hari ini
  const todayStr       = today();
  const deliveryStr    = order.delivery_date;
  const daysDiff       = Math.round((new Date(deliveryStr) - new Date(todayStr)) / 86400000);
  const dateWarning    = daysDiff < 0 ? `⚠️ Jadwal kirim ${Math.abs(daysDiff)} hari yang lalu (${fmtDate(deliveryStr)})`
                       : daysDiff === 0 ? null
                       : `📅 Jadwal kirim ${daysDiff} hari lagi (${fmtDate(deliveryStr)})`;

  const toggleCheck = (id) => setChecked(c => ({ ...c, [id]: !c[id] }));

  const handleConfirm = async () => {
    if (!allChecked) return showToast('❌ Centang semua item terlebih dahulu');
    if (hasStockIssue) return showToast(`❌ Stok tidak cukup untuk ${stockIssues.length} item. Revisi qty dulu.`);
    setSaving(true);

    // Update order status → confirmed
    await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id);

    // Update qty_delivered only — item.qty = original sales order qty, must never change
    for (const item of items) {
      const revQty = getRevQty(item);
      if (revQty !== Number(item.qty_delivered ?? item.qty)) {
        await supabase.from('order_items').update({ qty_delivered: revQty }).eq('id', item.id);
      }
    }

    await logActivity(user, 'order_status', `Order ${order.order_no} → Confirmed (Checklist produksi selesai)`);
    showToast('✅ Order dikonfirmasi ke produksi!');
    setSaving(false);
    onRefresh();
    onBack();
  };

  const handleReject = async () => {
    setSaving(true);
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    await logActivity(user, 'order_status', `Order ${order.order_no} → Cancelled${rejectNote ? ' — ' + rejectNote : ''}`);
    showToast('Order dibatalkan');
    setSaving(false);
    onRefresh();
    onBack();
  };

  return (
    <div>
      {/* Back + header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 14px', fontSize:13, cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center', gap:6 }}>
          ← Kembali
        </button>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontWeight:800, fontSize:18, color:'#1C1208' }}>{order.order_no}</span>
            <span style={{ background:'#FBF5DF', color:'#6B5418', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>⏳ PENDING</span>
          </div>
          <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>
            🏪 {outlet.name||'-'} · 📅 Kirim: {fmtDate(order.delivery_date)} · Dibuat oleh: {order.created_by_name||'-'}
          </div>
        </div>
      </div>

      {/* Date warning */}
      {dateWarning && (
        <div style={{ background: daysDiff < 0 ? '#fee2e2' : '#FBF5DF', borderRadius:10, padding:'10px 16px', marginBottom:12, fontSize:13, color: daysDiff < 0 ? '#991b1b' : '#6B5418', fontWeight:600 }}>
          {dateWarning} — Pastikan jadwal pengiriman sudah dikonfirmasi dengan sales.
        </div>
      )}

      {/* Progress bar */}
      <div style={{ background:'#fff', borderRadius:12, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1C1208' }}>📋 Progress Checklist</span>
          <span style={{ fontSize:13, fontWeight:700, color: allChecked ? '#10b981' : '#64748b' }}>
            {checkedCount} / {items.length} item {allChecked ? '✅ Semua siap!' : ''}
          </span>
        </div>
        <div style={{ background:'#f1f5f9', borderRadius:99, height:10, overflow:'hidden' }}>
          <div style={{ width:progress+'%', height:'100%', background: allChecked ? '#10b981' : '#3b82f6', borderRadius:99, transition:'width .3s' }} />
        </div>

        {/* Stok warning summary */}
        {hasStockIssue && (
          <div style={{ marginTop:12, padding:'10px 12px', background:'#fee2e2', borderRadius:8, fontSize:12, color:'#991b1b', fontWeight:600 }}>
            ❌ {stockIssues.length} item stok tidak cukup — revisi qty menjadi ≤ stok tersedia sebelum konfirmasi.
          </div>
        )}
      </div>

      {/* Checklist table */}
      <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f8f7f4' }}>
              <th style={{ padding:'10px 14px', width:40, textAlign:'center', borderBottom:'2px solid #e2e8f0' }}>✓</th>
              <th style={{ padding:'10px 14px', textAlign:'left', borderBottom:'2px solid #e2e8f0', fontSize:11, color:'#64748b', fontWeight:700 }}>PRODUK</th>
              <th style={{ padding:'10px 14px', textAlign:'center', borderBottom:'2px solid #e2e8f0', fontSize:11, color:'#64748b', fontWeight:700 }}>QTY ORDER</th>
              <th style={{ padding:'10px 14px', textAlign:'center', borderBottom:'2px solid #e2e8f0', fontSize:11, color:'#64748b', fontWeight:700 }}>STOK TERSEDIA</th>
              <th style={{ padding:'10px 14px', textAlign:'center', borderBottom:'2px solid #e2e8f0', fontSize:11, color:'#64748b', fontWeight:700 }}>REVISI QTY</th>
              <th style={{ padding:'10px 14px', textAlign:'center', borderBottom:'2px solid #e2e8f0', fontSize:11, color:'#64748b', fontWeight:700 }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const product = products.find(p => p.id === item.product_id) || {};
              const stok    = currentStock[item.product_id] || 0;
              const revQty  = getRevQty(item);
              const isShort = stok < revQty;
              const isOk    = stok >= revQty;
              const isDone  = checked[item.id];

              return (
                <tr key={item.id} style={{ borderBottom:'1px solid #f1f5f9', background: isDone ? '#f0fdf4' : isShort ? '#fff7ed' : '#fff', opacity: isDone ? 0.85 : 1 }}>
                  {/* Checkbox */}
                  <td style={{ padding:'12px 14px', textAlign:'center' }}>
                    <input
                      type="checkbox"
                      checked={!!isDone}
                      onChange={() => toggleCheck(item.id)}
                      style={{ width:18, height:18, cursor:'pointer', accentColor:'#10b981' }}
                    />
                  </td>

                  {/* Product */}
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ fontWeight:600 }}>{product.name || '-'}</div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>No. {item.no || idx+1} · {product.unit || ''}</div>
                  </td>

                  {/* Qty order */}
                  <td style={{ padding:'12px 14px', textAlign:'center', fontWeight:700, fontSize:15 }}>
                    {item.qty}
                  </td>

                  {/* Stok tersedia */}
                  <td style={{ padding:'12px 14px', textAlign:'center' }}>
                    <span style={{ fontWeight:700, fontSize:15, color: isShort ? '#ef4444' : '#10b981' }}>{stok}</span>
                    {isShort && <div style={{ fontSize:11, color:'#ef4444', marginTop:2 }}>⚠️ Kurang {revQty - stok}</div>}
                    {isOk && <div style={{ fontSize:11, color:'#10b981', marginTop:2 }}>✓ Cukup</div>}
                  </td>

                  {/* Revisi qty */}
                  <td style={{ padding:'12px 14px', textAlign:'center' }}>
                    <input
                      type="number"
                      min="0"
                      max={item.qty}
                      value={revised[item.id] !== undefined ? revised[item.id] : item.qty}
                      onChange={e => setRevised(r => ({ ...r, [item.id]: e.target.value }))}
                      disabled={isDone}
                      style={{ width:70, padding:'6px 8px', border:`1px solid ${isShort ? '#D4B340' : '#e2e8f0'}`, borderRadius:8, fontSize:13, textAlign:'center', background: isDone ? '#f1f5f9' : '#fff' }}
                    />
                    {revised[item.id] !== undefined && Number(revised[item.id]) !== Number(item.qty) && (
                      <div style={{ fontSize:11, color:'#B49A35', marginTop:2 }}>direvisi</div>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding:'12px 14px', textAlign:'center' }}>
                    {isDone
                      ? <span style={{ background:'#dcfce7', color:'#166534', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>✅ Siap</span>
                      : isShort
                        ? <span style={{ background:'#FBF5DF', color:'#6B5418', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>⚠️ Cek Stok</span>
                        : <span style={{ background:'#f1f5f9', color:'#64748b', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>⬜ Belum</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {order.notes && (
        <div style={{ background:'#fff', borderRadius:12, padding:14, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16, fontSize:13, color:'#64748b' }}>
          📝 Catatan order: {order.notes}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display:'flex', gap:12, justifyContent:'flex-end', flexWrap:'wrap' }}>
        <Btn onClick={() => setShowRejectConfirm(true)} color="#ef4444" disabled={saving}>
          ❌ Tolak Order
        </Btn>
        <Btn onClick={handleConfirm} color="#10b981" disabled={saving || !allChecked || hasStockIssue}>
          {saving ? 'Menyimpan...'
            : !allChecked ? `📋 Centang semua dulu (${checkedCount}/${items.length})`
            : hasStockIssue ? `❌ Selesaikan masalah stok dulu`
            : '✅ Konfirmasi ke Produksi'}
        </Btn>
      </div>

      {/* Reject confirm modal */}
      {showRejectConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:400, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ margin:'0 0 8px', fontWeight:800, color:'#1C1208' }}>Tolak Order?</h3>
            <p style={{ margin:'0 0 16px', fontSize:13, color:'#64748b' }}>Order {order.order_no} akan dibatalkan. Tindakan ini tidak bisa diundur.</p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Alasan pembatalan (opsional)..."
              style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, resize:'none', height:80, boxSizing:'border-box', marginBottom:16 }}
            />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <Btn onClick={() => setShowRejectConfirm(false)} color="#64748b">Batal</Btn>
              <Btn onClick={handleReject} color="#ef4444" disabled={saving}>{saving ? 'Menyimpan...' : 'Ya, Tolak Order'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
