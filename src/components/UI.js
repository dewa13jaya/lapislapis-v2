import { STATUS_CFG, ROLE_CFG, S } from '../utils';

export function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { bg:'#f3f4f6', text:'#374151', label: status };
  return <span style={{ background:c.bg, color:c.text, padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>{c.label}</span>;
}

export function RoleBadge({ role }) {
  const c = ROLE_CFG[role] || { bg:'#f3f4f6', text:'#374151', label: role };
  return <span style={{ background:c.bg, color:c.text, padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700 }}>{c.label}</span>;
}

export function Toast({ msg }) {
  if (!msg) return null;
  const isErr = msg.startsWith('❌');
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background: isErr ? '#fee2e2':'#d1fae5', color: isErr ? '#991b1b':'#065f46', padding:'12px 20px', borderRadius:10, fontWeight:600, fontSize:13, boxShadow:'0 4px 12px rgba(0,0,0,.15)', maxWidth:340 }}>
      {msg}
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>{icon || '📭'}</div>
      <div style={{ fontSize:14, fontWeight:600, color:'#64748b' }}>{title}</div>
      {subtitle && <div style={{ fontSize:12, marginTop:4 }}>{subtitle}</div>}
    </div>
  );
}

export function SectionCard({ title, children, action }) {
  return (
    <div style={S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#1C1208' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function FormRow({ children, cols = 2 }) {
  return <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:12, marginBottom:12 }}>{children}</div>;
}

export function FieldGroup({ label, children }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, color='#1C1208', small, disabled, style={} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...(small ? S.btnSm : S.btn), background: disabled ? '#94a3b8' : color, opacity: disabled ? .7 : 1, ...style }}>
      {children}
    </button>
  );
}

export function DataTable({ headers, rows, emptyText='Belum ada data' }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ background:'#f8f7f4' }}>
            {headers.map((h,i) => <th key={i} style={{ ...S.th, textAlign: h.right ? 'right' : h.center ? 'center' : 'left' }}>{h.label || h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>{emptyText}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ ...S.td, textAlign: headers[j]?.right ? 'right' : headers[j]?.center ? 'center' : 'left' }}>{cell}</td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
