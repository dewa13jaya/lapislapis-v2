import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [staff, setStaff] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('users_profile').select('id,name,role').eq('is_active', true).order('name')
      .then(({ data }) => setStaff(data || []));
  }, []);

  const handlePinInput = (digit) => {
    if (pin.length < 4) setPin(p => p + digit);
  };

  const handleLogin = async () => {
    if (!selectedId) return setError('Pilih nama kamu dulu');
    if (pin.length < 4) return setError('Masukkan PIN 4 digit');
    setLoading(true);
    setError('');
    const { data } = await supabase.from('users_profile').select('*').eq('id', selectedId).eq('pin', pin).eq('is_active', true).single();
    setLoading(false);
    if (!data) { setPin(''); return setError('PIN salah, coba lagi'); }
    // Log activity
    await supabase.from('activity_log').insert({ id: Date.now().toString(36), user_id: data.id, user_name: data.name, action: 'login', description: `${data.name} login ke sistem` });
    login(data);
  };

  const handleClear = () => setPin('');

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #1C1208 0%, #140F06 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:40, width:'100%', maxWidth:380, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:"'Cinzel', serif", fontWeight:600, fontSize:26, letterSpacing:'0.2em', color:'#B49A35', lineHeight:1, marginBottom:8 }}>LAPISLAPIS</div>
          <div style={{ width:40, height:2, background:'#B49A35', margin:'0 auto 10px', opacity:.45, borderRadius:99 }} />
          <div style={{ fontSize:10, color:'#94a3b8', letterSpacing:'0.2em', fontWeight:600 }}>PRODUCTION & SALES SYSTEM</div>
        </div>

        {/* Select Staff */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>Siapa kamu?</label>
          <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setPin(''); setError(''); }}
            style={{ width:'100%', padding:'11px 14px', border:'2px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', background:'#fff', fontFamily:'inherit', color: selectedId ? '#1C1208' : '#94a3b8' }}>
            <option value=''>-- Pilih nama --</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* PIN Display */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>Masukkan PIN</label>
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:16 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width:52, height:52, borderRadius:12, border: `2px solid ${pin.length > i ? '#B49A35' : '#e2e8f0'}`, background: pin.length > i ? '#FBF5DF' : '#f8f7f4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, transition:'all .15s' }}>
                {pin.length > i ? '●' : ''}
              </div>
            ))}
          </div>

          {/* Numpad */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
              <button key={i} onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d !== '' ? handlePinInput(String(d)) : null}
                disabled={d === ''}
                style={{ padding:'14px', background: d === '⌫' ? '#fee2e2' : d === '' ? 'transparent' : '#f8f7f4', border: d === '' ? 'none' : '2px solid #e2e8f0', borderRadius:10, fontSize: d === '⌫' ? 18 : 20, fontWeight:700, cursor: d === '' ? 'default' : 'pointer', color: d === '⌫' ? '#ef4444' : '#1C1208', transition:'all .1s' }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ background:'#fee2e2', color:'#991b1b', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:16, textAlign:'center', fontWeight:600 }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading || pin.length < 4 || !selectedId}
          style={{ width:'100%', padding:'13px', background: pin.length === 4 && selectedId ? '#1C1208' : '#94a3b8', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor: pin.length === 4 && selectedId ? 'pointer' : 'not-allowed', transition:'all .2s' }}>
          {loading ? 'Memverifikasi...' : 'Masuk →'}
        </button>

        <div style={{ textAlign:'center', marginTop:16, fontSize:11, color:'#94a3b8' }}>
          Hubungi Admin jika lupa PIN
        </div>
      </div>
    </div>
  );
}
