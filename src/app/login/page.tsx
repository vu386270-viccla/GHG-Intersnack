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
      minHeight: '100vh', display: 'flex',
      backgroundColor: '#f6f3f2', /* Light earthy grey/white */
      fontFamily: 'Inter, Arial, sans-serif',
      position: 'relative',
      backgroundImage: 'url(/bg-sustainability.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      {/* Light overlay to maintain corporate clean look over the dark generated bg */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px)',
        zIndex: 1
      }} />

      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          width: 420, padding: '48px 40px',
          background: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
          borderTop: '4px solid #e30613' /* Intersnack Red Corporate Stripe */
        }}>
          {/* Corporate Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ 
              fontSize: 26, fontWeight: 800, color: '#1c1b1b', 
              letterSpacing: '-0.5px', margin: '0 0 8px 0',
              textTransform: 'uppercase'
            }}>
              Intersnack
            </h1>
            <div style={{ 
              fontSize: 14, color: '#5e3f3b', fontWeight: 500,
              borderBottom: '1px solid #eae7e7', paddingBottom: 16
            }}>
              Sustainability & Emissions Portal
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: 'block', fontSize: 12, fontWeight: 700, 
                color: '#313030', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' 
              }}>
                Corporate Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@intersnack.com"
                required
                style={{
                  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
                  background: '#fcf9f8', border: '1px solid #dcd9d9',
                  borderRadius: 4, color: '#1c1b1b', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = '#e30613'; e.target.style.backgroundColor = '#ffffff'; }}
                onBlur={e => { e.target.style.borderColor = '#dcd9d9'; e.target.style.backgroundColor = '#fcf9f8'; }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ 
                display: 'block', fontSize: 12, fontWeight: 700, 
                color: '#313030', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' 
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
                  background: '#fcf9f8', border: '1px solid #dcd9d9',
                  borderRadius: 4, color: '#1c1b1b', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = '#e30613'; e.target.style.backgroundColor = '#ffffff'; }}
                onBlur={e => { e.target.style.borderColor = '#dcd9d9'; e.target.style.backgroundColor = '#fcf9f8'; }}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 4, marginBottom: 20,
                background: '#fff5f3', border: '1px solid #e9bcb6',
                color: '#b5000b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 4,
                background: loading ? '#eae7e7' : '#e30613',
                color: loading ? '#5e3f3b' : '#ffffff', 
                fontWeight: 600, fontSize: 14, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s', letterSpacing: '0.5px'
              }}
              onMouseEnter={e => { if(!loading) (e.target as HTMLElement).style.background = '#b5000b'; }}
              onMouseLeave={e => { if(!loading) (e.target as HTMLElement).style.background = '#e30613'; }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={{ 
            marginTop: 32, textAlign: 'center', fontSize: 11, 
            color: '#936e69', display: 'flex', flexDirection: 'column', gap: 4
          }}>
            <span>Science Based Targets initiative (SBTi)</span>
            <span>Commitment Target #40003759</span>
          </div>
        </div>
      </div>
    </div>
  );
}

