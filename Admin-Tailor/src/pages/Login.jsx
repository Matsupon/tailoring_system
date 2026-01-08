import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../api';
import '../styles/Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/admin/login', {
        email,
        password
      });

      if (response.data.token) {
        console.log("SAVING TOKEN:", response.data.token);
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminData', JSON.stringify({
          email: response.data.admin.email,
          fullname: response.data.admin.fullname
        }));
        
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__bg">
        <div className="login-page__gradient-layer" />
      </div>
      <div className="login-page__content">
        <div className="login-brand page-enter">
          <img 
            src="/logo.png" 
            alt="Jun Tailoring Logo" 
            className="login-brand__logo"
          />
          <h2 className="login-brand__title">Jun Tailoring</h2>
        </div>
        <div className="login-card">
          <h1>Login</h1>
          <p className="subtitle">Login to continue to your account</p>

          {error && (
            <div className="error-message" style={{
              backgroundColor: '#fee',
              color: '#c33',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <div className="password-label-container">
                <label htmlFor="password">Password</label>
              </div>
              <div className="password-input-container">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEye /> : < FaEyeSlash />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;