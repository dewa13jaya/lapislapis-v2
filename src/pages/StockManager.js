import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, today, fmtDate, S, DEFECT_REASONS, RETUR_REASONS } from '../utils';
import { Btn, FieldGroup } from '../components/UI';

const logActivity = async (user, action, description) => {
  await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action, description });
};

export default function StockManager({ products, outlets, stockIn, stockOut, returns, currentStock, onRefresh, showToast }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('in');
  const [saving, setSaving] = useState(false);
  const [summaryKat, setSummaryKat] = useState('all');
  const [summarySearch, setSummarySearch] = useState('');
  const [onlyHasStock, setOnlyHasStock] = useState(true);

  // ── Cart system (shared, resets when tab changes) ──────────────────────────
  const [cart, setCart] = useState([]);

  // ── Shared "header" fields per session (apply to all cart items) ───────────
  const [sharedDate,     setSharedDate]     = useState(today());
  const [sharedBatch,    setSharedBatch]    = useState('');
  const [sharedExpired,  setSharedExpired]  = useState('');
  const [sharedOutType,  setSharedOutType]  = useState('manual_defect');
  const [sharedOutletId, setSharedOutletId] = useState('');

  // ── Per-item form fields ───────────────────────────────────────────────────
  const [formKat,      setFormKat]      = useState('');
  const [formVariant,  setFormVariant]  = useState('');
  const [formProductId,setFormProductId]= useState('');
  const [formQty,      setFormQty]      = useState('');
  const [formReason,   setFormReason]   = useState('');
  const [formNotes,    setFormNotes]    = useState('');
  const [returKondisi, setReturKondisi] = useState('');
  const [returAction,  setReturAction]  = useState('');
  const [convertTargetId, setConvertTargetId] = useState('');
  const [convertQty,      setConvertQty]      = useState('');

  // ── Konversi Stok (single operation, separate state) ──────────────────────
  const [konvKat,       setKonvKat]       = useState('');
  const [konvVariant,   setKonvVariant]   = useState('');
  const [konvSrcId,     setKonvSrcId]     = useState('');
  const [konvQty,       setKonvQty]       = useState('');
  const [konvTargetId,  setKonvTargetId]  = useState('');
  const [konvManualQty, setKonvManualQty] = useState('');
  const [konvDate,      setKonvDate]      = useState(today());
  const [konvNotes,     setKonvNotes]     = useState('');

  const canEdit = ['admin','produksi','kepala_produksi'].includes(user?.role);

  const SIZE_ORDER = ['Slice','Quarter','Half','Round','Square','Loyang'];
  // Standard: "Nama Produk Ukuran" (tanpa dash). Dash juga tetap dibaca untuk backward compat.
  // Contoh: "Lapis Surabaya Pandan Half", "Lapis Legit Original Slice"
  const SIZES_RE = /\s*[-–]?\s*(Slice|Quarter|Half|Round|Square|Loyang)\s*$/i;
  const getSizeName = name => { const m = name.match(SIZES_RE); return m ? m[1] : ''; };
  const getVariant  = name => name.replace(SIZES_RE, '').trim();
  const variantsFor = kat => [...new Set(products.filter(p => !kat || p.kategori === kat).map(p => getVariant(p.name)))].sort();
  const sizesFor    = variant => products.filter(p => getVariant(p.name) === variant).sort((a,b) => {
    const ai = SIZE_ORDER.findIndex(s => getSizeName(a.name).toLowerCase() === s.toLowerCase());
    const bi = SIZE_ORDER.findIndex(s => getSizeName(b.name).toLowerCase() === s.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // SMART: detect auto-ratio targets by name convention
  // Returns [] if no match — caller falls back to MANUAL mode
  const getConversionTargets = (product) => {
    if (!product) return [];
    const size = getSizeName(product.name);
    const variant = getVariant(product.name);
    const kat = product.kategori;
    // 1) Same-variant match (exact)
    const sameVariant = products.filter(p => getVariant(p.name) === variant && p.id !== product.id);
    // 2) Same-kategori fallback (different variant — e.g. Loyang Pandan → Half Mocca but same line)
    const sameKat = products.filter(p => p.kategori === kat && p.id !== product.id);
    const findSize = s => {
      const exact = sameVariant.find(p => getSizeName(p.name).toLowerCase() === s.toLowerCase());
      if (exact) return exact;
      // Fallback: same kategori, same size keyword, share a common word in name
      const varWords = variant.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return sameKat.find(p =>
        getSizeName(p.name).toLowerCase() === s.toLowerCase() &&
        varWords.some(w => p.name.toLowerCase().includes(w))
      );
    };
    const targets = [];
    if (kat === 'Lapis Legit') {
      if (size === 'Half') {
        const qtr = findSize('Quarter'); if (qtr) targets.push({ product: qtr, label:'Quarter', ratio:2,    isAuto:true  });
        const slc = findSize('Slice');   if (slc) targets.push({ product: slc, label:'Slice',   ratio:null, isAuto:false });
      } else if (size === 'Quarter') {
        const slc = findSize('Slice');   if (slc) targets.push({ product: slc, label:'Slice',   ratio:null, isAuto:false });
      }
    } else if (kat === 'Lapis Surabaya') {
      if (size === 'Loyang' || size === '') {
        const half = findSize('Half');  if (half) targets.push({ product: half, label:'Half',  ratio:2,    isAuto:true  });
        const slc  = findSize('Slice'); if (slc)  targets.push({ product: slc,  label:'Slice', ratio:null, isAuto:false });
      } else if (size === 'Half') {
        const slc = findSize('Slice');  if (slc) targets.push({ product: slc,  label:'Slice',  ratio:null, isAuto:false });
      }
    }
    return targets;
  };

  const KAT_LIST = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
  const tabColor  = { in:'#10b981', out:'#ef4444', retur:'#B49A35', konversi:'#8b5cf6' };
  const tabLabel  = { in:'Stok Masuk', out:'Keluar/Defect', retur:'Retur dari Outlet', konversi:'✂️ Konversi Stok' };

  const resetItemForm = () => {
    setFormKat(''); setFormVariant(''); setFormProductId(''); setFormQty(''); setFormReason(''); setFormNotes('');
    setReturKondisi(''); setReturAction(''); setConvertTargetId(''); setConvertQty('');
  };

  const switchTab = (t) => {
    setActiveTab(t);
    setCart([]);
    resetItemForm();
  };

  // ── Add item to cart ───────────────────────────────────────────────────────
  const addToCart = () => {
    if (!formProductId || !formQty || Number(formQty) <= 0) return showToast('❌ Pilih produk & masukkan qty');
    if (activeTab === 'in'    && !sharedBatch)  return showToast('❌ Kode batch wajib diisi');
    if (activeTab === 'out'   && !formReason)   return showToast('❌ Alasan wajib diisi');
    if (activeTab === 'out'   && Number(formQty) > (currentStock[formProductId]||0))
      return showToast('❌ Stok tidak cukup');
    if (activeTab === 'retur' && !returKondisi) return showToast('❌ Pilih kondisi barang');
    if (activeTab === 'retur' && returKondisi === 'repakai' && !returAction) return showToast('❌ Pilih tindakan');
    if (activeTab === 'retur' && returAction === 'convert' && !convertTargetId) return showToast('❌ Pilih ukuran tujuan konversi');
    if (activeTab === 'retur' && !formReason)   return showToast('❌ Alasan retur wajib diisi');

    const p = products.find(x => x.id === formProductId);
    const targetProd = products.find(x => x.id === convertTargetId);
    const srcProd = p;
    const convTargets = getConversionTargets(srcProd);
    const targetInfo = convTargets.find(t => t.product.id === convertTargetId);
    const finalConvQty = targetInfo?.isAuto ? Number(formQty) * targetInfo.ratio : Number(convertQty);

    if (activeTab === 'retur' && returAction === 'convert' && (!finalConvQty || finalConvQty <= 0))
      return showToast('❌ Qty konversi tidak valid');

    const cartItem = {
      _id: uid(),
      product_id: formProductId,
      product_name: p?.name || '-',
      unit: p?.unit || '',
      qty: Number(formQty),
      reason: formReason,
      notes: formNotes,
      // retur-specific
      returKondisi,
      returAction,
      convertTargetId,
      convertTargetName: targetProd?.name || '',
      convertTargetUnit: targetProd?.unit || '',
      convertQtyFinal: finalConvQty || 0,
      convertIsAuto: targetInfo?.isAuto || false,
    };

    setCart(c => [...c, cartItem]);
    // Reset only product/qty/item-specific fields; keep date, batch, outlet
    setFormVariant(''); setFormProductId(''); setFormQty(''); setFormReason(''); setFormNotes('');
    setReturKondisi(''); setReturAction(''); setConvertTargetId(''); setConvertQty('');
    showToast(`✅ ${p?.name} ×${formQty} ditambahkan ke daftar`);
  };

  // ── Submit entire cart ─────────────────────────────────────────────────────
  const handleSubmitAll = async () => {
    if (cart.length === 0) return showToast('❌ Daftar kosong');
    setSaving(true);
    let errorCount = 0;

    for (const item of cart) {
      let error;
      if (activeTab === 'in') {
        ({ error } = await supabase.from('stock_in').insert({ id: uid(), product_id: item.product_id, qty: item.qty, notes: item.notes, date: sharedDate, batch_code: sharedBatch, expired_date: sharedExpired || null, created_by: user.id, created_by_name: user.name }));
        if (!error) {
          await supabase.from('batches').insert({ id: uid(), batch_code: sharedBatch, product_id: item.product_id, qty_initial: item.qty, expired_date: sharedExpired || null, notes: item.notes, created_by: user.id, created_by_name: user.name });
          await logActivity(user, 'stok_masuk', `Stok masuk ${item.qty} ${item.unit} ${item.product_name} — Batch: ${sharedBatch}`);
        }
      } else if (activeTab === 'out') {
        ({ error } = await supabase.from('stock_out').insert({ id: uid(), product_id: item.product_id, qty: item.qty, notes: item.notes, date: sharedDate, reason: item.reason, out_type: sharedOutType, created_by: user.id, created_by_name: user.name }));
        if (!error) await logActivity(user, 'stok_keluar', `Stok keluar ${item.qty} ${item.unit} ${item.product_name} — ${item.reason}`);
      } else if (activeTab === 'retur') {
        const outletName = outlets.find(o => o.id === sharedOutletId)?.name || 'outlet';
        if (item.returKondisi === 'rusak') {
          ({ error } = await supabase.from('returns').insert({ id: uid(), product_id: item.product_id, qty: item.qty, notes: item.notes, date: sharedDate, outlet_id: sharedOutletId || null, reason: item.reason, return_type: 'expired_rusak', created_by: user.id, created_by_name: user.name }));
          if (!error) await logActivity(user, 'retur', `Retur EXPIRED/RUSAK ${item.qty} ${item.unit} ${item.product_name} dari ${outletName}`);
        } else if (item.returKondisi === 'repakai' && item.returAction === 'same') {
          ({ error } = await supabase.from('returns').insert({ id: uid(), product_id: item.product_id, qty: item.qty, notes: item.notes, date: sharedDate, outlet_id: sharedOutletId || null, reason: item.reason, return_type: 'retur_outlet', created_by: user.id, created_by_name: user.name }));
          if (!error) await logActivity(user, 'retur', `Retur ${item.qty} ${item.unit} ${item.product_name} dari ${outletName} — masuk stok kembali`);
        } else if (item.returKondisi === 'repakai' && item.returAction === 'convert') {
          ({ error } = await supabase.from('returns').insert({ id: uid(), product_id: item.product_id, qty: item.qty, notes: `Dikonversi → ${item.convertTargetName} (${item.convertQtyFinal} ${item.convertTargetUnit}). ${item.notes}`.trim(), date: sharedDate, outlet_id: sharedOutletId || null, reason: item.reason, return_type: 'konversi', created_by: user.id, created_by_name: user.name }));
          if (!error) {
            ({ error } = await supabase.from('stock_in').insert({ id: uid(), product_id: item.convertTargetId, qty: item.convertQtyFinal, notes: `Hasil konversi retur dari ${outletName} (${item.product_name} × ${item.qty})`, date: sharedDate, batch_code: 'KONVERSI-' + sharedDate.replace(/-/g,''), created_by: user.id, created_by_name: user.name }));
            if (!error) await logActivity(user, 'retur_konversi', `Retur ${item.qty} ${item.unit} ${item.product_name} dari ${outletName} → dikonversi ke ${item.convertQtyFinal} ${item.convertTargetUnit} ${item.convertTargetName}`);
          }
        }
      }
      if (error) errorCount++;
    }

    setSaving(false);
    if (errorCount > 0) showToast(`⚠️ ${errorCount} item gagal disimpan`);
    else showToast(`✅ ${cart.length} item berhasil disimpan!`);
    setCart([]);
    resetItemForm();
    onRefresh();
  };

  // ── Konversi Stok (unchanged) ──────────────────────────────────────────────
  const handleKonversi = async () => {
    if (!konvSrcId || !konvQty || Number(konvQty) <= 0) return showToast('❌ Pilih produk asal & masukkan qty');
    if (!konvTargetId) return showToast('❌ Pilih ukuran tujuan konversi');
    const srcProduct  = products.find(p => p.id === konvSrcId);
    const convTargets = getConversionTargets(srcProduct);
    const targetInfo  = convTargets.find(t => t.product.id === konvTargetId);
    const finalQty    = targetInfo?.isAuto ? Number(konvQty) * targetInfo.ratio : Number(konvManualQty);
    if (!finalQty || finalQty <= 0) return showToast('❌ Qty hasil konversi tidak valid');
    if (Number(konvQty) > (currentStock[konvSrcId]||0)) return showToast(`❌ Stok tidak cukup (tersedia: ${currentStock[konvSrcId]||0} ${srcProduct?.unit})`);
    setSaving(true);
    const targetProduct = products.find(p => p.id === konvTargetId);
    const { error: e1 } = await supabase.from('stock_out').insert({ id: uid(), product_id: konvSrcId, qty: Number(konvQty), notes: `Dikonversi → ${targetProduct?.name} (${finalQty} ${targetProduct?.unit}). ${konvNotes}`.trim(), date: konvDate, reason: `Konversi ke ${targetProduct?.name}`, out_type: 'konversi', created_by: user.id, created_by_name: user.name });
    if (e1) { setSaving(false); return showToast('❌ ' + e1.message); }
    const { error: e2 } = await supabase.from('stock_in').insert({ id: uid(), product_id: konvTargetId, qty: finalQty, notes: `Hasil konversi dari ${srcProduct?.name} × ${konvQty}. ${konvNotes}`.trim(), date: konvDate, batch_code: 'KONVERSI-' + konvDate.replace(/-/g,''), created_by: user.id, created_by_name: user.name });
    if (e2) { setSaving(false); return showToast('❌ ' + e2.message); }
    await logActivity(user, 'konversi_stok', `Konversi ${konvQty} ${srcProduct?.unit} ${srcProduct?.name} → ${finalQty} ${targetProduct?.unit} ${targetProduct?.name}`);
    showToast(`✅ ${konvQty} ${srcProduct?.unit} ${srcProduct?.name} → ${finalQty} ${targetProduct?.unit} ${targetProduct?.name}`);
    setSaving(false);
    setKonvKat(''); setKonvVariant(''); setKonvSrcId(''); setKonvQty(''); setKonvTargetId(''); setKonvManualQty(''); setKonvNotes(''); setKonvDate(today());
    onRefresh();
  };

  const activeData = activeTab === 'in' ? stockIn
    : activeTab === 'out' ? stockOut.filter(x => x.out_type !== 'konversi')
    : activeTab === 'konversi' ? stockOut.filter(x => x.out_type === 'konversi')
    : returns;

  // Stock summary
  const stockSummary = products.map(p => {
    const totalIn    = stockIn.filter(x => x.product_id === p.id).reduce((s,x) => s+Number(x.qty), 0);
    const totalOut   = stockOut.filter(x => x.product_id === p.id).reduce((s,x) => s+Number(x.qty), 0);
    const totalRetur = returns.filter(x => x.product_id === p.id).reduce((s,x) => s+Number(x.qty), 0);
    return { ...p, totalIn, totalOut, totalRetur, saldo: currentStock[p.id] || 0 };
  });

  // Product selector helpers for item form
  const formProduct = products.find(p => p.id === formProductId);
  const convTargetsForForm = getConversionTargets(formProduct);
  const selConvTarget = convTargetsForForm.find(t => t.product.id === convertTargetId);
  const autoConvQty = selConvTarget?.isAuto && formQty ? Number(formQty) * selConvTarget.ratio : null;

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1C1208' }}>Manajemen Stok</h2>

      {/* ── Stock Summary ─────────────────────────────────────────────────── */}
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>📊 Ringkasan Stok</h3>
          <label style={{ fontSize:12, color:'#64748b', display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <input type="checkbox" checked={onlyHasStock} onChange={e => setOnlyHasStock(e.target.checked)} />
            Tampilkan yang ada stok saja
          </label>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
          {['all', ...KAT_LIST].map(k => {
            const count = k === 'all' ? stockSummary.length : stockSummary.filter(p => p.kategori === k).length;
            return <button key={k} onClick={() => setSummaryKat(k)} style={{ padding:'5px 12px', fontSize:11, fontWeight:600, border:'none', borderRadius:20, cursor:'pointer', background: summaryKat===k ? '#1C1208' : '#e2e8f0', color: summaryKat===k ? '#fff' : '#64748b' }}>{k === 'all' ? 'Semua' : k} ({count})</button>;
          })}
          <input value={summarySearch} onChange={e => setSummarySearch(e.target.value)} placeholder="🔍 Cari produk..." style={{ padding:'5px 12px', borderRadius:20, border:'1px solid #e2e8f0', fontSize:12, marginLeft:'auto', minWidth:160 }} />
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#f8f7f4' }}>
              {['Produk','Masuk','Retur','Keluar','→ Outlet','SALDO','Min'].map((h,i) => (
                <th key={i} style={{ padding:'8px 10px', textAlign: i > 0 ? 'right' : 'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(() => {
                const filtered = stockSummary
                  .filter(p => summaryKat === 'all' || p.kategori === summaryKat)
                  .filter(p => !summarySearch || p.name.toLowerCase().includes(summarySearch.toLowerCase()))
                  .filter(p => !onlyHasStock || p.saldo > 0 || p.totalIn > 0);
                if (filtered.length === 0) return <tr><td colSpan={7} style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>Tidak ada data</td></tr>;
                const groups = {}; filtered.forEach(p => { const k = p.kategori||'Lainnya'; if (!groups[k]) groups[k]=[]; groups[k].push(p); });
                const KAT_COLOR = { 'Lapis Legit':'#FBF5DF','Lapis Surabaya':'#dbeafe','Cookies':'#fce7f3','Gift Box':'#d1fae5' };
                const rows = [];
                Object.entries(groups).forEach(([kat, items]) => {
                  if (summaryKat === 'all') rows.push(<tr key={'hdr-'+kat}><td colSpan={7} style={{ padding:'6px 10px', background: KAT_COLOR[kat]||'#f1f5f9', fontSize:12, fontWeight:700, color:'#374151' }}>🏷 {kat} — {items.length} produk</td></tr>);
                  items.forEach(p => {
                    const orderOut = p.totalIn + p.totalRetur - p.saldo - p.totalOut;
                    const isLow = p.saldo > 0 && p.saldo <= (p.stok_minimum||5);
                    const isEmpty = p.saldo <= 0;
                    rows.push(
                      <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9', background: isEmpty && p.totalIn > 0 ? '#fff5f5' : isLow ? '#fffbeb' : '' }}>
                        <td style={{ padding:'8px 10px', fontWeight:600, fontSize:12 }}>{p.name}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#10b981', fontWeight:600 }}>+{p.totalIn}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#B49A35', fontWeight:600 }}>+{p.totalRetur}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#ef4444', fontWeight:600 }}>-{p.totalOut}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#8b5cf6', fontWeight:600 }}>-{Math.max(0,orderOut)}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:800, fontSize:14, color: isEmpty && p.totalIn>0 ? '#ef4444' : isLow ? '#B49A35' : '#1C1208' }}>{p.saldo}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', fontSize:11, color:'#94a3b8' }}>{p.stok_minimum||5}</td>
                      </tr>
                    );
                  });
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:20 }}>

        {/* ── INPUT FORM ────────────────────────────────────────────────────── */}
        {canEdit && (
          <div>
            {/* Tab buttons */}
            <div style={{ display:'flex', gap:4, marginBottom:16, flexWrap:'wrap' }}>
              {['in','out','retur','konversi'].map(t => (
                <button key={t} onClick={() => switchTab(t)} style={{ flex:1, padding:'9px 4px', fontSize:10, fontWeight:700, background: activeTab===t ? tabColor[t] : '#f1f5f9', color: activeTab===t ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer', minWidth:60 }}>{tabLabel[t]}</button>
              ))}
            </div>

            <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>

              {/* ── KONVERSI STOK (single op, no cart) ── */}
              {activeTab === 'konversi' && (() => {
                const srcProd    = products.find(p => p.id === konvSrcId);
                const convTargets = getConversionTargets(srcProd);
                const selTarget  = convTargets.find(t => t.product.id === konvTargetId);
                const autoQty    = selTarget?.isAuto && konvQty ? Number(konvQty) * selTarget.ratio : null;
                const stokAsal   = currentStock[konvSrcId] || 0;
                const kurang     = konvQty && Number(konvQty) > stokAsal;
                return (
                  <>
                    <FieldGroup label="Tanggal">
                      <input type="date" value={konvDate} onChange={e => setKonvDate(e.target.value)} style={S.input} />
                    </FieldGroup>
                    <div style={{ marginTop:12, fontSize:12, fontWeight:700, color:'#6d28d9', marginBottom:8 }}>✂️ Produk Asal (yang dipotong)</div>
                    <FieldGroup label="Kategori">
                      <select value={konvKat} onChange={e => { setKonvKat(e.target.value); setKonvVariant(''); setKonvSrcId(''); setKonvTargetId(''); setKonvManualQty(''); }} style={S.input}>
                        <option value=''>-- Semua Kategori --</option>
                        {KAT_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </FieldGroup>
                    <div style={{ marginTop:10 }}>
                      <FieldGroup label="Varian">
                        <select value={konvVariant} onChange={e => { setKonvVariant(e.target.value); setKonvSrcId(''); setKonvTargetId(''); setKonvManualQty(''); }} style={S.input}>
                          <option value=''>-- Pilih Varian --</option>
                          {variantsFor(konvKat).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </FieldGroup>
                    </div>
                    {konvVariant && (
                      <div style={{ marginTop:10 }}>
                        <FieldGroup label="Ukuran Asal">
                          <select value={konvSrcId} onChange={e => { setKonvSrcId(e.target.value); setKonvTargetId(''); setKonvManualQty(''); }} style={S.input}>
                            <option value=''>-- Pilih Ukuran --</option>
                            {sizesFor(konvVariant).map(p => {
                              const sizeLbl = getSizeName(p.name) || 'Standard';
                              return <option key={p.id} value={p.id}>{sizeLbl} — Stok: {currentStock[p.id]||0} {p.unit}</option>;
                            })}
                          </select>
                        </FieldGroup>
                      </div>
                    )}
                    {konvSrcId && (
                      <div style={{ marginTop:10 }}>
                        <FieldGroup label="Qty yang Dikonversi">
                          <input type="number" min="1" max={stokAsal} value={konvQty} onChange={e => { setKonvQty(e.target.value); setKonvManualQty(''); }} style={{ ...S.input, borderColor: kurang ? '#ef4444' : undefined }} placeholder="0" />
                          {kurang && <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>⚠️ Stok tersedia hanya {stokAsal} {srcProd?.unit}</div>}
                          {!kurang && konvQty && <div style={{ fontSize:11, color:'#10b981', marginTop:4 }}>✓ Sisa: {stokAsal-Number(konvQty)} {srcProd?.unit}</div>}
                        </FieldGroup>
                      </div>
                    )}

                    {/* ── Smart mode: auto-detected targets ── */}
                    {konvSrcId && convTargets.length > 0 && (
                      <div style={{ marginTop:14, padding:12, background:'#f5f3ff', borderRadius:10, border:'1px solid #ddd6fe' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#6d28d9', marginBottom:10 }}>✂️ Konversi ke Ukuran</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          {convTargets.map(t => {
                            const previewQty = t.isAuto && konvQty ? Number(konvQty)*t.ratio : null;
                            const isSel = konvTargetId === t.product.id;
                            return (
                              <button key={t.product.id} onClick={() => { setKonvTargetId(t.product.id); setKonvManualQty(''); }}
                                style={{ flex:1, padding:'10px 8px', borderRadius:10, border:`2px solid ${isSel?'#8b5cf6':'#e2e8f0'}`, cursor:'pointer', textAlign:'center', fontSize:12, fontWeight:700, background: isSel?'#ede9fe':'#fff', color: isSel?'#6d28d9':'#64748b' }}>
                                <div>{t.label}</div>
                                <div style={{ fontSize:10, fontWeight:400, marginTop:2, color:'#94a3b8' }}>{t.product.name}</div>
                                {t.isAuto && previewQty && <div style={{ fontSize:11, fontWeight:700, marginTop:2, color:'#6d28d9' }}>= {previewQty} {t.product.unit}</div>}
                                {!t.isAuto && <div style={{ fontSize:10, fontWeight:400, marginTop:2 }}>qty manual</div>}
                              </button>
                            );
                          })}
                        </div>
                        {konvTargetId && selTarget && (
                          <div style={{ marginTop:12 }}>
                            {selTarget.isAuto && autoQty
                              ? <div style={{ padding:'10px 12px', background:'#dbeafe', borderRadius:8, fontSize:13, color:'#1e40af', fontWeight:700 }}>📐 {konvQty} {srcProd?.unit} {srcProd?.name} → {autoQty} {selTarget.product.unit} {selTarget.product.name}</div>
                              : <FieldGroup label={`Qty Hasil (${selTarget.product.name})`}><input type="number" min="1" value={konvManualQty} onChange={e => setKonvManualQty(e.target.value)} style={S.input} placeholder={`Berapa ${selTarget.product.unit}?`} /></FieldGroup>
                            }
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Manual mode: no auto-target detected ── */}
                    {konvSrcId && convTargets.length === 0 && (
                      <div style={{ marginTop:14, padding:12, background:'#f8f7f4', borderRadius:10, border:'1px solid #e2e8f0' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:4 }}>✂️ Pilih Produk Hasil Konversi</div>
                        <div style={{ fontSize:11, color:'#94a3b8', marginBottom:10 }}>Pilih manual karena nama produk tidak mengikuti format otomatis</div>
                        <FieldGroup label="Produk Tujuan">
                          <select value={konvTargetId} onChange={e => { setKonvTargetId(e.target.value); setKonvManualQty(''); }} style={S.input}>
                            <option value=''>-- Pilih Produk --</option>
                            {products.filter(p => p.id !== konvSrcId && p.kategori === srcProd?.kategori)
                              .sort((a,b) => a.name.localeCompare(b.name))
                              .map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {currentStock[p.id]||0} {p.unit})</option>)
                            }
                          </select>
                        </FieldGroup>
                        {konvTargetId && (
                          <div style={{ marginTop:10 }}>
                            <FieldGroup label={`Qty Hasil (${products.find(p=>p.id===konvTargetId)?.unit||'unit'})`}>
                              <input type="number" min="1" value={konvManualQty} onChange={e => setKonvManualQty(e.target.value)} style={S.input} placeholder="Masukkan jumlah hasil konversi" />
                            </FieldGroup>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop:12 }}>
                      <FieldGroup label="Catatan (opsional)"><input value={konvNotes} onChange={e => setKonvNotes(e.target.value)} style={S.input} placeholder="Opsional..." /></FieldGroup>
                    </div>
                    <Btn onClick={handleKonversi} disabled={saving || !konvSrcId || !konvQty || !konvTargetId || kurang} color="#8b5cf6" style={{ marginTop:16, width:'100%' }}>
                      {saving ? 'Menyimpan...' : '✂️ Konversi Stok'}
                    </Btn>
                  </>
                );
              })()}

              {/* ── SHARED HEADER FIELDS (In / Out / Retur) ── */}
              {activeTab !== 'konversi' && (
                <>
                  {/* Shared date */}
                  <div style={{ padding:'12px 14px', background:'#f8f7f4', borderRadius:10, marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8 }}>⚙️ BERLAKU UNTUK SEMUA ITEM DI DAFTAR</div>
                    <div style={{ display:'grid', gap:10 }}>
                      <FieldGroup label="Tanggal">
                        <input type="date" value={sharedDate} onChange={e => setSharedDate(e.target.value)} style={S.input} />
                      </FieldGroup>
                      {activeTab === 'in' && <>
                        <FieldGroup label="Kode Batch *">
                          <input value={sharedBatch} onChange={e => setSharedBatch(e.target.value)} style={S.input} placeholder="Contoh: LP-001, PANDAN-18JUNI" />
                        </FieldGroup>
                        <FieldGroup label="Tanggal Expired (opsional)">
                          <input type="date" value={sharedExpired} onChange={e => setSharedExpired(e.target.value)} style={S.input} />
                        </FieldGroup>
                      </>}
                      {activeTab === 'out' && (
                        <FieldGroup label="Jenis Keluar">
                          <select value={sharedOutType} onChange={e => setSharedOutType(e.target.value)} style={S.input}>
                            <option value="manual_defect">Rusak/Defect di Gudang</option>
                            <option value="sample">Sample/Tester</option>
                            <option value="other">Lainnya</option>
                          </select>
                        </FieldGroup>
                      )}
                      {activeTab === 'retur' && (
                        <FieldGroup label="Dari Outlet">
                          <select value={sharedOutletId} onChange={e => setSharedOutletId(e.target.value)} style={S.input}>
                            <option value=''>-- Pilih Outlet --</option>
                            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </FieldGroup>
                      )}
                    </div>
                  </div>

                  {/* ── PER-ITEM FIELDS ── */}
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8 }}>➕ TAMBAH ITEM KE DAFTAR</div>

                  {/* Product selector */}
                  <FieldGroup label="Kategori Produk">
                    <select value={formKat} onChange={e => { setFormKat(e.target.value); setFormVariant(''); setFormProductId(''); }} style={S.input}>
                      <option value=''>-- Semua Kategori --</option>
                      {KAT_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </FieldGroup>
                  <div style={{ marginTop:8 }}>
                    <FieldGroup label="Varian">
                      <select value={formVariant} onChange={e => { setFormVariant(e.target.value); setFormProductId(''); }} style={S.input}>
                        <option value=''>-- Pilih Varian --</option>
                        {variantsFor(formKat).map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </FieldGroup>
                  </div>
                  {formVariant && (
                    <div style={{ marginTop:8 }}>
                      <FieldGroup label="Ukuran">
                        <select value={formProductId} onChange={e => { setFormProductId(e.target.value); setConvertTargetId(''); setConvertQty(''); }} style={S.input}>
                          <option value=''>-- Pilih Ukuran --</option>
                          {sizesFor(formVariant).map(p => {
                            const sizePart = p.name.replace(formVariant,'').replace(/^\s*-\s*/,'').trim()||'Standard';
                            return <option key={p.id} value={p.id}>{sizePart} (Stok: {currentStock[p.id]||0} {p.unit})</option>;
                          })}
                        </select>
                      </FieldGroup>
                    </div>
                  )}

                  {/* Qty */}
                  <div style={{ marginTop:8 }}>
                    <FieldGroup label="Jumlah">
                      <input type="number" min="1" value={formQty} onChange={e => setFormQty(e.target.value)} style={S.input} placeholder="0" />
                    </FieldGroup>
                  </div>

                  {/* Out: alasan */}
                  {activeTab === 'out' && (
                    <div style={{ marginTop:8 }}>
                      <FieldGroup label="Alasan *">
                        <select value={formReason} onChange={e => setFormReason(e.target.value)} style={S.input}>
                          <option value=''>-- Pilih alasan --</option>
                          {DEFECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </FieldGroup>
                    </div>
                  )}

                  {/* Retur: kondisi + tindakan + konversi */}
                  {activeTab === 'retur' && (
                    <>
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Kondisi Barang *</div>
                        <div style={{ display:'flex', gap:8 }}>
                          {[
                            { val:'rusak',   icon:'🔴', label:'Expired / Rusak',      sub:'Tidak bisa dipakai',    ac:'#ef4444', ab:'#fee2e2' },
                            { val:'repakai', icon:'🟢', label:'Bisa Dipakai Kembali', sub:'Kembali ke stok',       ac:'#10b981', ab:'#dcfce7' },
                          ].map(opt => (
                            <button key={opt.val} onClick={() => { setReturKondisi(opt.val); setReturAction(''); setConvertTargetId(''); setConvertQty(''); }}
                              style={{ flex:1, padding:'10px 8px', borderRadius:10, border:`2px solid ${returKondisi===opt.val?opt.ac:'#e2e8f0'}`, cursor:'pointer', textAlign:'center', fontSize:12, fontWeight:700, background: returKondisi===opt.val?opt.ab:'#fff', color: returKondisi===opt.val?opt.ac:'#64748b' }}>
                              <div>{opt.icon} {opt.label}</div>
                              <div style={{ fontSize:10, fontWeight:400, marginTop:3, opacity:.8 }}>{opt.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      {returKondisi === 'repakai' && (
                        <div style={{ marginTop:10 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Tindakan *</div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={() => { setReturAction('same'); setConvertTargetId(''); setConvertQty(''); }}
                              style={{ flex:1, padding:'9px 8px', borderRadius:10, border:`2px solid ${returAction==='same'?'#3b82f6':'#e2e8f0'}`, cursor:'pointer', fontSize:12, fontWeight:700, background: returAction==='same'?'#eff6ff':'#fff', color: returAction==='same'?'#1d4ed8':'#64748b' }}>
                              📦 Simpan Ukuran Sama
                            </button>
                            {convTargetsForForm.length > 0 && (
                              <button onClick={() => setReturAction('convert')}
                                style={{ flex:1, padding:'9px 8px', borderRadius:10, border:`2px solid ${returAction==='convert'?'#8b5cf6':'#e2e8f0'}`, cursor:'pointer', fontSize:12, fontWeight:700, background: returAction==='convert'?'#f5f3ff':'#fff', color: returAction==='convert'?'#6d28d9':'#64748b' }}>
                                ✂️ Konversi Ukuran
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {returKondisi === 'repakai' && returAction === 'convert' && (
                        <div style={{ marginTop:10, padding:'14px', background:'#f5f3ff', borderRadius:10, border:'1px solid #ddd6fe' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#6d28d9', marginBottom:10 }}>✂️ Detail Konversi</div>
                          <FieldGroup label="Konversi ke Ukuran">
                            <select value={convertTargetId} onChange={e => { setConvertTargetId(e.target.value); setConvertQty(''); }} style={S.input}>
                              <option value=''>-- Pilih ukuran tujuan --</option>
                              {convTargetsForForm.map(t => <option key={t.product.id} value={t.product.id}>{t.label} {t.isAuto ? `(otomatis: ${formQty?Number(formQty)*t.ratio:'?'} ${t.product.unit})` : '(qty manual)'}</option>)}
                            </select>
                          </FieldGroup>
                          {convertTargetId && selConvTarget && (
                            <div style={{ marginTop:10 }}>
                              {selConvTarget.isAuto
                                ? <div style={{ padding:'10px 12px', background:'#dbeafe', borderRadius:8, fontSize:13, color:'#1e40af', fontWeight:600 }}>📐 {formQty||'?'} {formProduct?.unit} → {autoConvQty} {selConvTarget.product.unit} {selConvTarget.label}</div>
                                : <FieldGroup label={`Qty Hasil (${selConvTarget.label})`}><input type="number" min="1" value={convertQty} onChange={e => setConvertQty(e.target.value)} style={S.input} placeholder={`Jumlah ${selConvTarget.label}`} /></FieldGroup>
                              }
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ marginTop:10 }}>
                        <FieldGroup label="Alasan Retur *">
                          <select value={formReason} onChange={e => setFormReason(e.target.value)} style={S.input}>
                            <option value=''>-- Pilih alasan --</option>
                            {RETUR_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </FieldGroup>
                      </div>
                    </>
                  )}

                  {/* Notes */}
                  <div style={{ marginTop:8 }}>
                    <FieldGroup label="Catatan (opsional)">
                      <input value={formNotes} onChange={e => setFormNotes(e.target.value)} style={S.input} placeholder="Opsional..." />
                    </FieldGroup>
                  </div>

                  {/* Add to cart button */}
                  <Btn onClick={addToCart} color={tabColor[activeTab]} style={{ marginTop:12, width:'100%' }}>
                    + Tambah ke Daftar
                  </Btn>

                  {/* ── CART LIST ── */}
                  {cart.length > 0 && (
                    <div style={{ marginTop:16, padding:14, background:'#f0fdf4', borderRadius:10, border:'1px solid #86efac' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#166534', marginBottom:10 }}>
                        📋 Daftar ({cart.length} item) — Tgl: {sharedDate}
                        {activeTab === 'in' && sharedBatch && <span style={{ marginLeft:8, background:'#dbeafe', color:'#1e40af', padding:'1px 7px', borderRadius:6, fontSize:11 }}>Batch: {sharedBatch}</span>}
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead><tr style={{ borderBottom:'1px solid #86efac' }}>
                          <th style={{ textAlign:'left', padding:'4px 6px', color:'#64748b', fontWeight:700 }}>Produk</th>
                          <th style={{ textAlign:'center', padding:'4px 6px', color:'#64748b', fontWeight:700 }}>Qty</th>
                          <th style={{ textAlign:'left', padding:'4px 6px', color:'#64748b', fontWeight:700 }}>Info</th>
                          <th style={{ width:24 }}></th>
                        </tr></thead>
                        <tbody>
                          {cart.map((item, idx) => (
                            <tr key={item._id} style={{ borderBottom:'1px solid #bbf7d0' }}>
                              <td style={{ padding:'6px 6px', fontWeight:600 }}>{item.product_name}</td>
                              <td style={{ padding:'6px 6px', textAlign:'center', fontWeight:700, color: tabColor[activeTab] }}>{item.qty} {item.unit}</td>
                              <td style={{ padding:'6px 6px', fontSize:11, color:'#64748b' }}>
                                {activeTab === 'out' && item.reason}
                                {activeTab === 'retur' && (
                                  item.returKondisi === 'rusak' ? '🔴 Rusak/Expired'
                                  : item.returAction === 'convert' ? `✂️ → ${item.convertTargetName} ×${item.convertQtyFinal}`
                                  : '📦 Stok sama'
                                )}
                                {item.notes && <span style={{ marginLeft:4, color:'#94a3b8' }}>· {item.notes}</span>}
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <button onClick={() => setCart(c => c.filter((_,i) => i !== idx))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:14, padding:'2px 4px' }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Btn onClick={handleSubmitAll} disabled={saving} color="#10b981" style={{ marginTop:12, width:'100%', fontSize:13 }}>
                        {saving ? 'Menyimpan...' : `✅ Submit Semua (${cart.length} item)`}
                      </Btn>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ───────────────────────────────────────────────────────── */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display:'flex', gap:4, marginBottom:16, flexWrap:'wrap' }}>
            {['in','out','retur','konversi'].map(t => {
              const count = t==='in' ? stockIn.length : t==='out' ? stockOut.filter(x=>x.out_type!=='konversi').length : t==='retur' ? returns.length : stockOut.filter(x=>x.out_type==='konversi').length;
              return <button key={t} onClick={() => switchTab(t)} style={{ padding:'7px 12px', fontSize:10, fontWeight:700, background: activeTab===t?tabColor[t]:'#f1f5f9', color: activeTab===t?'#fff':'#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>{tabLabel[t]} ({count})</button>;
            })}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Tanggal</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Produk</th>
                {activeTab === 'in'  && <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Batch</th>}
                {activeTab !== 'in'  && <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Info</th>}
                <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Qty</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Oleh</th>
              </tr></thead>
              <tbody>
                {activeData.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Belum ada data</td></tr>
                  : activeData.map(x => {
                    const p = products.find(pp => pp.id === x.product_id);
                    return (
                      <tr key={x.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'10px 12px', fontSize:13 }}>{fmtDate(x.date)}</td>
                        <td style={{ padding:'10px 12px', fontSize:13 }}>{p?.name||'-'}</td>
                        {activeTab === 'in'
                          ? <td style={{ padding:'10px 12px', fontSize:12 }}><span style={{ background:'#dbeafe', color:'#1e40af', padding:'2px 8px', borderRadius:6, fontWeight:600 }}>{x.batch_code||'-'}</span></td>
                          : <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{x.reason||'-'}</td>
                        }
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color: tabColor[activeTab] }}>{x.qty} {p?.unit}</td>
                        <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{x.created_by_name||'-'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
