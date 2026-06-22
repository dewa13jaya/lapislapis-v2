import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, today, fmtDate, S, DEFECT_REASONS, RETUR_REASONS, useIsMobile } from '../utils';
import { Btn, FieldGroup } from '../components/UI';

const logActivity = async (user, action, description) => {
  await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action, description });
};

export default function StockManager({ products, outlets, stockIn, stockOut, returns, orders, currentStock, onRefresh, showToast }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [mainTab, setMainTab] = useState('input');
  const [activeTab, setActiveTab] = useState('in');
  const [saving, setSaving] = useState(false);
  const [summaryKat, setSummaryKat] = useState('all');
  const [summarySearch, setSummarySearch] = useState('');
  const [onlyHasStock, setOnlyHasStock] = useState(true);
  const [summaryFrom, setSummaryFrom] = useState(today());
  const [summaryTo,   setSummaryTo]   = useState(today());

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

  // ── Mass input (grid mode) ─────────────────────────────────────────────────
  const [massMode, setMassMode]   = useState(false);
  const [massQty,  setMassQty]    = useState({});  // { product_id: qty_string }
  const [massBatch,    setMassBatch]    = useState('');
  const [massDate,     setMassDate]     = useState(today());
  const [massExpired,  setMassExpired]  = useState('');

  // ── WA Import paste ────────────────────────────────────────────────────────
  const [waText,    setWaText]    = useState('');
  const [waPaste,   setWaPaste]   = useState(false);
  const [waResult,  setWaResult]  = useState(null); // { matched:[{pid,name,qty}], unmatched:[str] }

  const parseWaImport = () => {
    // Size columns in WA format order: (Slc/Qtr/Half/Rnd/Sqr)
    const WA_SIZES = ['Slice','Quarter','Half','Round','Square'];
    const newQty = { ...massQty };
    const matched = [];
    const unmatched = [];

    // Helper: normalize string for matching
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,'');

    // WA variant aliases → full variant fragment for product matching
    const ALIASES = {
      'ori':'original', 'spk':'spekulas', 'che':'cheese', 'alm':'almond',
      'choc':'choco', 'pandan':'pandan', 'prune':'prune',
      'greentea':'greentea', 'coffee':'coffee', 'mocca':'mocca',
      'cempedak':'cempedak', 'durian':'durian', 'fruit':'fruit',
      'sur':'surabaya', 'surrainbow':'surabaya rainbow', 'surainbow':'surabaya rainbow',
      'surchoc':'surabaya choco', 'surmix':'surabaya mix',
      'surmixchoc':'surabaya mix choco', 'surpanmix':'surabaya pandan mix',
      'surpandovo':'surabaya pandan ovo', 'surmocca':'surabaya mocca',
      'surpancheese':'surabaya pandan cheese',
    };

    const lines = waText.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      // Skip headers like *STOK AKHIR ...*, *STOK COOKIES*, etc.
      if (/^\*[^*]+\*$/.test(line)) return;
      if (/^\*(bikin|angetan|tempel|belum|retur)/i.test(line)) return;
      if (/^by\s*:/i.test(line)) return;

      // Format: * variant : (a/b/c/d/e)
      const m1 = line.match(/^\*?\s*(.+?)\s*:\s*\(([^)]+)\)/i);
      if (m1) {
        const rawVariant = m1[1].replace(/\*/g,'').trim();
        const parts = m1[2].split('/').map(s => s.trim());
        const vKey = norm(rawVariant);
        const resolved = ALIASES[vKey] || rawVariant.toLowerCase();

        let anyMatch = false;
        parts.forEach((val, idx) => {
          if (val === '-' || val === '' || Number(val) <= 0) return;
          const sz = WA_SIZES[idx];
          if (!sz) return;

          // Try to find product with this variant + size
          let p = null;
          // First: exact keyword search
          products.forEach(prod => {
            const pn = prod.name.toLowerCase();
            const resolvedParts = resolved.split(' ').filter(x=>x.length>1);
            const szMatch = pn.includes(sz.toLowerCase()) || (sz==='Square' && (pn.includes('loyang') || !WA_SIZES.some(s=>s!=='Square'&&pn.includes(s.toLowerCase()))));
            const varMatch = resolvedParts.every(part => pn.includes(part));
            if (szMatch && varMatch && !p) p = prod;
          });

          if (p) {
            newQty[p.id] = String(Number(val));
            if (!matched.find(x => x.pid === p.id)) matched.push({ pid:p.id, name:p.name, qty: Number(val) });
            else { const ex = matched.find(x=>x.pid===p.id); if(ex) ex.qty=Number(val); }
            anyMatch = true;
          } else {
            unmatched.push(`${rawVariant} ${sz} (${val})`);
          }
        });
        return;
      }

      // Format: Product name : qty (Cookies section)
      const m2 = line.match(/^(.+?)\s*:\s*(\d+)\s*$/);
      if (m2) {
        const rawName = m2[1].replace(/\*/g,'').trim();
        const qty = Number(m2[2]);
        if (qty <= 0) return;
        const rn = norm(rawName);
        // Find best matching product
        let best = null, bestScore = 0;
        products.forEach(p => {
          const pn = norm(p.name);
          let score = 0;
          if (pn === rn) score = 100;
          else if (pn.includes(rn) && rn.length > 2) score = rn.length;
          else if (rn.includes(pn) && pn.length > 2) score = pn.length;
          if (score > bestScore) { bestScore = score; best = p; }
        });
        if (best && bestScore > 2) {
          newQty[best.id] = String(qty);
          matched.push({ pid:best.id, name:best.name, qty });
        } else {
          unmatched.push(`${rawName} (${qty})`);
        }
      }
    });

    setMassQty(newQty);
    setWaResult({ matched, unmatched });
  };

  const handleMassSubmit = async () => {
    const entries = Object.entries(massQty).filter(([,v]) => Number(v) > 0);
    if (entries.length === 0) return showToast('❌ Belum ada qty yang diisi');
    if (!massBatch) return showToast('❌ Kode batch wajib diisi');
    setSaving(true);
    let errors = 0;
    for (const [pid, qty] of entries) {
      const { error } = await supabase.from('stock_in').insert({
        id: uid(), product_id: pid, qty: Number(qty), date: massDate,
        batch_code: massBatch, expired_date: massExpired || null,
        created_by: user.id, created_by_name: user.name,
      });
      if (!error) {
        await supabase.from('batches').insert({
          id: uid(), batch_code: massBatch, product_id: pid, qty_initial: Number(qty),
          expired_date: massExpired || null, created_by: user.id, created_by_name: user.name,
        });
        const p = products.find(x => x.id === pid);
        await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action:'stok_masuk', description:`Stok masuk ${qty} ${p?.unit} ${p?.name} — Batch: ${massBatch}` });
      } else { errors++; }
    }
    setSaving(false);
    if (errors > 0) showToast(`⚠️ ${errors} item gagal`);
    else showToast(`✅ ${entries.length} produk berhasil disimpan!`);
    setMassQty({});
    onRefresh();
  };

  // ── Variant sort order matching WA recap format ────────────────────────────
  // Order must match: ori, spk, che, alm, choc, Pandan, Prune, green tea, Coffee, Mocca,
  //   Cempedak, Durian, Fruit | Sur, Sur rainbow, Sur choc, Sur.mix, sur mix choc,
  //   Sur pan Mix, SurPand Ovo, Sur mocca, Sur Pan cheese
  // Cookies: Kastangel, Nastar m, Nastar prem L, Nastar prem M, Nastar durian,
  //   Queker, S.keju, L.kucing, Blue Che, Straw Che, Chocodark, Semprit, Hazelnute,
  //   Che ALM, Chocosoft, Kue kacang, Cookies legit, Coconut cookies, Snow ball
  const VARIANT_KEYWORDS = {
    'Lapis Legit': [
      'original','spekulaas','spekulas','cheese','almond',
      'choco','chocolate','pandan','prune','green','coffee','mocca','cempedak','durian','fruit',
    ],
    'Lapis Surabaya': [
      '_base_','rainbow',
      'choco','chocolate',          // Sur choc (no 'mix')
      'mix choco','mix choc',       // Sur mix choc — longer so wins over 'mix' alone
      'mix',                        // Sur.mix (plain mix)
      'pandan mix','pandan ovo','mocca','pandan cheese','pandan',
    ],
    'Cookies': [
      'kastangel',
      'nastar prem','nastar durian','nastar',  // prem/durian longer → win over plain 'nastar'
      'queker',
      'sagu keju','s.keju','s keju',
      'lidah kucing','l.kucing',
      'blue','straw',
      'chocodark','semprit','hazel',
      'che alm','cheese alm',
      'chocosoft','kue kacang',
      'cookies legit','cookie legit',
      'coconut','snow',
    ],
    'Gift Box': [],
  };

  // Best-match-length scoring: longer keyword wins over shorter (handles "nastar prem" > "nastar")
  const sortVariants = (variants, kat) => {
    const keys = VARIANT_KEYWORDS[kat];
    if (!keys || keys.length === 0) return [...variants].sort();
    const score = v => {
      const vn = v.toLowerCase();
      const base = kat.toLowerCase();
      if (keys.includes('_base_') && vn.replace(base,'').trim() === '') return keys.indexOf('_base_');
      let bestIdx = 999, bestLen = 0;
      keys.forEach((k, i) => {
        if (k === '_base_') return;
        if (vn.includes(k) && k.length > bestLen) { bestLen = k.length; bestIdx = i; }
      });
      return bestIdx;
    };
    return [...variants].sort((a, b) => score(a) - score(b));
  };

  // Sort products within a kategori group (for Ringkasan Stok rows)
  const sortProductsByVariant = (prods, kat) => {
    const variantOf = p => ['Lapis Legit','Lapis Surabaya'].includes(kat) ? getVariant(p.name) : p.name;
    const allVariants = [...new Set(prods.map(variantOf))];
    const sorted = sortVariants(allVariants, kat);
    return [...prods].sort((a, b) => {
      const ai = sorted.indexOf(variantOf(a));
      const bi = sorted.indexOf(variantOf(b));
      if (ai !== bi) return ai - bi;
      // Same variant → sort by size
      const szA = SIZE_ORDER.indexOf(getSizeName(a.name)||'');
      const szB = SIZE_ORDER.indexOf(getSizeName(b.name)||'');
      return szA - szB;
    });
  };

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

  // ── Konversi rules ────────────────────────────────────────────────────────
  // Square = setara Loyang (bisa dikonversi). Round = produk tersendiri (❌).
  // Konversi hanya boleh: RASA SAMA + UKURAN LEBIH KECIL.
  const SIZE_RANK = { '':100, 'Loyang':100, 'Square':100, 'Half':50, 'Quarter':25, 'Slice':10 };
  // Round tidak ada di SIZE_RANK → rank undefined → tidak bisa jadi source/target

  const canConvert = size => (SIZE_RANK[size] ?? 0) > 10; // Slice (10) = terkecil, tidak bisa

  const getConversionTargets = (product) => {
    if (!product) return [];
    const size = getSizeName(product.name);
    const variant = getVariant(product.name);
    const kat = product.kategori;

    // Round & Slice & unknown → tidak bisa dikonversi
    if (!canConvert(size)) return [];

    // Target: HARUS same-variant (rasa sama), ukuran lebih kecil
    const sameVariant = products.filter(p => getVariant(p.name) === variant && p.id !== product.id);
    const srcRank = SIZE_RANK[size] ?? 100;
    const find = s => sameVariant.find(p => getSizeName(p.name).toLowerCase() === s.toLowerCase());

    const targets = [];

    if (kat === 'Lapis Legit') {
      // Loyang / Square → Half ×2, Quarter ×4, Slice manual
      if (srcRank >= SIZE_RANK['Square']) {
        const half = find('Half');    if (half) targets.push({ product: half, label:'Half',    ratio:2,    isAuto:true  });
        const qtr  = find('Quarter'); if (qtr)  targets.push({ product: qtr,  label:'Quarter', ratio:4,    isAuto:true  });
        const slc  = find('Slice');   if (slc)  targets.push({ product: slc,  label:'Slice',   ratio:null, isAuto:false });
      }
      // Half → Quarter ×2, Slice manual
      else if (size === 'Half') {
        const qtr = find('Quarter'); if (qtr) targets.push({ product: qtr, label:'Quarter', ratio:2,    isAuto:true  });
        const slc = find('Slice');   if (slc) targets.push({ product: slc, label:'Slice',   ratio:null, isAuto:false });
      }
      // Quarter → Slice manual
      else if (size === 'Quarter') {
        const slc = find('Slice'); if (slc) targets.push({ product: slc, label:'Slice', ratio:null, isAuto:false });
      }
    }

    else if (kat === 'Lapis Surabaya') {
      // Loyang → Half ×2, Slice manual
      if (srcRank >= SIZE_RANK['Loyang']) {
        const half = find('Half');  if (half) targets.push({ product: half, label:'Half',  ratio:2,    isAuto:true  });
        const slc  = find('Slice'); if (slc)  targets.push({ product: slc,  label:'Slice', ratio:null, isAuto:false });
      }
      // Half → Slice manual
      else if (size === 'Half') {
        const slc = find('Slice'); if (slc) targets.push({ product: slc, label:'Slice', ratio:null, isAuto:false });
      }
    }

    // Fallback: nama tidak ikut konvensi tapi size rank valid →
    // tampilkan same-variant products dengan rank lebih kecil (manual, tanpa auto-ratio)
    if (targets.length === 0) {
      sameVariant
        .filter(p => {
          const ts = getSizeName(p.name);
          const tr = SIZE_RANK[ts] ?? 0;
          return tr > 0 && tr < srcRank;
        })
        .forEach(p => targets.push({ product: p, label: getSizeName(p.name)||p.name, ratio:null, isAuto:false }));
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

  // Stock summary — pergerakan difilter per periode, saldo tetap all-time
  const inRange = d => {
    const dt = (d||'').slice(0,10);
    return (!summaryFrom || dt >= summaryFrom) && (!summaryTo || dt <= summaryTo);
  };
  const stockSummary = products.map(p => {
    const totalIn    = stockIn.filter(x => x.product_id === p.id && inRange(x.date)).reduce((s,x) => s+Number(x.qty), 0);
    const totalOut   = stockOut.filter(x => x.product_id === p.id && x.out_type !== 'konversi' && inRange(x.date)).reduce((s,x) => s+Number(x.qty), 0);
    const totalRetur = returns.filter(x => x.product_id === p.id && !['expired_rusak','konversi'].includes(x.return_type) && inRange(x.date)).reduce((s,x) => s+Number(x.qty), 0);
    const orderOut   = orders.filter(o => ['delivered','partial_delivered'].includes(o.status) && inRange(o.actual_delivery_date || o.delivery_date))
      .flatMap(o => o.order_items||[]).filter(i => i.product_id === p.id)
      .reduce((s,i) => s+Number(i.qty_delivered??i.qty), 0);
    return { ...p, totalIn, totalOut, totalRetur, orderOut, saldo: currentStock[p.id] || 0 };
  });

  // Product selector helpers for item form
  const formProduct = products.find(p => p.id === formProductId);
  const convTargetsForForm = getConversionTargets(formProduct);
  const selConvTarget = convTargetsForForm.find(t => t.product.id === convertTargetId);
  const autoConvQty = selConvTarget?.isAuto && formQty ? Number(formQty) * selConvTarget.ratio : null;

  return (
    <div>
      {/* ── Main tab bar ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:8 }}>
        <h2 style={{ margin:0, fontWeight:800, color:'#1C1208' }}>Manajemen Stok</h2>
        <div style={{ display:'flex', gap:4 }}>
          {[
            { id:'input',    label: isMobile ? '📥 Input' : '📥 Input Stok' },
            { id:'ringkasan',label: isMobile ? '📊 Ringkasan' : '📊 Ringkasan Stok' },
            { id:'saldo',    label: isMobile ? '📋 Stok' : '📋 Stok by Rasa' },
          ].map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)} style={{
              padding: isMobile ? '8px 14px' : '9px 20px',
              fontSize: isMobile ? 12 : 13,
              fontWeight:700,
              background: mainTab===t.id ? '#1C1208' : '#e2e8f0',
              color: mainTab===t.id ? '#fff' : '#64748b',
              border:'none', borderRadius:8, cursor:'pointer'
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: RINGKASAN STOK
      ══════════════════════════════════════════════════════════════════ */}
      {mainTab === 'ringkasan' && (
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>📊 Ringkasan Stok</h3>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <label style={{ fontSize:12, color:'#64748b', display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
              <input type="checkbox" checked={onlyHasStock} onChange={e => setOnlyHasStock(e.target.checked)} />
              Ada stok saja
            </label>
            <button onClick={() => {
              const tgl = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
              const periodeLabel = summaryFrom && summaryTo
                ? (summaryFrom === summaryTo ? summaryFrom : `${summaryFrom} s/d ${summaryTo}`)
                : summaryFrom ? `>= ${summaryFrom}` : summaryTo ? `<= ${summaryTo}` : 'Semua waktu';

              // Build filtered data (same logic as table)
              const filtered = stockSummary
                .filter(p => summaryKat === 'all' || p.kategori === summaryKat)
                .filter(p => !summarySearch || p.name.toLowerCase().includes(summarySearch.toLowerCase()))
                .filter(p => !onlyHasStock || p.saldo > 0 || p.totalIn > 0);

              const groups = {};
              filtered.forEach(p => { const k = p.kategori||'Lainnya'; if (!groups[k]) groups[k]=[]; groups[k].push(p); });

              const lines = [];
              lines.push(`📦 *RINGKASAN STOK LAPISLAPIS*`);
              lines.push(`📅 ${tgl}`);
              lines.push(`📊 Periode: ${periodeLabel}`);
              lines.push('');

              const WA_KAT_ORDER = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
              const sortedWaKats = [...WA_KAT_ORDER.filter(k => groups[k]), ...Object.keys(groups).filter(k => !WA_KAT_ORDER.includes(k)).sort()];
              sortedWaKats.forEach(kat => {
                const items = sortProductsByVariant(groups[kat], kat);
                lines.push(`*── ${kat.toUpperCase()} ──*`);
                items.forEach(p => {
                  const status = p.saldo <= 0 ? '🔴' : p.saldo <= (p.stok_minimum||5) ? '🟡' : '🟢';
                  lines.push(`${status} ${p.name}: *${p.saldo} ${p.unit}*`);
                });
                lines.push('');
              });

              const habis = filtered.filter(p => p.saldo <= 0);
              const hampir = filtered.filter(p => p.saldo > 0 && p.saldo <= (p.stok_minimum||5));
              if (habis.length > 0) lines.push(`🔴 Stok Habis: ${habis.length} produk`);
              if (hampir.length > 0) lines.push(`🟡 Hampir Habis: ${hampir.length} produk`);
              lines.push('');
              lines.push(`_Dikirim dari LAPISLAPIS System_`);

              window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
            }} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#25D366', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Kirim WA
            </button>
          </div>
        </div>

        {/* Filter periode */}
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>PERIODE PERGERAKAN:</span>
          {[
            { label:'Hari Ini', from: today(), to: today() },
            { label:'Minggu Ini', from: (() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10); })(), to: today() },
            { label:'Bulan Ini', from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), to: today() },
            { label:'Semua', from: '', to: '' },
          ].map(opt => {
            const isActive = summaryFrom === opt.from && summaryTo === opt.to;
            return <button key={opt.label} onClick={() => { setSummaryFrom(opt.from); setSummaryTo(opt.to); }} style={{ padding:'4px 10px', fontSize:11, fontWeight:600, border:'none', borderRadius:20, cursor:'pointer', background: isActive ? '#1C1208' : '#e2e8f0', color: isActive ? '#fff' : '#64748b' }}>{opt.label}</button>;
          })}
          <input type="date" value={summaryFrom} onChange={e => setSummaryFrom(e.target.value)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12 }} />
          <span style={{ fontSize:11, color:'#94a3b8' }}>s/d</span>
          <input type="date" value={summaryTo} onChange={e => setSummaryTo(e.target.value)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12 }} />
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
                const KAT_SORT_ORDER = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
                const rows = [];
                const sortedGroupKats = [
                  ...KAT_SORT_ORDER.filter(k => groups[k]),
                  ...Object.keys(groups).filter(k => !KAT_SORT_ORDER.includes(k)).sort(),
                ];
                sortedGroupKats.forEach(kat => {
                  const items = sortProductsByVariant(groups[kat], kat);
                  if (summaryKat === 'all') rows.push(<tr key={'hdr-'+kat}><td colSpan={7} style={{ padding:'6px 10px', background: KAT_COLOR[kat]||'#f1f5f9', fontSize:12, fontWeight:700, color:'#374151' }}>🏷 {kat} — {items.length} produk</td></tr>);
                  items.forEach(p => {
                    const isLow = p.saldo > 0 && p.saldo <= (p.stok_minimum||5);
                    const isEmpty = p.saldo <= 0;
                    rows.push(
                      <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9', background: isEmpty && p.totalIn > 0 ? '#fff5f5' : isLow ? '#fffbeb' : '' }}>
                        <td style={{ padding:'8px 10px', fontWeight:600, fontSize:12 }}>{p.name}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#10b981', fontWeight:600 }}>+{p.totalIn}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#B49A35', fontWeight:600 }}>+{p.totalRetur}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#ef4444', fontWeight:600 }}>-{p.totalOut}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'#8b5cf6', fontWeight:600 }}>-{Math.max(0,p.orderOut)}</td>
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
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: SALDO PER RASA (PIVOT)
      ══════════════════════════════════════════════════════════════════ */}
      {mainTab === 'saldo' && (() => {
        // Smallest → largest. Loyang treated as Square.
        const SIZE_COLS = ['Slice','Quarter','Half','Round','Square'];
        // Short labels for column headers
        const SIZE_LABEL = { Slice:'Slc', Quarter:'Qtr', Half:'Half', Round:'Rnd', Square:'Sqr' };

        // Build pivot: kategori → variant → { [size]: product }
        const pivot = {};
        products.forEach(p => {
          const kat = p.kategori || 'Lainnya';
          const variant = getVariant(p.name);
          let sz = getSizeName(p.name);
          // Loyang and no-suffix → treat as Square
          if (!sz || sz.toLowerCase() === 'loyang') sz = 'Square';
          if (!pivot[kat]) pivot[kat] = {};
          if (!pivot[kat][variant]) pivot[kat][variant] = {};
          pivot[kat][variant][sz] = p;
        });

        // Only show columns that have at least one product
        const activeCols = SIZE_COLS.filter(sz =>
          Object.values(pivot).some(variants =>
            Object.values(variants).some(sizes => sizes[sz])
          )
        );

        // Category display order
        const KAT_ORDER = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
        const KAT_COLOR = {
          'Lapis Legit':    '#FBF5DF',
          'Lapis Surabaya': '#dbeafe',
          'Cookies':        '#fce7f3',
          'Gift Box':       '#d1fae5',
        };

        // Sort kategori by KAT_ORDER, then alphabetical for unknowns
        const HIDE_KATS = ['Gift Box'];
        const sortedKats = [
          ...KAT_ORDER.filter(k => pivot[k] && !HIDE_KATS.includes(k)),
          ...Object.keys(pivot).filter(k => !KAT_ORDER.includes(k) && !HIDE_KATS.includes(k)).sort(),
        ];

        const sendSaldoWA = () => {
          const now = new Date();
          const tgl = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}.${String(now.getMinutes()).padStart(2,'0')}`;

          // Shorten variant name for WA
          const shortName = (variant, kat) => {
            if (kat === 'Lapis Legit') return variant.replace(/^Lapis Legit\s*/i, '') || 'Original';
            if (kat === 'Lapis Surabaya') {
              const flavor = variant.replace(/^Lapis Surabaya\s*/i, '');
              return flavor.toLowerCase() === 'original' || !flavor ? 'Sur' : `Sur ${flavor}`;
            }
            return variant;
          };

          const val = (p) => {
            if (!p) return '-';
            const s = currentStock[p.id] || 0;
            return s <= 0 ? '-' : String(s);
          };

          const lines = [];
          lines.push(`*STOK SEMENTARA ${tgl}*`);

          // Lapis Legit + Lapis Surabaya with (Slc/Qtr/Half/Rnd/Sqr) format
          ['Lapis Legit', 'Lapis Surabaya'].forEach(kat => {
            if (!pivot[kat]) return;
            lines.push('');
            sortVariants(Object.keys(pivot[kat]), kat).forEach(variant => {
              const sizes = pivot[kat][variant];
              const vals = activeCols.map(sz => val(sizes[sz])).join('/');
              lines.push(`• ${shortName(variant, kat)} : (${vals})`);
            });
          });

          // Cookies — no size columns, just name : qty
          if (pivot['Cookies']) {
            lines.push('');
            lines.push('*STOCK COOKIES*');
            sortVariants(Object.keys(pivot['Cookies']), 'Cookies').forEach(variant => { const sizes = pivot['Cookies'][variant];
              // Cookies usually only Square/no-size
              const p = sizes['Square'] || Object.values(sizes)[0];
              const s = p ? (currentStock[p.id] || 0) : 0;
              lines.push(`${variant} : ${s <= 0 ? '-' : s}`);
            });
          }

          // Gift Box — excluded from WA report

          window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
        };

        return (
          <div style={{ background:'#fff', borderRadius:12, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <h3 style={{ margin:0, fontSize:13, fontWeight:700 }}>📋 Stok by Rasa</h3>
                <div style={{ display:'flex', gap:8, fontSize:10, color:'#64748b' }}>
                  <span style={{ color:'#10b981', fontWeight:700 }}>● Cukup</span>
                  <span style={{ color:'#B49A35', fontWeight:700 }}>● Hampir</span>
                  <span style={{ color:'#ef4444', fontWeight:700 }}>● Habis</span>
                </div>
              </div>
              <button onClick={sendSaldoWA} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#25D366', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:11 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Kirim WA
              </button>
            </div>

            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'auto', minWidth:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
                <colgroup>
                  <col style={{ width:200 }} />
                  {activeCols.map(sz => <col key={sz} style={{ width:58 }} />)}
                </colgroup>
                {/* Sticky header */}
                <thead>
                  <tr style={{ background:'#f8f7f4' }}>
                    <th style={{ padding:'5px 10px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Varian</th>
                    {activeCols.map(sz => (
                      <th key={sz} style={{ padding:'5px 6px', textAlign:'center', fontSize:10, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>{SIZE_LABEL[sz]||sz}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedKats.map(kat => {
                    const variants = pivot[kat];
                    const katBg = KAT_COLOR[kat] || '#f1f5f9';
                    return (
                      <React.Fragment key={kat}>
                        {/* Category row */}
                        <tr>
                          <td colSpan={activeCols.length + 1} style={{ background:katBg, padding:'5px 10px', fontWeight:700, fontSize:11, color:'#374151', borderTop:'2px solid #e2e8f0', borderBottom:'1px solid #e2e8f0' }}>
                            {kat}
                          </td>
                        </tr>
                        {/* Variant rows */}
                        {sortVariants(Object.keys(variants), kat).map(variant => {
                          const sizes = variants[variant];
                          return (
                          <tr key={variant} style={{ borderBottom:'1px solid #f1f5f9' }}>
                            <td style={{ padding:'4px 10px', fontWeight:600, fontSize:11, color:'#1C1208', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{variant}</td>
                            {activeCols.map(sz => {
                              const p = sizes[sz];
                              if (!p) return <td key={sz} style={{ padding:'3px 4px', textAlign:'center', color:'#d1d5db', fontSize:11 }}>—</td>;
                              const saldo = currentStock[p.id] || 0;
                              const isEmpty = saldo <= 0;
                              const isLow   = saldo > 0 && saldo <= (p.stok_minimum || 5);
                              const color   = isEmpty ? '#ef4444' : isLow ? '#B49A35' : '#10b981';
                              const bg      = isEmpty ? '#fff5f5' : isLow ? '#fffbeb' : '#f0fdf4';
                              return (
                                <td key={sz} style={{ padding:'3px 4px', textAlign:'center' }}>
                                  <div style={{ background:bg, borderRadius:4, padding:'3px 0', fontWeight:800, fontSize:12, color }}>
                                    {saldo}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: INPUT STOK
      ══════════════════════════════════════════════════════════════════ */}
      {mainTab === 'input' && (
      <>

        {/* ── Sub-tab buttons (always visible) ─────────────────────────── */}
        {canEdit && (
          <div style={{ display:'flex', gap:4, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            {['in','out','retur','konversi'].map(t => (
              <button key={t} onClick={() => { switchTab(t); if(t!=='in') setMassMode(false); }} style={{ padding:'9px 12px', fontSize:11, fontWeight:700, background: activeTab===t ? tabColor[t] : '#f1f5f9', color: activeTab===t ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>{tabLabel[t]}</button>
            ))}
            {activeTab === 'in' && (
              <button onClick={() => { setMassMode(m => !m); setMassQty({}); }} style={{ marginLeft:'auto', padding:'9px 14px', fontSize:11, fontWeight:700, background: massMode ? '#1C1208' : '#e2e8f0', color: massMode ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>
                {massMode ? '✕ Mode Normal' : '⊞ Mass Input'}
              </button>
            )}
          </div>
        )}

        {/* ── MASS INPUT GRID ─────────────────────────────────────────── */}
        {canEdit && activeTab === 'in' && massMode && (() => {
          const MASS_SIZES  = ['Slice','Quarter','Half','Round','Square'];
          const MASS_LABELS = { Slice:'Slc', Quarter:'Qtr', Half:'Half', Round:'Rnd', Square:'Sqr' };
          const KAT_ORDER   = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box'];
          const KAT_COLOR   = { 'Lapis Legit':'#FBF5DF','Lapis Surabaya':'#dbeafe','Cookies':'#fce7f3','Gift Box':'#d1fae5' };

          // Build same pivot as Stok by Rasa
          const mp = {};
          products.forEach(p => {
            const kat = p.kategori || 'Lainnya';
            const variant = getVariant(p.name);
            let sz = getSizeName(p.name);
            if (!sz || sz.toLowerCase() === 'loyang') sz = 'Square';
            if (!mp[kat]) mp[kat] = {};
            if (!mp[kat][variant]) mp[kat][variant] = {};
            mp[kat][variant][sz] = p;
          });

          const activeMassCols = MASS_SIZES.filter(sz =>
            Object.values(mp).some(vs => Object.values(vs).some(ss => ss[sz]))
          );
          const HIDE_KATS_MASS = ['Gift Box'];
          const sortedMassKats = [...KAT_ORDER.filter(k => mp[k] && !HIDE_KATS_MASS.includes(k)), ...Object.keys(mp).filter(k => !KAT_ORDER.includes(k) && !HIDE_KATS_MASS.includes(k)).sort()];
          const totalFilled = Object.values(massQty).filter(v => Number(v) > 0).length;

          return (
            <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
              {/* Header fields */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                <FieldGroup label="Tanggal *">
                  <input type="date" value={massDate} onChange={e => setMassDate(e.target.value)} style={S.input} />
                </FieldGroup>
                <FieldGroup label="Kode Batch *">
                  <input value={massBatch} onChange={e => setMassBatch(e.target.value)} style={S.input} placeholder="Contoh: LP-001" />
                </FieldGroup>
                <FieldGroup label="Expired (opsional)">
                  <input type="date" value={massExpired} onChange={e => setMassExpired(e.target.value)} style={S.input} />
                </FieldGroup>
              </div>

              {/* ── WA Paste ── */}
              <div style={{ marginBottom:16 }}>
                <button onClick={() => { setWaPaste(w=>!w); setWaResult(null); }} style={{ padding:'7px 14px', fontSize:11, fontWeight:700, background: waPaste ? '#1C1208' : '#f1f5f9', color: waPaste ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>
                  📋 {waPaste ? 'Tutup WA Import' : 'WA Import (Paste)'}
                </button>
                {waPaste && (
                  <div style={{ marginTop:10 }}>
                    <textarea
                      value={waText} onChange={e => setWaText(e.target.value)}
                      placeholder="Paste recap WhatsApp di sini..."
                      style={{ width:'100%', height:160, padding:10, fontSize:12, border:'2px solid #e2e8f0', borderRadius:8, fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }}
                    />
                    <div style={{ display:'flex', gap:8, marginTop:6 }}>
                      <button onClick={parseWaImport} disabled={!waText.trim()} style={{ padding:'8px 16px', background:'#B49A35', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                        ⚡ Parse & Isi Grid
                      </button>
                      <button onClick={() => { setWaText(''); setWaResult(null); }} style={{ padding:'8px 12px', background:'none', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, cursor:'pointer', color:'#64748b' }}>Reset</button>
                    </div>
                    {waResult && (
                      <div style={{ marginTop:10, padding:12, background:'#f0fdf4', borderRadius:8, border:'1px solid #86efac', fontSize:12 }}>
                        <div style={{ fontWeight:700, color:'#166534', marginBottom:6 }}>✅ Berhasil match {waResult.matched.length} produk</div>
                        {waResult.unmatched.length > 0 && (
                          <div style={{ marginTop:6 }}>
                            <div style={{ fontWeight:700, color:'#92400e', marginBottom:4 }}>⚠️ Tidak ditemukan ({waResult.unmatched.length}):</div>
                            <div style={{ color:'#92400e' }}>{waResult.unmatched.join(' · ')}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pivot grid */}
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'auto', minWidth:'100%' }}>
                  <colgroup>
                    <col style={{ width:180 }} />
                    {activeMassCols.map(sz => <col key={sz} style={{ width:70 }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ background:'#f8f7f4' }}>
                      <th style={{ padding:'6px 10px', textAlign:'left', fontSize:10, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Varian</th>
                      {activeMassCols.map(sz => (
                        <th key={sz} style={{ padding:'6px 8px', textAlign:'center', fontSize:10, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>{MASS_LABELS[sz]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMassKats.map(kat => (
                      <React.Fragment key={kat}>
                        <tr>
                          <td colSpan={activeMassCols.length + 1} style={{ background: KAT_COLOR[kat]||'#f1f5f9', padding:'5px 10px', fontWeight:700, fontSize:11, color:'#374151', borderTop:'2px solid #e2e8f0' }}>
                            {kat}
                          </td>
                        </tr>
                        {sortVariants(Object.keys(mp[kat]), kat).map(variant => {
                          const sizes = mp[kat][variant];
                          return (
                          <tr key={variant} style={{ borderBottom:'1px solid #f1f5f9' }}>
                            <td style={{ padding:'4px 10px', fontSize:11, fontWeight:600, color:'#1C1208', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {variant}
                            </td>
                            {activeMassCols.map(sz => {
                              const p = sizes[sz];
                              if (!p) return <td key={sz} style={{ padding:'3px 4px', textAlign:'center', color:'#d1d5db', fontSize:11 }}>—</td>;
                              const saldo = currentStock[p.id] || 0;
                              const hasVal = Number(massQty[p.id]||0) > 0;
                              return (
                                <td key={sz} style={{ padding:'3px 4px', textAlign:'center' }}>
                                  <div style={{ position:'relative' }}>
                                    <input
                                      type="number" min="0"
                                      value={massQty[p.id] || ''}
                                      onChange={e => setMassQty(q => ({ ...q, [p.id]: e.target.value }))}
                                      placeholder="0"
                                      style={{ width:'100%', padding:'5px 4px', textAlign:'center', border: `2px solid ${hasVal ? '#10b981' : '#e2e8f0'}`, borderRadius:6, fontSize:13, fontWeight:700, outline:'none', boxSizing:'border-box', background: hasVal ? '#f0fdf4' : '#fff' }}
                                    />
                                    <div style={{ fontSize:9, color:'#94a3b8', marginTop:1 }}>saldo:{saldo}</div>
                                  </div>
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

              {/* Submit */}
              <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:12 }}>
                <button onClick={handleMassSubmit} disabled={saving || totalFilled === 0 || !massBatch}
                  style={{ padding:'10px 24px', background: totalFilled > 0 && massBatch ? '#10b981' : '#94a3b8', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor: totalFilled > 0 && massBatch ? 'pointer' : 'not-allowed' }}>
                  {saving ? 'Menyimpan...' : `✅ Submit ${totalFilled} Produk`}
                </button>
                {totalFilled > 0 && <span style={{ fontSize:12, color:'#64748b' }}>{totalFilled} produk akan diinput</span>}
                {totalFilled > 0 && <button onClick={() => setMassQty({})} style={{ padding:'8px 14px', background:'none', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, cursor:'pointer', color:'#64748b' }}>Reset</button>}
              </div>
            </div>
          );
        })()}

        {/* ── NORMAL 2-COLUMN LAYOUT ──────────────────────────────────── */}
        {(!massMode || activeTab !== 'in') && (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '380px 1fr', gap:20 }}>

        {/* ── INPUT FORM ────────────────────────────────────────────────────── */}
        {canEdit && (
          <div>

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
                              const sz = getSizeName(p.name);
                              const sizeLbl = sz || 'Loyang';
                              const bisa = canConvert(sz);
                              return (
                                <option key={p.id} value={p.id} disabled={!bisa}>
                                  {sizeLbl}{!bisa ? ' (tidak bisa dikonversi)' : ''} — Stok: {currentStock[p.id]||0} {p.unit}
                                </option>
                              );
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

                    {/* ── Tidak ada target → produk target belum dibuat ── */}
                    {konvSrcId && convTargets.length === 0 && canConvert(getSizeName(srcProd?.name||'')) && (
                      <div style={{ marginTop:14, padding:'12px 14px', background:'#fff7ed', borderRadius:10, border:'1px solid #fed7aa', fontSize:12, color:'#9a3412' }}>
                        ⚠️ Produk hasil konversi belum ada di database.<br/>
                        <span style={{ fontWeight:600 }}>Contoh:</span> untuk konversi "{srcProd?.name}", tambahkan produk "{getVariant(srcProd?.name||'')} Half" atau "{getVariant(srcProd?.name||'')} Slice" di menu Produk.
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
      )}

      </>
      )}

    </div>
  );
}
