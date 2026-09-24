import React, { useEffect, useState } from 'react';
import bcrypt from 'bcryptjs';
import './AccountSecurity.css';

const USER_STORAGE_KEY = 'dairy_user_account_data';

function AccountSecurity() {
  const [username, setUsername] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    const sessionUsername = localStorage.getItem(
      'dairy_current_user_session'
    );

    if (sessionUsername) {
      setUsername(sessionUsername);
    }
  }, []);

  const getStoredUser = () => {
    const userData = localStorage.getItem(USER_STORAGE_KEY);

    if (!userData) {
      return null;
    }

    try {
      return JSON.parse(userData);
    } catch (error) {
      return null;
    }
  };

  const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    setMessage('');
    setError('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setError(
        'New password must be at least 8 characters long.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        'Your new password must be different from your current password.'
      );
      return;
    }

    try {
      setIsChanging(true);

      const user = getStoredUser();

      if (!user) {
        setError(
          'No operator account could be found.'
        );
        return;
      }

      const currentPasswordCorrect =
        await bcrypt.compare(
          currentPassword,
          user.passwordHash
        );

      if (!currentPasswordCorrect) {
        setError('Current password is incorrect.');
        return;
      }

      const newPasswordHash =
        await hashPassword(newPassword);

      const updatedUser = {
        ...user,
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date().toISOString(),
      };

      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(updatedUser)
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setMessage(
        'Password changed successfully.'
      );

    } catch (error) {
      console.error(
        'Password change error:',
        error
      );

      setError(
        'Could not change the password. Please try again.'
      );
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="account-security-page">

      <div className="account-security-card">

        <div className="account-security-header">

          <div className="account-security-icon e">
            🔐
          </div>

          <div>
            <h2>Account Security</h2>

            <p>
              Manage the password used to access this farm system.
            </p>
          </div>

        </div>

        <div className="account-security-user-box">

          <span>Current Operator</span>

          <strong>
            {username || 'Unknown'}
          </strong>

        </div>

        {message && (
          <div className="account-success-message">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="account-error-message">
            {error}
          </div>
        )}

        <form
          onSubmit={handleChangePassword}
          className="account-password-form"
        >

          <div className="account-security-field">

            <label>
              Current Password
            </label>

            <input
              type="password"
              value={currentPassword}
              onChange={(e) =>
                setCurrentPassword(e.target.value)
              }
              autoComplete="current-password"
              placeholder="Enter current password"
              required
            />

          </div>

          <div className="account-security-divider">
            New Password
          </div>

          <div className="account-security-field">

            <label>
              New Password
            </label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              required
            />

          </div>

          <div className="account-security-field">

            <label>
              Confirm New Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              autoComplete="new-password"
              placeholder="Enter password again"
              required
            />

          </div>

          <div className="account-password-rules">

            <div>
              ✓ At least 8 characters
            </div>

            <div>
              ✓ Must be different from the current password
            </div>

            <div>
              ✓ Password is stored as a secure hash
            </div>

          </div>

          <button
            type="submit"
            className="account-change-password-btn"
            disabled={isChanging}
          >
            {isChanging
              ? 'Changing Password...'
              : 'Change Password'}
          </button>

        </form>

        <div className="account-recovery-note">

          <strong>Forgot your password?</strong>

          <p>
            If you are locked out, return to the login screen
            and use the recovery code that was provided when
            the operator account was created.
          </p>

        </div>

      </div>

    </div>
  );
}

export default AccountSecurity;