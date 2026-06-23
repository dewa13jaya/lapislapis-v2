import { useState, useEffect } from 'react';

// ─── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6).toUpperCase();
export const today = () => new Date().toISOString().slice(0,10);
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
export const fmtMoney = (n) => 'Rp ' + Number(n||0).toLocaleString('id-ID');

// ─── ROLE ACCESS ──────────────────────────────────────────────────────────────
export const ROLE_ACCESS = {
  admin:    { stok:true, order_create:true, order_status:true, suratjalan:true, master:true, staff:true, reports:true, activitylog:true },
  produksi: { stok:true, order_create:false, order_status:true, suratjalan:true, master:false, staff:false, reports:false, activitylog:false },
  sales:    { stok:false, order_create:true, order_status:false, suratjalan:false, master:false, staff:false, reports:false, activitylog:false },
};

export const canAccess = (user, feature) => {
  if (!user) return false;
  return ROLE_ACCESS[user.role]?.[feature] || false;
};

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
export const S = {
  // fontSize:16 pada input penting — mencegah iOS auto-zoom saat focus
  input: { width:'100%', padding:'11px 14px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:16, outline:'none', boxSizing:'border-box', background:'#fff', color:'#111', fontFamily:'inherit', colorScheme:'light' },
  btn:   { padding:'12px 22px', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:15, fontWeight:600 },
  btnSm: { padding:'9px 14px', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 },
  th:    { padding:'11px 12px', textAlign:'left', fontSize:12, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' },
  td:    { padding:'11px 12px', fontSize:14 },
  label: { fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:6 },
  card:  { background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' },
};

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
export const STATUS_CFG = {
  pending:          { bg:'#FBF5DF', text:'#6B5418', label:'Pending' },
  confirmed:        { bg:'#dbeafe', text:'#1e40af', label:'Dikonfirmasi' },
  packed:           { bg:'#ede9fe', text:'#5b21b6', label:'Dipacking' },
  delivered:        { bg:'#d1fae5', text:'#065f46', label:'Terkirim' },
  partial_delivered:{ bg:'#fff7ed', text:'#9a3412', label:'Partial Terkirim' },
  rejected:         { bg:'#fee2e2', text:'#991b1b', label:'Ditolak' },
  cancelled:        { bg:'#f1f5f9', text:'#475569', label:'Dibatalkan' },
};

export const ROLE_CFG = {
  admin:            { bg:'#FBF5DF', text:'#6B5418', label:'Admin' },
  kepala_produksi:  { bg:'#ede9fe', text:'#5b21b6', label:'Kepala Produksi' },
  produksi:         { bg:'#dbeafe', text:'#1e40af', label:'Produksi' },
  kepala_sales:     { bg:'#d1fae5', text:'#14532d', label:'Kepala Sales' },
  sales:            { bg:'#dcfce7', text:'#166534', label:'Sales' },
};

export const REJECT_REASONS = ['Kualitas tidak sesuai','Kelebihan stok','Salah produk','Expired/mendekati expired','Kerusakan pengiriman','Lainnya'];
export const DEFECT_REASONS = ['Rusak saat produksi','Gagal QC','Expired di gudang','Kerusakan penyimpanan','Lainnya'];
export const RETUR_REASONS  = ['Kualitas tidak sesuai','Kelebihan stok','Expired/mendekati expired','Salah kirim','Lainnya'];
