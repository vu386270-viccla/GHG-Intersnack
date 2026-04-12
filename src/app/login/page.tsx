'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Invalid credentials or unauthorized access.');
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'url(/bg-sustainability.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      zIndex: 9999, // Guarantees it covers layout margins/sidebar gaps
    }}>
      {/* Premium dark gradient overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(5,150,105,0.4) 100%)',
        zIndex: 1
      }} />

      <div style={{
        width: 440,
        padding: '56px 48px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 24,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
        zIndex: 2,
        color: '#fff',
        position: 'relative'
      }}>
        {/* Glow effect behind the card */}
        <div style={{
           position: 'absolute', width: 250, height: 250, 
           background: '#10b981', filter: 'blur(100px)', 
           opacity: 0.15, top: '10%', left: '20%', zIndex: -1, borderRadius: '50%'
        }} />

        {/* Corporate Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 28,
            boxShadow: '0 12px 28px rgba(16,185,129,0.3), inset 0 2px 0 rgba(255,255,255,0.2)',
          }}>🌿</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
            Intersnack Group
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Enterprise GHG Dashboard
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@intersnack.com"
              required
              style={{
                width: '100%', padding: '14px 16px', boxSizing: 'border-box',
                background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, color: '#fff', fontSize: 15, outline: 'none',
                transition: 'all 0.25s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.background = 'rgba(0,0,0,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(0,0,0,0.25)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '14px 16px', boxSizing: 'border-box',
                background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, color: '#fff', fontSize: 15, outline: 'none',
                transition: 'all 0.25s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.background = 'rgba(0,0,0,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(0,0,0,0.25)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 10, marginBottom: 20,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              backdropFilter: 'blur(10px)'
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 12,
              background: loading ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', fontWeight: 700, fontSize: 15, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', letterSpacing: '0.5px',
              boxShadow: loading ? 'none' : '0 8px 20px rgba(16,185,129,0.4)',
              position: 'relative', overflow: 'hidden'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
          SBTi Commitment #40003759
        </div>
      </div>
    </div>
  );
}

