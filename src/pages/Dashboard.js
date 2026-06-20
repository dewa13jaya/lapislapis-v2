import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/UI';
import { fmtDate, today, STATUS_CFG, useIsMobile } from '../utils';

// ── Chart helpers ──────────────────────────────────────────────────────────────

function BarChart({ data, color = '#3b82f6', height = 120 }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.v), 1);
  const w = 300, h = height, pad = { l: 28, r: 8, t: 8, b: 32 };
  const bw = (w - pad.l - pad.r) / data.length;
  const bap = 6; // bar apparent width
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }}>
      {/* Y gridlines */}
      {[0, 0.5, 1].map(frac => {
        const y = pad.t + (1 - frac) * (h - pad.t - pad.b);
        return (
          <g key={frac}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.l - 4} y={y + 4} fontSize={8} fill="#94a3b8" textAnchor="end">{Math.round(frac * max)}</text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const bh = Math.max(2, ((d.v / max) * (h - pad.t - pad.b)));
        const x = pad.l + i * bw + (bw - bap) / 2;
        const y = h - pad.b - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bap} height={bh} rx={2} fill={color} opacity={0.85} />
            {d.v > 0 && <text x={x + bap / 2} y={y - 3} fontSize={8} fill={color} textAnchor="middle" fontWeight="700">{d.v}</text>}
            <text x={pad.l + i * bw + bw / 2} y={h - pad.b + 12} fontSize={8} fill="#64748b" textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data, size = 120 }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  if (!total) return <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>Belum ada order hari ini</div>;
  const cx = size / 2, cy = size / 2, r = size * 0.38, ir = size * 0.24;
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.v / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const li = sweep > Math.PI ? 1 : 0;
    return { ...d, x1, y1, x2, y2, li, sweep, x1i: cx + ir * Math.cos(angle - sweep), y1i: cy + ir * Math.sin(angle - sweep), x2i: cx + ir * Math.cos(angle), y2i: cy + ir * Math.sin(angle) };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {slices.map((s, i) => s.sweep > 0.01 && (
        <path key={i} d={`M ${s.x1i} ${s.y1i} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.li} 1 ${s.x2} ${s.y2} L ${s.x2i} ${s.y2i} A ${ir} ${ir} 0 ${s.li} 0 ${s.x1i} ${s.y1i} Z`} fill={s.color} opacity={0.9} />
      ))}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.18} fontWeight="800" fill="#1C1208">{total}</text>
      <text x={cx} y={cy + size * 0.16} textAnchor="middle" fontSize={size * 0.08} fill="#64748b">order</text>
    </svg>
  );
}

