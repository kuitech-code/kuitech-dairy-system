import { useState } from 'react';
import bcrypt from 'bcryptjs';
import './LoginScreen.css';

const USER_STORAGE_KEY = 'dairy_user_account_data';

function LoginScreen({ onLoginSuccess }) {
  // ========================================
  // SCREEN FLOW
  // ========================================
  const [screenMode, setScreenMode] = useState('login');

  // ========================================
  // LOGIN
  // ========================================
  const [username, setUsername] = useState(
    () => localStorage.getItem('dairy_last_operator_name') || ''
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ========================================
  // ACCOUNT SETUP
  // ========================================
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupError, setSetupError] = useState('');

  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);

  // ========================================
  // PASSWORD RECOVERY
  // ========================================
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // ========================================
  // AUTH HELPERS
  // ========================================

  const getStoredUser = () => {
    const userData = localStorage.getItem(USER_STORAGE_KEY);

    if (!userData) {
      return null;
    }

    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('Could not read stored account:', error);
      return null;
    }
  };

  const hashValue = async (value) => {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(value, salt);
  };

  const verifyValue = async (value, hash) => {
    if (!value || !hash) {
      return false;
    }

    return await bcrypt.compare(value, hash);
  };

  // ========================================
  // RECOVERY CODE GENERATOR
  // ========================================

  const generateRecoveryCode = () => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let code = '';

    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
  };

  // ========================================
  // START SESSION
  // ========================================

  const startSession = (operatorUsername) => {
    localStorage.setItem(
      'dairy_last_operator_name',
      operatorUsername
    );

    localStorage.setItem(
      'dairy_current_user_session',
      operatorUsername
    );

    localStorage.setItem(
      'dairy_session_start_time',
      Date.now().toString()
    );

    onLoginSuccess(operatorUsername);
  };

  // ========================================
  // LOGIN
  // ========================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      const cleanUsername = username.trim();

      if (!cleanUsername || !password) {
        setError('Please enter both username and password.');
        return;
      }

      const user = getStoredUser();

      if (!user) {
        setError(
          'No farm operator account exists yet. Please create an account first.'
        );
        return;
      }

      if (
        user.username.toLowerCase() !==
        cleanUsername.toLowerCase()
      ) {
        setError('Username or password is incorrect.');
        return;
      }

      const passwordCorrect = await verifyValue(
        password,
        user.passwordHash
      );

      if (!passwordCorrect) {
        setError('Username or password is incorrect.');
        return;
      }

      // Successful login
      startSession(user.username);

    } catch (error) {
      console.error('Login error:', error);
      setError('Something went wrong while signing in.');
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // ACCOUNT SETUP
  // ========================================

  const handleSetupAccount = async (e) => {
    e.preventDefault();

    setSetupError('');

    if (!newUsername.trim()) {
      setSetupError('Please enter a username.');
      return;
    }

    if (newUsername.trim().length < 3) {
      setSetupError('Username must be at least 3 characters long.');
      return;
    }

    if (newPassword.length < 8) {
      setSetupError(
        'Password must be at least 8 characters long.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setSetupError('Passwords do not match.');
      return;
    }

    const existingUser = getStoredUser();

    if (existingUser) {
      setSetupError(
        'An account already exists. Please sign in instead.'
      );
      return;
    }

    try {
      setIsLoading(true);

      const recoveryCode = generateRecoveryCode();

      const passwordHash = await hashValue(newPassword);
      const recoveryHash = await hashValue(recoveryCode);

      const userData = {
        username: newUsername.trim(),
        passwordHash,
        recoveryHash,
        createdAt: new Date().toISOString(),
        passwordChangedAt: new Date().toISOString(),
      };

      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(userData)
      );

      setGeneratedRecoveryCode(recoveryCode);
      setSetupComplete(true);

    } catch (error) {
      console.error('Account creation error:', error);

      setSetupError(
        'Could not create the account. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // FINISH ACCOUNT SETUP
  // ========================================

  const finishSetup = () => {
    const user = getStoredUser();

    if (!user) {
      setSetupComplete(false);
      setScreenMode('login');
      return;
    }

    setUsername(user.username);
    setPassword('');
    setGeneratedRecoveryCode('');
    setSetupComplete(false);
    setScreenMode('login');
  };

  // ========================================
  // PASSWORD RECOVERY
  // ========================================

  const handlePasswordRecovery = async (e) => {
    e.preventDefault();

    setRecoveryError('');

    if (!recoveryUsername.trim()) {
      setRecoveryError('Please enter your username.');
      return;
    }

    if (!recoveryCode.trim()) {
      setRecoveryError('Please enter your recovery code.');
      return;
    }

    if (recoveryPassword.length < 8) {
      setRecoveryError(
        'New password must be at least 8 characters long.'
      );
      return;
    }

    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);

      const user = getStoredUser();

      if (!user) {
        setRecoveryError('Account not found.');
        return;
      }

      if (
        user.username.toLowerCase() !==
        recoveryUsername.trim().toLowerCase()
      ) {
        setRecoveryError('Account not found.');
        return;
      }

      // Older accounts created before recovery codes existed
      if (!user.recoveryHash) {
        setRecoveryError(
          'This account does not have a recovery code configured. Please contact the farm system administrator.'
        );
        return;
      }

      const recoveryCorrect = await verifyValue(
        recoveryCode.trim().toUpperCase(),
        user.recoveryHash
      );

      if (!recoveryCorrect) {
        setRecoveryError('Invalid recovery code.');
        return;
      }

      const newPasswordHash = await hashValue(
        recoveryPassword
      );

      const updatedUser = {
        ...user,
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date().toISOString(),
      };

      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(updatedUser)
      );

      // Clear recovery form
      setRecoveryUsername('');
      setRecoveryCode('');
      setRecoveryPassword('');
      setRecoveryConfirm('');
      setRecoveryError('');

      alert(
        'Password changed successfully. Please sign in with your new password.'
      );

      setScreenMode('login');

    } catch (error) {
      console.error('Password recovery error:', error);

      setRecoveryError(
        'Could not change the password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // LOGIN SCREEN
  // ========================================

  if (screenMode === 'login') {
    return (
      <div className="login-full-screen-cover">

        <div className="login-modal-card-box animate-fade">

          <div className="login-branding-icon e">
            🔐
          </div>

          <h2>Farm Operator Login</h2>

          <p className="login-subtext-meta">
            Secure access to your dairy management system.
          </p>

          {error && (
            <div className="login-error-banner">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            <div className="login-input-wrapper-field">

              <label>Username</label>

              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />

            </div>

            <div className="login-input-wrapper-field">

              <label>Password</label>

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

          </form>

          <div className="login-footer-links">

            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setError('');
                setScreenMode('setup');
              }}
            >
              Create New Account
            </button>

            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setRecoveryError('');
                setScreenMode('recovery');
              }}
            >
              Forgot Password?
            </button>

          </div>

        </div>

      </div>
    );
  }

  // ========================================
  // ACCOUNT SETUP SCREEN
  // ========================================

  if (screenMode === 'setup') {

    // ----------------------------------------
    // RECOVERY CODE DISPLAY
    // ----------------------------------------

    if (setupComplete) {
      return (
        <div className="login-full-screen-cover">

          <div className="login-modal-card-box recovery-code-card animate-fade">

            <div className="login-branding-icon e">
              🔑
            </div>

            <h2>Account Created</h2>

            <p className="login-subtext-meta">
              Your farm operator account has been created.
            </p>

            <div className="recovery-warning-box">
              <strong>IMPORTANT</strong>

              <p>
                Write this recovery code down and keep it somewhere
                safe. It is required if the operator forgets the
                password.
              </p>

              <p>
                This code will not be shown again.
              </p>
            </div>

            <div className="recovery-code-display">
              {generatedRecoveryCode}
            </div>

            <button
              type="button"
              className="login-submit-btn"
              onClick={finishSetup}
            >
              I've Saved My Recovery Code
            </button>

          </div>

        </div>
      );
    }

    // ----------------------------------------
    // SETUP FORM
    // ----------------------------------------

    return (
      <div className="login-full-screen-cover">

        <div className="login-modal-card-box animate-fade">

          <div className="login-branding-icon e">
            📝
          </div>

          <h2>Create Account</h2>

          <p className="login-subtext-meta">
            Create the farm operator account.
          </p>

          {setupError && (
            <div className="login-error-banner">
              {setupError}
            </div>
          )}

          <form onSubmit={handleSetupAccount}>

            <div className="login-input-wrapper-field">

              <label>Choose a Username</label>

              <input
                type="text"
                placeholder="e.g. alex_njeri"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoComplete="username"
                required
              />

            </div>

            <div className="login-input-wrapper-field">

              <label>Password</label>

              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

            </div>

            <div className="login-input-wrapper-field">

              <label>Confirm Password</label>

              <input
                type="password"
                placeholder="Enter password again"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                autoComplete="new-password"
                required
              />

            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading}
            >
              {isLoading
                ? 'Creating Account...'
                : 'Create Account'}
            </button>

          </form>

          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSetupError('');
              setScreenMode('login');
            }}
          >
            Back to Login
          </button>

        </div>

      </div>
    );
  }

  // ========================================
  // PASSWORD RECOVERY SCREEN
  // ========================================

  if (screenMode === 'recovery') {
    return (
      <div className="login-full-screen-cover">

        <div className="login-modal-card-box animate-fade">

          <div className="login-branding-icon e">
            🔄
          </div>

          <h2>Recover Account</h2>

          <p className="login-subtext-meta">
            Use the recovery code provided when the account was created.
          </p>

          {recoveryError && (
            <div className="login-error-banner">
              {recoveryError}
            </div>
          )}

          <form onSubmit={handlePasswordRecovery}>

            <div className="login-input-wrapper-field">

              <label>Username</label>

              <input
                type="text"
                placeholder="Enter your username"
                value={recoveryUsername}
                onChange={(e) =>
                  setRecoveryUsername(e.target.value)
                }
                autoComplete="username"
                required
              />

            </div>

            <div className="login-input-wrapper-field">

              <label>Recovery Code</label>

              <input
                type="text"
                placeholder="XXXX-XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) =>
                  setRecoveryCode(
                    e.target.value.toUpperCase()
                  )
                }
                autoComplete="off"
                required
              />

            </div>

            <div className="login-input-wrapper-field">

              <label>New Password</label>

              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={recoveryPassword}
                onChange={(e) =>
                  setRecoveryPassword(e.target.value)
                }
                autoComplete="new-password"
                required
              />

            </div>

            <div className="login-input-wrapper-field">

              <label>Confirm New Password</label>

              <input
                type="password"
                placeholder="Enter password again"
                value={recoveryConfirm}
                onChange={(e) =>
                  setRecoveryConfirm(e.target.value)
                }
                autoComplete="new-password"
                required
              />

            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading}
            >
              {isLoading
                ? 'Changing Password...'
                : 'Change Password'}
            </button>

          </form>

          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setRecoveryError('');
              setScreenMode('login');
            }}
          >
            Back to Login
          </button>

        </div>

      </div>
    );
  }

  return null;
}

export default LoginScreen;