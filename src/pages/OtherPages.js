import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, fmtDate, fmtDateTime, S } from '../utils';
import { RoleBadge, Btn, FieldGroup } from '../components/UI';

// ─── STAFF MANAGER ────────────────────────────────────────────────────────────
const SALES_ROLES = ['sales', 'kepala_sales'];

export function StaffManager({ staff, outlets, onRefresh, showToast }) {
  const [form, setForm] = useState({ name:'', role:'produksi', pin:'', phone:'', outlet_ids:[] });
  const [editPin, setEditPin] = useState({});
  const [editPhone, setEditPhone] = useState({});
  const [editOutlets, setEditOutlets] = useState({});
  const [outletOpen, setOutletOpen] = useState({}); // { staffId: bool }
  const [saving, setSaving] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortBy, setSortBy] = useState('name');

  const addStaff = async () => {
    if (!form.name || !form.pin) return showToast('❌ Nama & PIN wajib diisi');
    if (form.pin.length !== 4 || !/^\d+$/.test(form.pin)) return showToast('❌ PIN harus 4 angka');
    setSaving(true);
    const outletIds = SALES_ROLES.includes(form.role) ? form.outlet_ids : [];
    const { error } = await supabase.from('users_profile').insert({ id: 'USR' + uid().slice(0,6), name: form.name, role: form.role, pin: form.pin, phone: form.phone||null, is_active: true, outlet_ids: outletIds });
    setSaving(false);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Staff ' + form.name + ' berhasil ditambahkan');
    setForm({ name:'', role:'produksi', pin:'', phone:'', outlet_ids:[] });
    onRefresh();
  };

  const toggleActive = async (s) => {
    await supabase.from('users_profile').update({ is_active: !s.is_active }).eq('id', s.id);
    showToast(`✅ ${s.name} ${s.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
    onRefresh();
  };

  const deleteStaff = async (s) => {
    if (!window.confirm(`Hapus permanen staff "${s.name}"? Tindakan ini tidak bisa diurungkan.`)) return;
    const { error } = await supabase.from('users_profile').delete().eq('id', s.id);
    if (error) return showToast('❌ ' + error.message);
    showToast(`✅ Staff ${s.name} dihapus`);
    onRefresh();
  };

  const resetPin = async (s) => {
    const newPin = editPin[s.id];
    if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) return showToast('❌ PIN baru harus 4 angka');
    await supabase.from('users_profile').update({ pin: newPin }).eq('id', s.id);
    setEditPin(p => { const n = {...p}; delete n[s.id]; return n; });
    showToast('✅ PIN ' + s.name + ' berhasil direset');
    onRefresh();
  };

  const savePhone = async (s) => {
    const phone = editPhone[s.id] ?? '';
    await supabase.from('users_profile').update({ phone: phone || null }).eq('id', s.id);
    setEditPhone(p => { const n = {...p}; delete n[s.id]; return n; });
    showToast('✅ No. HP ' + s.name + ' disimpan');
    onRefresh();
  };

  const changeRole = async (s, role) => {
    // Clear outlet_ids when changing away from sales roles
    const update = { role };
    if (!SALES_ROLES.includes(role)) update.outlet_ids = [];
    await supabase.from('users_profile').update(update).eq('id', s.id);
    showToast('✅ Role ' + s.name + ' diubah ke ' + role);
    onRefresh();
  };

  const saveOutlets = async (s) => {
    const ids = editOutlets[s.id] ?? (s.outlet_ids || []);
    await supabase.from('users_profile').update({ outlet_ids: ids }).eq('id', s.id);
    setEditOutlets(p => { const n = {...p}; delete n[s.id]; return n; });
    showToast('✅ Outlet assignment ' + s.name + ' tersimpan');
    onRefresh();
  };

  const toggleFormOutlet = (outletId) => {
    setForm(f => {
      const ids = f.outlet_ids.includes(outletId)
        ? f.outlet_ids.filter(id => id !== outletId)
        : [...f.outlet_ids, outletId];
      return { ...f, outlet_ids: ids };
    });
  };

  const toggleEditOutlet = (staffId, outletId, current) => {
    setEditOutlets(prev => {
      const ids = prev[staffId] ?? (current || []);
      const updated = ids.includes(outletId) ? ids.filter(id => id !== outletId) : [...ids, outletId];
      return { ...prev, [staffId]: updated };
    });
  };

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1C1208' }}>Manajemen Staff</h2>
      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:20 }}>
        {/* Add form */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', height:'fit-content' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>+ Tambah Staff Baru</h3>
          <FieldGroup label="Nama Staff">
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={S.input} placeholder="Nama lengkap..." />
          </FieldGroup>
          <div style={{ marginTop:12 }}>
            <FieldGroup label="Role">
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value, outlet_ids:[]}))} style={S.input}>
                <option value="produksi">Produksi</option>
                <option value="kepala_produksi">Kepala Produksi</option>
                <option value="sales">Sales</option>
                <option value="kepala_sales">Kepala Sales</option>
                <option value="admin">Admin</option>
              </select>
            </FieldGroup>
          </div>
          {/* Outlet assignment — only for sales roles */}
          {SALES_ROLES.includes(form.role) && outlets && outlets.length > 0 && (
            <div style={{ marginTop:12 }}>
              <label style={S.label}>Outlet yang ditangani</label>
              <div style={{ background:'#f8f7f4', borderRadius:8, padding:'8px 10px', maxHeight:150, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                {outlets.map(o => (
                  <label key={o.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer', padding:'3px 0' }}>
                    <input type="checkbox" checked={form.outlet_ids.includes(o.id)} onChange={() => toggleFormOutlet(o.id)} style={{ accentColor:'#3b82f6' }} />
                    {o.name}
                  </label>
                ))}
              </div>
              {form.outlet_ids.length === 0 && <div style={{ fontSize:11, color:'#B49A35', marginTop:4 }}>⚠️ Pilih minimal 1 outlet</div>}
            </div>
          )}
          <div style={{ marginTop:12 }}>
            <FieldGroup label="PIN (4 angka)">
              <input type="text" maxLength={4} value={form.pin} onChange={e => setForm(f => ({...f, pin: e.target.value.replace(/\D/,'')}))} style={S.input} placeholder="Contoh: 1234" />
            </FieldGroup>
          </div>
          <div style={{ marginTop:12 }}>
            <FieldGroup label="No. HP (opsional)">
              <input type="text" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} style={S.input} placeholder="08xx..." />
            </FieldGroup>
          </div>
          <Btn onClick={addStaff} disabled={saving} color="#1C1208" style={{ marginTop:16, width:'100%' }}>
            {saving ? 'Menyimpan...' : '+ Tambah Staff'}
          </Btn>
          <div style={{ marginTop:12, padding:10, background:'#FBF5DF', borderRadius:8, fontSize:11, color:'#6B5418' }}>
            💡 Sampaikan PIN ke staff secara langsung. Jangan share via chat.
          </div>
        </div>

        {/* Staff list */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          {/* Filter & sort bar */}
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="🔍 Cari nama..." style={{ ...S.input, flex:1, minWidth:120, padding:'7px 12px', fontSize:12 }} />
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...S.input, fontSize:12, padding:'7px 10px' }}>
              <option value="all">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="kepala_produksi">Kep. Produksi</option>
              <option value="produksi">Produksi</option>
              <option value="kepala_sales">Kep. Sales</option>
              <option value="sales">Sales</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, fontSize:12, padding:'7px 10px' }}>
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...S.input, fontSize:12, padding:'7px 10px' }}>
              <option value="name">↑ Nama</option>
              <option value="role">↑ Role</option>
              <option value="status">↑ Status</option>
            </select>
          </div>

          {(() => {
            let filtered = staff
              .filter(s => !filterSearch || s.name.toLowerCase().includes(filterSearch.toLowerCase()))
              .filter(s => filterRole === 'all' || s.role === filterRole)
              .filter(s => filterStatus === 'all' || (filterStatus === 'active' ? s.is_active : !s.is_active));
            filtered = [...filtered].sort((a, b) => {
              if (sortBy === 'name')   return a.name.localeCompare(b.name);
              if (sortBy === 'role')   return a.role.localeCompare(b.role);
              if (sortBy === 'status') return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
              return 0;
            });
            const total = staff.length;
            const shown = filtered.length;

            return <>
              <div style={{ fontSize:11, color:'#94a3b8', marginBottom:10 }}>Menampilkan {shown} dari {total} staff</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filtered.length === 0
                  ? <div style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Tidak ada staff yang sesuai filter</div>
                  : filtered.map(s => {
                    const assignedOutlets = s.outlet_ids?.length ? outlets.filter(o => s.outlet_ids.includes(o.id)) : [];
                    const isOutletOpen = !!outletOpen[s.id];
                    return (
                      <div key={s.id} style={{ padding:'12px 14px', background: s.is_active ? '#f8f7f4' : '#f1f5f9', borderRadius:10, border: s.is_active ? '1px solid #e8e3d8' : '1px dashed #cbd5e1' }}>
                        {/* Row 1: name + role badge + action buttons */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                            <span style={{ fontWeight:700, fontSize:14, color: s.is_active ? '#1C1208' : '#94a3b8' }}>{s.name}</span>
                            <RoleBadge role={s.role} />
                            {!s.is_active && <span style={{ fontSize:10, color:'#94a3b8', background:'#e2e8f0', padding:'1px 6px', borderRadius:6 }}>Nonaktif</span>}
                          </div>
                          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                            <select value={s.role} onChange={e => changeRole(s, e.target.value)} style={{ padding:'4px 6px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:10, cursor:'pointer', background:'#fff' }}>
                              <option value="produksi">Produksi</option>
                              <option value="kepala_produksi">Kep. Produksi</option>
                              <option value="sales">Sales</option>
                              <option value="kepala_sales">Kep. Sales</option>
                              <option value="admin">Admin</option>
                            </select>
                            <Btn small onClick={() => toggleActive(s)} color={s.is_active ? '#f59e0b' : '#10b981'}>
                              {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </Btn>
                            <Btn small onClick={() => deleteStaff(s)} color="#ef4444">🗑</Btn>
                          </div>
                        </div>

                        {/* Row 2: reset PIN + edit phone */}
                        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:10, flexWrap:'wrap' }}>
                          <input type="text" maxLength={4} value={editPin[s.id]||''} onChange={e => setEditPin(p => ({...p, [s.id]: e.target.value.replace(/\D/,'')}))} style={{ ...S.input, width:90, padding:'5px 8px', fontSize:12 }} placeholder="PIN baru" />
                          <Btn small onClick={() => resetPin(s)} color="#B49A35">Reset PIN</Btn>
                          <div style={{ width:1, height:20, background:'#e2e8f0', margin:'0 2px' }} />
                          <input type="text" value={editPhone[s.id] ?? (s.phone||'')} onChange={e => setEditPhone(p => ({...p, [s.id]: e.target.value}))} style={{ ...S.input, width:130, padding:'5px 8px', fontSize:12 }} placeholder="No. HP" />
                          <Btn small onClick={() => savePhone(s)} color="#10b981">💾 No. HP</Btn>
                        </div>

                        {/* Row 3: Outlet collapsible — sales roles only */}
                        {SALES_ROLES.includes(s.role) && outlets && outlets.length > 0 && (
                          <div style={{ marginTop:10 }}>
                            <button
                              onClick={() => setOutletOpen(p => ({ ...p, [s.id]: !p[s.id] }))}
                              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background: isOutletOpen ? '#dbeafe' : '#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:11, fontWeight:700, color:'#374151' }}>
                              <span>🏪 Outlet Assignment ({assignedOutlets.length} dipilih{assignedOutlets.length ? ': ' + assignedOutlets.map(o=>o.name).join(', ') : ''})</span>
                              <span style={{ fontSize:12, color:'#64748b' }}>{isOutletOpen ? '▲' : '▼'}</span>
                            </button>
                            {isOutletOpen && (
                              <div style={{ marginTop:6, padding:'10px 12px', background:'#f8fafc', borderRadius:8, border:'1px solid #dbeafe' }}>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                                  {outlets.map(o => {
                                    const currentIds = editOutlets[s.id] ?? (s.outlet_ids || []);
                                    return (
                                      <label key={o.id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, cursor:'pointer', background: currentIds.includes(o.id) ? '#dbeafe' : '#fff', padding:'4px 10px', borderRadius:6, border: currentIds.includes(o.id) ? '1px solid #3b82f6' : '1px solid #e2e8f0' }}>
                                        <input type="checkbox" checked={currentIds.includes(o.id)} onChange={() => toggleEditOutlet(s.id, o.id, s.outlet_ids)} style={{ accentColor:'#3b82f6' }} />
                                        {o.name}
                                      </label>
                                    );
                                  })}
                                </div>
                                <div style={{ display:'flex', gap:6 }}>
                                  <Btn small onClick={() => { saveOutlets(s); setOutletOpen(p => ({...p, [s.id]: false})); }} color="#3b82f6">💾 Simpan</Btn>
                                  <Btn small onClick={() => { setEditOutlets(p => { const n={...p}; delete n[s.id]; return n; }); setOutletOpen(p => ({...p, [s.id]: false})); }} color="#64748b">Batal</Btn>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>;
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export function ActivityLog({ activityLog, staff }) {
  const [filterUser, setFilterUser] = useState('all');
  const [filterAction, setFilterAction] = useState('all');

  const actions = [...new Set(activityLog.map(a => a.action))];
  const filtered = activityLog.filter(a =>
    (filterUser === 'all' || a.user_id === filterUser) &&
    (filterAction === 'all' || a.action === filterAction)
  );

  const actionIcon = { login:'🔐', stok_masuk:'📦', stok_keluar:'📤', retur:'🔄', order_buat:'🛒', order_status:'📋', reject:'⚠️' };

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1C1208' }}>Activity Log</h2>
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...S.input, width:'auto' }}>
            <option value='all'>Semua Staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ ...S.input, width:'auto' }}>
            <option value='all'>Semua Aksi</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span style={{ fontSize:13, color:'#64748b', alignSelf:'center' }}>{filtered.length} entri</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#f8f7f4' }}>
              <th style={S.th}>Waktu</th>
              <th style={S.th}>Staff</th>
              <th style={S.th}>Aksi</th>
              <th style={S.th}>Keterangan</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={4} style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>Tidak ada data</td></tr>
                : filtered.map(a => (
                  <tr key={a.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ ...S.td, color:'#64748b', fontSize:12 }}>{fmtDateTime(a.created_at)}</td>
                    <td style={{ ...S.td, fontWeight:600 }}>{a.user_name}</td>
                    <td style={{ ...S.td }}><span style={{ background:'#f1f5f9', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600 }}>{actionIcon[a.action]||'📌'} {a.action}</span></td>
                    <td style={{ ...S.td, color:'#374151' }}>{a.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT MANAGER ──────────────────────────────────────────────────────────
export function ProductManager({ products, onRefresh, showToast }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [form, setForm] = useState({ name:'', unit:'loyang', price:'', kategori:'', expired_duration:'', stok_minimum:'5' });
  const [saving, setSaving] = useState(false);
  const [filterKategori, setFilterKategori] = useState('all');
  const [search, setSearch] = useState('');

  const KATEGORI = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box','Lainnya'];
  const SIZE_ORDER = ['Slice','Quarter','Half','Round','Square'];
  const KAT_COLOR = { 'Lapis Legit':'#FBF5DF','Lapis Surabaya':'#dbeafe','Cookies':'#fce7f3','Gift Box':'#d1fae5' };
  const KAT_ORDER = ['Lapis Legit','Lapis Surabaya','Cookies','Gift Box','Lainnya'];

  const getVariant = name => { const m = name.match(/^(.+?)\s*-\s*(Slice|Quarter|Half|Round|Square)$/i); return m ? m[1].trim() : name; };
  const getSizeIdx = name => { const i = SIZE_ORDER.findIndex(s => name.endsWith('- ' + s)); return i >= 0 ? i : SIZE_ORDER.length; };

  const addProduct = async () => {
    if (!form.name) return showToast('❌ Nama produk wajib diisi');
    setSaving(true);
    const { error } = await supabase.from('products').insert({ id: 'PRD' + uid().slice(0,6).toUpperCase(), name: form.name, unit: form.unit, price: Number(form.price)||0, kategori: form.kategori, expired_duration: Number(form.expired_duration)||null, stok_minimum: Number(form.stok_minimum)||5 });
    setSaving(false);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Produk berhasil ditambahkan');
    setForm({ name:'', unit:'loyang', price:'', kategori:'', expired_duration:'', stok_minimum:'5' });
    onRefresh();
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Produk dihapus');
    onRefresh();
  };

  // Filter
  const filtered = products
    .filter(p => filterKategori === 'all' || p.kategori === filterKategori)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  // Group: kategori → variant → [items sorted by size]
  const grouped = {};
  filtered.forEach(p => {
    const kat = p.kategori || 'Lainnya';
    const variant = getVariant(p.name);
    if (!grouped[kat]) grouped[kat] = {};
    if (!grouped[kat][variant]) grouped[kat][variant] = [];
    grouped[kat][variant].push(p);
  });
  Object.keys(grouped).forEach(kat =>
    Object.keys(grouped[kat]).forEach(v =>
      grouped[kat][v].sort((a,b) => getSizeIdx(a.name) - getSizeIdx(b.name))
    )
  );
  const sortedKats = KAT_ORDER.filter(k => grouped[k]);

  return (
    <div>
      <h2 style={{ margin:'0 0 16px', fontWeight:800, color:'#1C1208' }}>Master Produk</h2>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari produk..."
          style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, minWidth:200, flex:1 }} />
        <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
          style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, background:'#fff' }}>
          <option value="all">Semua Kategori ({products.length})</option>
          {KATEGORI.map(k => { const n = products.filter(p => p.kategori===k).length; return n > 0 && <option key={k} value={k}>{k} ({n})</option>; })}
        </select>
        {(search || filterKategori !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterKategori('all'); }}
            style={{ padding:'7px 12px', borderRadius:8, border:'none', background:'#fee2e2', color:'#ef4444', fontSize:12, cursor:'pointer', fontWeight:600 }}>✕ Reset</button>
        )}
        <span style={{ fontSize:12, color:'#94a3b8' }}>{filtered.length} produk</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20 }}>
        {/* Add form — admin only */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', height:'fit-content' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Tambah Produk Baru</h3>
          {!isAdmin && <div style={{ padding:'12px 16px', background:'#f1f5f9', borderRadius:8, fontSize:13, color:'#64748b', marginBottom:12 }}>🔒 Hanya Admin yang bisa menambah atau menghapus produk.</div>}
          {isAdmin && <>
          <div style={{ marginBottom:12 }}>
            <FieldGroup label="Nama Produk">
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={S.input} placeholder="Lapis Legit Original - Quarter" />
            </FieldGroup>
          </div>
          <div style={{ marginBottom:12 }}>
            <FieldGroup label="Kategori">
              <select value={form.kategori} onChange={e => setForm(f => ({...f, kategori: e.target.value}))} style={S.input}>
                <option value=''>-- Pilih --</option>
                {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </FieldGroup>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <FieldGroup label="Satuan">
              <select value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} style={S.input}>
                <option value="loyang">loyang</option><option value="slice">slice</option><option value="pcs">pcs</option><option value="box">box</option><option value="paket">paket</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Harga (Rp)">
              <input type="number" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} style={S.input} placeholder="0" />
            </FieldGroup>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <FieldGroup label="Min Stok">
              <input type="number" value={form.stok_minimum} onChange={e => setForm(f => ({...f, stok_minimum: e.target.value}))} style={S.input} placeholder="5" />
            </FieldGroup>
            <FieldGroup label="Expired (hari)">
              <input type="number" value={form.expired_duration} onChange={e => setForm(f => ({...f, expired_duration: e.target.value}))} style={S.input} placeholder="21" />
            </FieldGroup>
          </div>
          <Btn onClick={addProduct} disabled={saving} color="#1C1208" style={{ marginTop:4, width:'100%' }}>
            {saving ? 'Menyimpan...' : '+ Tambah Produk'}
          </Btn>
          </>}
        </div>

        {/* Product list - grouped */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {filtered.length === 0
            ? <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', color:'#94a3b8' }}>Tidak ada produk ditemukan</div>
            : sortedKats.map(kat => (
              <div key={kat} style={{ background:'#fff', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,.07)', overflow:'hidden' }}>
                {/* Category header */}
                {filterKategori === 'all' && (
                  <div style={{ background: KAT_COLOR[kat]||'#f1f5f9', padding:'10px 16px', fontWeight:700, fontSize:13, color:'#1C1208', display:'flex', justifyContent:'space-between' }}>
                    <span>🏷 {kat}</span>
                    <span style={{ fontWeight:400, color:'#64748b' }}>{Object.values(grouped[kat]).flat().length} produk</span>
                  </div>
                )}
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#f8f7f4' }}>
                    {['Nama / Ukuran','Satuan','Harga','Min Stok','Expired',''].map((h,i) =>
                      <th key={i} style={{ ...S.th, textAlign: i >= 2 && i <= 4 ? 'center' : 'left' }}>{h}</th>
                    )}
                  </tr></thead>
                  <tbody>
                    {Object.entries(grouped[kat]).map(([variant, items]) => (
                      items.length === 1
                        // Single item — show full name
                        ? <tr key={items[0].id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                            <td style={{ ...S.td, fontWeight:600 }}>{items[0].name}</td>
                            <td style={S.td}>{items[0].unit}</td>
                            <td style={{ ...S.td, textAlign:'center' }}>{items[0].price ? 'Rp '+items[0].price.toLocaleString('id') : '-'}</td>
                            <td style={{ ...S.td, textAlign:'center' }}>{items[0].stok_minimum||5}</td>
                            <td style={{ ...S.td, textAlign:'center', color:'#64748b' }}>{items[0].expired_duration ? items[0].expired_duration+'h' : '-'}</td>
                            <td style={S.td}>{isAdmin && <button onClick={() => deleteProduct(items[0].id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:12 }}>Hapus</button>}</td>
                          </tr>
                        // Multiple sizes — show variant header then size rows
                        : <React.Fragment key={variant}>
                            <tr>
                              <td colSpan={6} style={{ padding:'6px 14px', background:'#f1f5f9', fontSize:12, fontWeight:700, color:'#374151', borderTop:'1px solid #e2e8f0' }}>
                                📦 {variant}
                              </td>
                            </tr>
                            {items.map(p => {
                              const sizePart = p.name.includes(' - ') ? p.name.split(' - ').pop() : p.name;
                              return (
                                <tr key={p.id} style={{ borderBottom:'1px solid #f8f7f4' }}>
                                  <td style={{ ...S.td, paddingLeft:24, color:'#374151' }}>↳ {sizePart}</td>
                                  <td style={S.td}>{p.unit}</td>
                                  <td style={{ ...S.td, textAlign:'center' }}>{p.price ? 'Rp '+p.price.toLocaleString('id') : '-'}</td>
                                  <td style={{ ...S.td, textAlign:'center' }}>{p.stok_minimum||5}</td>
                                  <td style={{ ...S.td, textAlign:'center', color:'#64748b' }}>{p.expired_duration ? p.expired_duration+'h' : '-'}</td>
                                  <td style={S.td}>{isAdmin && <button onClick={() => deleteProduct(p.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:12 }}>Hapus</button>}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── OUTLET MANAGER ───────────────────────────────────────────────────────────
export function OutletManager({ outlets, onRefresh, showToast }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const emptyForm = { name:'', address:'', phone:'', pic_name:'', pic_phone:'', notes:'', jam_operasional:'' };
  const [form, setForm]         = useState(emptyForm);
  const [editId, setEditId]     = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving]     = useState(false);

  const addOutlet = async () => {
    if (!form.name) return showToast('❌ Nama outlet wajib diisi');
    setSaving(true);
    const { error } = await supabase.from('outlets').insert({ id: 'OTL' + uid().slice(0,6).toUpperCase(), ...form });
    setSaving(false);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Outlet berhasil ditambahkan');
    setForm(emptyForm);
    onRefresh();
  };

  const startEdit = (o) => {
    setEditId(o.id);
    setEditForm({ phone: o.phone||'', pic_name: o.pic_name||'', pic_phone: o.pic_phone||'', address: o.address||'', jam_operasional: o.jam_operasional||'', notes: o.notes||'' });
  };

  const saveEdit = async (id) => {
    setSaving(true);
    const { error } = await supabase.from('outlets').update(editForm).eq('id', id);
    setSaving(false);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Outlet diupdate');
    setEditId(null);
    onRefresh();
  };

  const deleteOutlet = async (id, name) => {
    // Check if outlet has linked orders
    const { count } = await supabase.from('orders').select('id', { count:'exact', head:true }).eq('outlet_id', id);
    if (count > 0) {
      return showToast(`❌ Outlet "${name}" tidak bisa dihapus — masih ada ${count} order terkait. Nonaktifkan saja atau hapus order-nya dulu.`);
    }
    if (!window.confirm(`Hapus outlet "${name}"? Tindakan ini tidak bisa diurungkan.`)) return;
    const { error } = await supabase.from('outlets').delete().eq('id', id);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Outlet dihapus');
    onRefresh();
  };

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1C1208' }}>Master Outlet</h2>
      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', height:'fit-content' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Tambah Outlet</h3>
          {!isAdmin && <div style={{ padding:'12px 16px', background:'#f1f5f9', borderRadius:8, fontSize:13, color:'#64748b', marginBottom:12 }}>🔒 Hanya Admin yang bisa menambah atau menghapus outlet.</div>}
          {isAdmin && <>{[
            { label:'Nama Outlet *', key:'name', ph:'Outlet MOI' },
            { label:'Alamat', key:'address', ph:'Alamat lengkap...' },
            { label:'No. Telp Outlet', key:'phone', ph:'021-xxxx / 08xx...' },
            { label:'Nama PIC Pemesan', key:'pic_name', ph:'Nama penanggung jawab outlet' },
            { label:'No HP PIC Pemesan', key:'pic_phone', ph:'08xx...' },
            { label:'Jam Operasional', key:'jam_operasional', ph:'10:00 - 21:00' },
            { label:'Catatan Khusus', key:'notes', ph:'Misal: parkir di basement...' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:12 }}>
              <FieldGroup label={f.label}>
                <input value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} style={S.input} placeholder={f.ph} />
              </FieldGroup>
            </div>
          ))}
          <Btn onClick={addOutlet} disabled={saving} color="#1C1208" style={{ marginTop:4, width:'100%' }}>
            {saving ? 'Menyimpan...' : '+ Tambah Outlet'}
          </Btn>
          </>}
        </div>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Daftar Outlet ({outlets.length})</h3>
          {outlets.length === 0 ? <div style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Belum ada outlet</div>
          : outlets.map(o => (
            <div key={o.id} style={{ padding:'14px 16px', background:'#f8f7f4', borderRadius:10, marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{o.name}</div>
                  {o.address && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>📍 {o.address}</div>}
                  {o.phone && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>📞 {o.phone}</div>}
                  {o.pic_name && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>👤 {o.pic_name} {o.pic_phone && `· ${o.pic_phone}`}</div>}
                  {o.jam_operasional && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>🕐 {o.jam_operasional}</div>}
                  {o.notes && <div style={{ fontSize:12, color:'#B49A35', marginTop:2 }}>📝 {o.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => editId === o.id ? setEditId(null) : startEdit(o)} style={{ background:'none', border:'1px solid #e2e8f0', color:'#64748b', cursor:'pointer', fontSize:12, padding:'4px 10px', borderRadius:6, fontWeight:600 }}>
                    {editId === o.id ? 'Tutup' : '✏️ Edit'}
                  </button>
                  {isAdmin && <button onClick={() => deleteOutlet(o.id, o.name)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:18, padding:'4px 8px' }} title="Hapus outlet">🗑</button>}
                </div>
              </div>

              {/* Inline edit form */}
              {editId === o.id && (
                <div style={{ marginTop:12, padding:12, background:'#fff', borderRadius:8, border:'1px solid #e2e8f0' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:10 }}>EDIT DETAIL OUTLET</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    {[
                      { label:'Nama PIC Pemesan', key:'pic_name', ph:'Nama penanggung jawab' },
                      { label:'No HP PIC Pemesan', key:'pic_phone', ph:'08xx...' },
                      { label:'No. Telp Outlet', key:'phone', ph:'021-xxxx / 08xx...' },
                      { label:'Alamat', key:'address', ph:'Alamat lengkap...' },
                      { label:'Jam Operasional', key:'jam_operasional', ph:'10:00 - 21:00' },
                    ].map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:4 }}>{f.label}</div>
                        <input value={editForm[f.key]||''} onChange={e => setEditForm(p => ({...p, [f.key]: e.target.value}))} style={S.input} placeholder={f.ph} />
                      </div>
                    ))}
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:4 }}>Catatan Khusus</div>
                      <input value={editForm.notes||''} onChange={e => setEditForm(p => ({...p, notes: e.target.value}))} style={S.input} placeholder="Misal: parkir di basement..." />
                    </div>
                  </div>
                  <div style={{ marginTop:10, display:'flex', gap:8 }}>
                    <Btn onClick={() => saveEdit(o.id)} disabled={saving} color="#1C1208">{saving ? 'Menyimpan...' : '✅ Simpan'}</Btn>
                    <button onClick={() => setEditId(null)} style={{ padding:'8px 14px', background:'none', border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', fontSize:12 }}>Batal</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
