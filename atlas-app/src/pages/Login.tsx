import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setError(error.message);
        } else if (data.session) {
          localStorage.setItem('atlas_token', data.session.access_token);
          localStorage.setItem('atlas_user', email);
          navigate('/');
        } else {
          setError('Registration successful! Please check your email to confirm.');
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setError(error.message);
        } else if (data.session) {
          localStorage.setItem('atlas_token', data.session.access_token);
          localStorage.setItem('atlas_user', email);
          navigate('/');
        } else {
          setError('Invalid login response from server.');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="logo-icon">▲</div>
          <h2>Atlas SOC</h2>
          <p>IoT Security Operations Center</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleAuth} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className={`login-btn ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : (isRegistering ? 'Create Account' : 'Sign In')}
          </button>
        </form>
        <div className="login-footer">
          <p>
            {isRegistering ? 'Already have an account?' : 'Need an account?'}
            {' '}
            <button 
              className="toggle-auth-btn" 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
            >
              {isRegistering ? 'Sign In' : 'Register via Supabase'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