function HBarChart({ data, max }) {
  const W = 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <div style={{ fontSize: 11, color: '#374151', fontWeight: 600, minWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</div>
            <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(d.v / max) * 100}%`, height: '100%', background: `hsl(${210 - i * 30}, 75%, 55%)`, borderRadius: 99, minWidth: d.v ? 4 : 0 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', minWidth: 28, textAlign: 'right' }}>{d.v}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard({ products, currentStock, orders, stockIn, returns, outlets, stockOut }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const todayStr = today();
  const STATUS_COLORS = {
    pending:           '#B49A35',
    confirmed:         '#3b82f6',
    packed:            '#8b5cf6',
    delivered:         '#10b981',
    partial_delivered: '#0ea5e9',
    cancelled:         '#ef4444',
    rejected:          '#dc2626',
  };

  // ── Stat cards ───────────────────────────────────────────────────────────────
  const pendingOrders  = orders.filter(o => o.status === 'pending').length;
  const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
  const packedOrders   = orders.filter(o => o.status === 'packed').length;
  const todayOrders    = orders.filter(o => o.created_at?.slice(0, 10) === todayStr).length;
  const deliveredToday = orders.filter(o => o.status === 'delivered' && o.updated_at?.slice(0, 10) === todayStr).length;
  const lowStock  = products.filter(p => { const s = currentStock[p.id] || 0; return s > 0 && s <= (p.stok_minimum || 5); }).length;
  const emptyStock = products.filter(p => (currentStock[p.id] || 0) <= 0).length;

  const cards = [
    { label: 'Menunggu Konfirmasi', value: pendingOrders,   icon: '⏳', color: '#B49A35', sub: 'order pending' },
    { label: 'Proses Produksi',     value: confirmedOrders, icon: '🔨', color: '#3b82f6', sub: 'dikonfirmasi' },
    { label: 'Siap Dikirim',        value: packedOrders,    icon: '📦', color: '#8b5cf6', sub: 'packed' },
    { label: 'Stok Butuh Perhatian',value: lowStock + emptyStock, icon: '⚠️', color: '#ef4444', sub: `${emptyStock} habis · ${lowStock} hampir habis` },
  ];

  // ── Trend 4 minggu terakhir ───────────────────────────────────────────────
  const trendData = (() => {
    const now = new Date(todayStr);
    return [3, 2, 1, 0].map(weeksAgo => {
      const end = new Date(now); end.setDate(end.getDate() - weeksAgo * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      const endStr = end.toISOString().slice(0, 10);
      const startStr = start.toISOString().slice(0, 10);
      const count = orders.filter(o => {
        const d = o.created_at?.slice(0, 10) || '';
        return d >= startStr && d <= endStr;
      }).length;
      const label = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      return { label, v: count };
    });
  })();

  // ── Status donut (hari ini) ───────────────────────────────────────────────
  const todayOrdersList = orders.filter(o => o.created_at?.slice(0, 10) === todayStr);
  const statusGroups = Object.entries(
    todayOrdersList.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {})
  ).map(([status, v]) => ({ label: STATUS_CFG[status]?.label || status, v, color: STATUS_COLORS[status] || '#94a3b8' }));

  // ── Top 5 produk terlaris (dari order_items semua orders) ────────────────
  const top5 = (() => {
    const totals = {};
    orders.forEach(o => {
      (o.order_items || []).forEach(item => {
        if (!['cancelled','rejected'].includes(o.status)) {
          totals[item.product_id] = (totals[item.product_id] || 0) + Number(item.qty_delivered ?? item.qty ?? 0);
        }
      });
    });
    return Object.entries(totals)
      .map(([pid, v]) => ({ label: products.find(p => p.id === pid)?.name || pid, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 5);
  })();
  const top5max = top5[0]?.v || 1;

  // ── Stok warning list ────────────────────────────────────────────────────
  const stockWarnings = products
    .map(p => ({ ...p, saldo: currentStock[p.id] || 0 }))
    .filter(p => p.saldo <= (p.stok_minimum || 5))
    .sort((a, b) => a.saldo - b.saldo);

  // ── Recent orders (today or latest 5) ────────────────────────────────────
  const recentOrders = [...orders].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);

  // ── WhatsApp Recap ────────────────────────────────────────────────────────
  const sendWhatsAppRecap = () => {
    const tgl = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const lines = [];
    lines.push(`📊 *REKAP LAPISLAPIS*`);
    lines.push(`📅 ${tgl}`);
    lines.push('');
    lines.push(`*STATUS ORDER:*`);
    lines.push(`⏳ Pending      : ${pendingOrders} order`);
    lines.push(`🔨 Konfirmasi   : ${confirmedOrders} order`);
    lines.push(`📦 Siap Kirim   : ${packedOrders} order`);
    lines.push(`✅ Dikirim Hari Ini : ${deliveredToday} order`);
    lines.push('');
    if (stockWarnings.length > 0) {
      lines.push(`*⚠️ STOK PERLU PERHATIAN (${stockWarnings.length} produk):*`);
      stockWarnings.slice(0, 8).forEach(p => {
        lines.push(`• ${p.name}: ${p.saldo <= 0 ? '❌ HABIS' : `⚡ ${p.saldo} ${p.unit}`}`);
      });
      if (stockWarnings.length > 8) lines.push(`• ...dan ${stockWarnings.length - 8} produk lainnya`);
    } else {
      lines.push(`✅ Semua stok aman`);
    }
    if (top5.length > 0) {
      lines.push('');
      lines.push(`*🏆 TOP PRODUK:*`);
      top5.forEach((p, i) => lines.push(`${i+1}. ${p.label} (${p.v})`));
    }
    lines.push('');
    lines.push(`_Dikirim dari LAPISLAPIS System_`);
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontWeight: 800, color: '#1C1208' }}>Dashboard</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>📅 {new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
          <button onClick={sendWhatsAppRecap} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#25D366', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.12 1.524 5.855L.057 23.882a.5.5 0 0 0 .606.61l6.157-1.615A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.877 9.877 0 0 1-5.032-1.378l-.36-.214-3.733.979.997-3.645-.235-.374A9.869 9.869 0 0 1 2.106 12C2.106 6.533 6.533 2.106 12 2.106S21.894 6.533 21.894 12 17.467 21.894 12 21.894z"/></svg>
            Kirim Rekap WA
          </button>
        </div>
      </div>

      {/* ── Alert stok habis ── */}
      {emptyStock > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div>
            <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 13 }}>{emptyStock} produk stok habis!</div>
            <div style={{ fontSize: 11, color: '#b91c1c' }}>{products.filter(p => (currentStock[p.id] || 0) <= 0).map(p => p.name).join(' · ')}</div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 8 : 12, marginBottom: 16 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${c.color}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28, lineHeight: 1 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginTop: 2 }}>{c.label}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Trend 4 minggu */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1208' }}>📈 Trend Order (4 Minggu)</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>per minggu</div>
          </div>
          <div style={{ height: 120 }}>
            <BarChart data={trendData} color="#3b82f6" height={120} />
          </div>
        </div>

        {/* Status donut hari ini */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1208', marginBottom: 12 }}>🥧 Status Order Hari Ini</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutChart data={statusGroups} size={100} />
            <div style={{ flex: 1 }}>
              {statusGroups.length === 0
                ? <div style={{ fontSize: 11, color: '#94a3b8' }}>Belum ada order hari ini</div>
                : statusGroups.map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: s.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: '#374151', flex: 1 }}>{s.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.v}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Top 5 produk terlaris */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1208', marginBottom: 12 }}>🏆 Top 5 Produk Terlaris</div>
          {top5.length === 0
            ? <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>Belum ada data order</div>
            : <HBarChart data={top5} max={top5max} />
          }
        </div>

        {/* Stok warning */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1208' }}>⚠️ Stok Perlu Perhatian</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{stockWarnings.length} produk</div>
          </div>
          {stockWarnings.length === 0
            ? <div style={{ fontSize: 12, color: '#10b981', textAlign: 'center', padding: 20 }}>✅ Semua stok aman</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {stockWarnings.map(p => {
                const isEmpty = p.saldo <= 0;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: isEmpty ? '#fee2e2' : '#FBF5DF' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isEmpty ? '#991b1b' : '#6B5418' }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isEmpty ? '#ef4444' : '#B49A35' }}>{p.saldo} {p.unit}</span>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: isEmpty ? '#ef4444' : '#B49A35', color: '#fff', fontWeight: 700 }}>{isEmpty ? 'HABIS' : 'TIPIS'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      </div>

      {/* ── Recent Orders ── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1208' }}>🛒 Order Terbaru</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>6 terakhir</div>
        </div>
        {recentOrders.length === 0
          ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>Belum ada order</div>
          : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 8 }}>
            {recentOrders.map(o => {
              const outlet = outlets.find(x => x.id === o.outlet_id);
              return (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f7f4', borderRadius: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1208' }}>{o.order_no}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{outlet?.name || '-'} · {fmtDate(o.created_at)}</div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
}
