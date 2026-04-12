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
      window.location.href = '/'; // Hard redirect to ensure middleware sees correct cookies
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      /* Corporate clean background with subtle warmth */
      background: 'url(/bg-sustainability.png) center/cover no-repeat',
      fontFamily: 'Inter, system-ui, sans-serif',
      zIndex: 9999, // Guarantees it covers layout margins/sidebar gaps
    }}>
      {/* Light overlay to match corporate clean style */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1
      }} />

      <div style={{
        zIndex: 2,
        width: 460,
        padding: '56px 48px',
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        borderTop: '6px solid #E30613', // Intersnack Corporate Red
        color: '#1a1a1a',
        position: 'relative'
      }}>
        {/* Corporate Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img 
            src="/intersnack-logo.jpg" 
            alt="Intersnack Group Logo" 
            style={{ width: '180px', height: 'auto', display: 'inline-block', marginBottom: '24px' }} 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#1a1a1a', textTransform: 'uppercase' }}>
            Intersnack Cashew Vietnam
          </h1>
          <p style={{ fontSize: 13, color: '#e30613', marginTop: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Enterprise GHG Dashboard
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4a4a4a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Ex: admin@icc.com"
              required
              style={{
                width: '100%', padding: '14px 16px', boxSizing: 'border-box',
                background: '#f9f9f9', border: '1px solid #e0e0e0',
                borderRadius: 8, color: '#1a1a1a', fontSize: 15, outline: 'none',
                transition: 'all 0.25s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#e30613'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(227,6,19,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#e0e0e0'; e.target.style.background = '#f9f9f9'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4a4a4a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
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
                background: '#f9f9f9', border: '1px solid #e0e0e0',
                borderRadius: 8, color: '#1a1a1a', fontSize: 15, outline: 'none',
                transition: 'all 0.25s ease',
              }}
              onFocus={e => { e.target.style.borderColor = '#e30613'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(227,6,19,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#e0e0e0'; e.target.style.background = '#f9f9f9'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 20,
              background: '#fff5f5', border: '1px solid #ffebea',
              color: '#d32f2f', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              fontWeight: 500
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 8,
              background: loading ? '#e0e0e0' : '#e30613',
              color: loading ? '#9e9e9e' : '#fff', fontWeight: 700, fontSize: 15, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', letterSpacing: '0.5px',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(227,6,19,0.25)',
              position: 'relative', overflow: 'hidden'
            }}
            onMouseOver={(e) => { if(!loading) e.currentTarget.style.background = '#c20511'; }}
            onMouseOut={(e) => { if(!loading) e.currentTarget.style.background = '#e30613'; }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 11.5, color: '#666', marginBottom: 8 }}>
            If you need help logging in, contact: <strong>Vu.Huynh</strong>
          </div>
          <div style={{ fontSize: 11, color: '#9e9e9e', fontWeight: 500 }}>
            SBTi ID #40003759
          </div>
        </div>
      </div>
    </div>
  );
}

