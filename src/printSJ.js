import { fmtDate } from './utils';

// ── Surat Jalan Sementara (sebelum pengiriman / status confirmed/packed) ──────
// Hanya berisi: Qty Pesan + Qty Kirim. Tanpa info reject.
function fmtDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,'0');
  const mn = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mn}`;
}

export function printSJSementara(order, products, outlets, staff = []) {
  const outlet   = outlets.find(o => o.id === order.outlet_id) || {};
  const orderer  = staff.find(s => s.id === order.created_by) || {};
  const rows = (order.order_items || []).map((item, idx) => {
    const p = products.find(x => x.id === item.product_id) || {};
    const qtyKirim = item.qty_delivered ?? item.qty;
    return `<tr>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:8px">${p.name || '-'}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${p.unit || '-'}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.qty}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center"><b>${qtyKirim}</b></td>
    </tr>`;
  }).join('');
  const emptyRows = Array(Math.max(0, 5 - (order.order_items || []).length))
    .fill(`<tr>${Array(5).fill('<td style="border:1px solid #ccc;padding:10px">&nbsp;</td>').join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Surat Jalan ${order.order_no}</title>
<style>
  @page{margin:18mm} body{font-family:Arial,sans-serif;font-size:12px;color:#111}
  h1{font-size:20px;margin:0;letter-spacing:2px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#1C1208;color:#fff;padding:8px;text-align:center;border:1px solid #ccc;font-size:11px}
  .ttd{display:flex;justify-content:space-between;margin-top:40px}
  .ttd-box{text-align:center;width:150px}
  .ttd-line{border-top:1px solid #333;margin-top:56px;padding-top:4px;font-size:11px}
  .sj-badge{display:inline-block;background:#FBF5DF;color:#6B5418;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:bold;border:1px solid #B49A35;margin-top:4px}
  @media print{.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 20px;background:#1C1208;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨️ Cetak</button>
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1C1208;padding-bottom:10px;margin-bottom:10px">
  <div><h1>LAPISLAPIS</h1><div style="font-size:11px;color:#555">Kemayoran, Jakarta Pusat</div></div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:bold;color:#1C1208">SURAT JALAN</div>
    <div class="sj-badge">📋 SEMENTARA</div>
    <div style="font-size:14px;font-weight:bold;margin-top:4px">${order.order_no}</div>
    <div style="font-size:11px;color:#555;margin-top:2px">Tgl Kirim: ${fmtDate(order.delivery_date)}</div>
  </div>
</div>
<table style="border:none;margin-bottom:4px">
  <tr>
    <td style="padding:3px 0;width:50%"><b>Tujuan</b> : ${outlet.name || '-'}</td>
    <td style="padding:3px 0"><b>Driver</b> : ${order.driver_name || '________________'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>Alamat</b> : ${outlet.address || '-'}</td>
    <td style="padding:3px 0"><b>Kendaraan</b> : ${order.vehicle_no || '________________'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>No. Telp Outlet</b> : ${outlet.phone || '-'}</td>
    <td style="padding:3px 0"><b>Pemesan</b> : ${orderer.name || order.created_by_name || '________________'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>Tgl Pesan</b> : ${fmtDateTime(order.created_at)}</td>
    <td style="padding:3px 0"><b>No. HP Pemesan</b> : ${orderer.phone || '________________'}</td>
  </tr>
</table>
<table>
  <thead><tr>
    <th style="width:35px">No.</th>
    <th>Nama Produk</th>
    <th style="width:60px">Satuan</th>
    <th style="width:80px">Qty Pesan</th>
    <th style="width:80px">Qty Kirim</th>
  </tr></thead>
  <tbody>${rows}${emptyRows}</tbody>
</table>
<div style="margin-top:8px;font-size:11px;color:#555">Catatan: ${order.notes || '-'}</div>
<div class="ttd">
  <div class="ttd-box"><div class="ttd-line">Dibuat oleh<br><small>(Tim Produksi)</small></div></div>
  <div class="ttd-box"><div class="ttd-line">Driver/Pengirim</div></div>
  <div class="ttd-box"><div class="ttd-line">Diterima oleh<br><small>(${outlet.name || 'Outlet'})</small></div></div>
</div>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ── Surat Jalan Final (setelah pengiriman / status delivered/partial_delivered) ─
// Berisi: Qty Pesan + Qty Terkirim + Qty Reject + Alasan.
export function printSJFinal(order, products, outlets, staff = []) {
  const outlet   = outlets.find(o => o.id === order.outlet_id) || {};
  const orderer  = staff.find(s => s.id === order.created_by) || {};
  const rows = (order.order_items || []).map((item, idx) => {
    const p = products.find(x => x.id === item.product_id) || {};
    const qtyDel = item.qty_delivered ?? item.qty;
    const qtyRej = item.qty_rejected || 0;
    return `<tr>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:8px">${p.name || '-'}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${p.unit || '-'}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.qty}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center"><b>${qtyDel}</b></td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center;color:#c0392b">${qtyRej > 0 ? qtyRej : '-'}</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:11px">${qtyRej > 0 ? (item.reject_reason || '-') : ''}</td>
    </tr>`;
  }).join('');
  const emptyRows = Array(Math.max(0, 5 - (order.order_items || []).length))
    .fill(`<tr>${Array(7).fill('<td style="border:1px solid #ccc;padding:10px">&nbsp;</td>').join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Surat Jalan Final ${order.order_no}</title>
<style>
  @page{margin:18mm} body{font-family:Arial,sans-serif;font-size:12px;color:#111}
  h1{font-size:20px;margin:0;letter-spacing:2px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#1C1208;color:#fff;padding:8px;text-align:center;border:1px solid #ccc;font-size:11px}
  .ttd{display:flex;justify-content:space-between;margin-top:40px}
  .ttd-box{text-align:center;width:150px}
  .ttd-line{border-top:1px solid #333;margin-top:56px;padding-top:4px;font-size:11px}
  .sj-badge{display:inline-block;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:bold;border:1px solid #10b981;margin-top:4px}
  @media print{.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 20px;background:#1C1208;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨️ Cetak</button>
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1C1208;padding-bottom:10px;margin-bottom:10px">
  <div><h1>LAPISLAPIS</h1><div style="font-size:11px;color:#555">Kemayoran, Jakarta Pusat</div></div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:bold;color:#1C1208">SURAT JALAN</div>
    <div class="sj-badge">✅ FINAL</div>
    <div style="font-size:14px;font-weight:bold;margin-top:4px">${order.order_no}</div>
    <div style="font-size:11px;color:#555;margin-top:2px">Tgl Kirim: ${fmtDate(order.delivery_date)}</div>
  </div>
</div>
<table style="border:none;margin-bottom:4px">
  <tr>
    <td style="padding:3px 0;width:50%"><b>Tujuan</b> : ${outlet.name || '-'}</td>
    <td style="padding:3px 0"><b>Driver</b> : ${order.driver_name || '-'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>Alamat</b> : ${outlet.address || '-'}</td>
    <td style="padding:3px 0"><b>Kendaraan</b> : ${order.vehicle_no || '-'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>No. Telp Outlet</b> : ${outlet.phone || '-'}</td>
    <td style="padding:3px 0"><b>Pemesan</b> : ${orderer.name || order.created_by_name || '________________'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>Tgl Pesan</b> : ${fmtDateTime(order.created_at)}</td>
    <td style="padding:3px 0"><b>No. HP Pemesan</b> : ${orderer.phone || '________________'}</td>
  </tr>
</table>
<table>
  <thead><tr>
    <th style="width:35px">No.</th>
    <th>Nama Produk</th>
    <th style="width:60px">Satuan</th>
    <th style="width:75px">Qty Pesan</th>
    <th style="width:75px">Qty Terkirim</th>
    <th style="width:70px">Qty Reject</th>
    <th>Alasan Reject</th>
  </tr></thead>
  <tbody>${rows}${emptyRows}</tbody>
</table>
<div style="margin-top:8px;font-size:11px;color:#555">Catatan: ${order.notes || '-'}</div>
<div class="ttd">
  <div class="ttd-box"><div class="ttd-line">Dibuat oleh<br><small>(Tim Produksi)</small></div></div>
  <div class="ttd-box"><div class="ttd-line">Driver/Pengirim</div></div>
  <div class="ttd-box"><div class="ttd-line">Diterima oleh<br><small>(${outlet.name || 'Outlet'})</small></div></div>
</div>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ── Helper: pilih versi SJ berdasarkan status order ───────────────────────────
export function printSJ(order, products, outlets, staff = []) {
  if (['delivered', 'partial_delivered', 'rejected'].includes(order.status)) {
    printSJFinal(order, products, outlets, staff);
  } else {
    printSJSementara(order, products, outlets, staff);
  }
}

export function sjLabel(order) {
  if (['delivered', 'partial_delivered', 'rejected'].includes(order.status)) {
    return '🖨️ Cetak SJ Final';
  }
  return '🖨️ Cetak SJ Sementara';
}
