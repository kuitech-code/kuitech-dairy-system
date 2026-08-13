import React, { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import './LoginScreen.css';

function LoginScreen({ onLoginSuccess }) {
  // ===== SCREEN FLOW STATES =====
  const [screenMode, setScreenMode] = useState('login');
  
  // ===== LOGIN SCREEN INPUTS =====
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // ===== SETUP SCREEN INPUTS (First-time users) =====
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupError, setSetupError] = useState('');

  // ===== PASSWORD RESET INPUTS =====
  const [resetUsername, setResetUsername] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');

  // Load last username for convenience
  useEffect(() => {
    const savedUsername = localStorage.getItem('dairy_last_operator_name');
    if (savedUsername) setUsername(savedUsername);
  }, []);

  // ========================================
  // 🔐 AUTHENTICATION HELPER FUNCTIONS
  // ========================================

  const hashPassword = async (plainPassword) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(plainPassword, salt);
  };

  const verifyPassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
  };

  const getStoredUser = () => {
    const userData = localStorage.getItem('dairy_user_account_data');
    if (!userData) return null;
    try {
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  };

  // ========================================
  // LOGIN LOGIC
  // ========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('❌ Please enter both username and password');
      return;
    }

    const user = getStoredUser();

    if (!user) {
      setError('❌ Account not found. Please create an account first.');
      return;
    }

    if (user.username !== username.trim()) {
      setError('❌ Username does not exist.');
      return;
    }

    const isPasswordCorrect = await verifyPassword(password, user.passwordHash);
    
    if (isPasswordCorrect) {
      localStorage.setItem('dairy_last_operator_name', username);
      localStorage.setItem('dairy_current_user_session', username);
      localStorage.setItem('dairy_session_start_time', Date.now().toString());
      onLoginSuccess(username);
    } else {
      setError('❌ Incorrect password. Please try again.');
    }
  };

  // ========================================
  // FIRST-TIME SETUP LOGIC
  // ========================================
  const handleSetupAccount = async (e) => {
    e.preventDefault();
    setSetupError('');

    if (!newUsername.trim()) {
      setSetupError('❌ Please enter a username');
      return;
    }
    if (newPassword.length < 6) {
      setSetupError('❌ Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSetupError('❌ Passwords do not match');
      return;
    }

    const existingUser = getStoredUser();
    if (existingUser) {
      setSetupError('❌ An account already exists. Log in instead.');
      return;
    }

    try {
      const hashedPassword = await hashPassword(newPassword);
      const userData = {
        username: newUsername.trim(),
        passwordHash: hashedPassword,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem('dairy_user_account_data', JSON.stringify(userData));
      localStorage.setItem('dairy_last_operator_name', newUsername);
      localStorage.setItem('dairy_current_user_session', newUsername);
      localStorage.setItem('dairy_session_start_time', Date.now().toString());
      
      onLoginSuccess(newUsername);
    } catch (err) {
      setSetupError('❌ Error creating account. Please try again.');
    }
  };

  // ========================================
  // PASSWORD RESET LOGIC
  // ========================================
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');

    if (!resetUsername.trim()) {
      setResetError('❌ Please enter your username');
      return;
    }
    if (resetPassword.length < 6) {
      setResetError('❌ Password must be at least 6 characters long');
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError('❌ Passwords do not match');
      return;
    }

    const user = getStoredUser();

    if (!user || user.username !== resetUsername.trim()) {
      setResetError('❌ Username not found');
      return;
    }

    try {
      const hashedPassword = await hashPassword(resetPassword);
      const updatedUser = {
        ...user,
        passwordHash: hashedPassword
      };

      localStorage.setItem('dairy_user_account_data', JSON.stringify(updatedUser));
      setResetError('');
      alert('✅ Password reset successfully! Please log in with your new password.');
      setScreenMode('login');
      setResetUsername('');
      setResetPassword('');
      setResetConfirm('');
    } catch (err) {
      setResetError('❌ Error resetting password. Please try again.');
    }
  };

  // ========================================
  // RENDER SCREENS
  // ========================================

  if (screenMode === 'login') {
    return (
      <div className="login-full-screen-cover">
        <div className="login-modal-card-box animate-fade">
          <div className="login-branding-icon">🔐</div>
          <h2>Farm Operator Login</h2>
          <p className="login-subtext-meta">Secure access to your dairy management system.</p>

          {error && <div className="login-error-banner">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="login-input-wrapper-field">
              <label>Username</label>
              <input 
                type="text" 
                placeholder="Enter your username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                required 
              />
            </div>

            <div className="login-input-wrapper-field">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="login-submit-btn">Sign In</button>
          </form>

          <div className="login-footer-links">
            <button 
              type="button"
              className="link-btn"
              onClick={() => setScreenMode('setup')}
            >
              Create New Account
            </button>
            <button 
              type="button"
              className="link-btn"
              onClick={() => setScreenMode('reset')}
            >
              Forgot Password?
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screenMode === 'setup') {
    return (
      <div className="login-full-screen-cover">
        <div className="login-modal-card-box animate-fade">
          <div className="login-branding-icon">📝</div>
          <h2>Create Account</h2>
          <p className="login-subtext-meta">Set up your farm operator account (first-time only).</p>

          {setupError && <div className="login-error-banner">{setupError}</div>}

          <form onSubmit={handleSetupAccount}>
            <div className="login-input-wrapper-field">
              <label>Choose a Username</label>
              <input 
                type="text" 
                placeholder="e.g. alex_njeri" 
                value={newUsername} 
                onChange={(e) => setNewUsername(e.target.value)}
                required 
              />
            </div>

            <div className="login-input-wrapper-field">
              <label>Create a Password (min 6 characters)</label>
              <input 
                type="password" 
                placeholder="••••" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                required 
              />
            </div>

            <div className="login-input-wrapper-field">
              <label>Confirm Password</label>
              <input 
                type="password" 
                placeholder="••••" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="login-submit-btn">Create Account</button>
          </form>

          <button 
            type="button"
            className="link-btn"
            onClick={() => setScreenMode('login')}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (screenMode === 'reset') {
    return (
      <div className="login-full-screen-cover">
        <div className="login-modal-card-box animate-fade">
          <div className="login-branding-icon">🔄</div>
          <h2>Reset Password</h2>
          <p className="login-subtext-meta">Create a new password for your account.</p>

          {resetError && <div className="login-error-banner">{resetError}</div>}

          <form onSubmit={handleResetPassword}>
            <div className="login-input-wrapper-field">
              <label>Username</label>
              <input 
                type="text" 
                placeholder="Enter your username" 
                value={resetUsername} 
                onChange={(e) => setResetUsername(e.target.value)}
                required 
              />
            </div>

            <div className="login-input-wrapper-field">
              <label>New Password (min 6 characters)</label>
              <input 
                type="password" 
                placeholder="••••" 
                value={resetPassword} 
                onChange={(e) => setResetPassword(e.target.value)}
                required 
              />
            </div>

            <div className="login-input-wrapper-field">
              <label>Confirm Password</label>
              <input 
                type="password" 
                placeholder="••••" 
                value={resetConfirm} 
                onChange={(e) => setResetConfirm(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="login-submit-btn">Reset Password</button>
          </form>

          <button 
            type="button"
            className="link-btn"
            onClick={() => setScreenMode('login')}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }
}

export default LoginScreen;
