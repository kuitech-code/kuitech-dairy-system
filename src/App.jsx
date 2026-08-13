import React, { useState, useEffect } from 'react';
import Dashboard from './Pages/Dashboard/Dashboard';
import MilkLog from './Pages/Milk/MilkLog';
import Cows from './Pages/Cows/Cows';
import CowProfile from './Pages/Cows/CowProfile';
import BreedingLog from './Pages/Breeding/BreedingLog';
import FeedLog from './Pages/Feed/FeedLog';
import HealthLog from './Pages/Health/HealthLog';
import FinancialLedger from './Pages/Finance/FinancialLedger';
import SystemSettings from './Pages/Settings/SystemSettings';
import LoginScreen from './components/LoginScreen';
import './App.css';

function App() {
  // App Visibility View States
  const [currentScreen, setCurrentScreen] = useState('Dashboard');
  const [selectedCowId, setSelectedCowId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // 🔒 SECURITY GATEWAYS VALIDATION STATES - INITIALIZE FROM LOCALSTORAGE TO PREVENT FLICKER
  const [isLicensed, setIsLicensed] = useState(localStorage.getItem('dairy_app_license_verified') === 'true');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [farmNameInput, setFarmNameInput] = useState('');
  const [farmBrandingLogo, setFarmBrandingLogo] = useState(localStorage.getItem('dairy_farm_branding_logo_text') || 'GreenField Dairy');

  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(localStorage.getItem('dairy_terms_accepted') === 'true');
  
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('dairy_current_user_session') ? true : false);
  const [currentUserProfile, setCurrentUserProfile] = useState(localStorage.getItem('dairy_current_user_session') || 'Admin Operator');
  const [sessionWarningVisible, setSessionWarningVisible] = useState(false);

  // Empty effect - states now load immediately from localStorage
  useEffect(() => {
    // Pre-hydration complete - no flicker needed
  }, []);

  // ===== SESSION TIMEOUT EFFECT =====
  // This effect monitors user inactivity and auto-logs them out after 30 minutes
  useEffect(() => {
    if (!isLoggedIn) return; // Only monitor when logged in

    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    const WARNING_TIME = 28 * 60 * 1000; // Show warning at 28 minutes (2 min before timeout)
    let timeoutTimer = null;
    let warningTimer = null;

    const resetTimers = () => {
      // Clear existing timers
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (warningTimer) clearTimeout(warningTimer);
      setSessionWarningVisible(false);

      // Set new warning timer (at 28 minutes)
      warningTimer = setTimeout(() => {
        setSessionWarningVisible(true);
      }, WARNING_TIME);

      // Set new timeout timer (at 30 minutes)
      timeoutTimer = setTimeout(() => {
        // Auto-logout the user
        localStorage.removeItem('dairy_current_user_session');
        localStorage.removeItem('dairy_session_start_time');
        setIsLoggedIn(false);
        setSessionWarningVisible(false);
        alert('⏱️ Your session has expired due to inactivity. Please log in again.');
      }, SESSION_TIMEOUT);

      // Update session start time
      localStorage.setItem('dairy_session_start_time', Date.now().toString());
    };

    // Reset timers on user activity (mouse click, keyboard press, touch)
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimers);
    });

    // Initial timer setup
    resetTimers();

    // Cleanup: remove event listeners when component unmounts
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimers);
      });
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (warningTimer) clearTimeout(warningTimer);
    };
  }, [isLoggedIn]);

  const handleVerifyLicenseAndBrand = (e) => {
    e.preventDefault();
    if (licenseKeyInput.trim() === 'KUI-Q2W3E-2026') {
      const definedBrandingText = farmNameInput.trim() || 'My Dairy Farm';
      localStorage.setItem('dairy_app_license_verified', 'true');
      localStorage.setItem('dairy_farm_branding_logo_text', definedBrandingText);
      
      setFarmBrandingLogo(definedBrandingText);
      setIsLicensed(true);
    } else {
      alert('❌ Invalid Activation Key! Please contact Kuitech.');
    }
  };

  const handleAcceptTermsOfUseDoc = () => {
    localStorage.setItem('dairy_terms_accepted', 'true');
    setHasAcceptedTerms(true);
  };

  const handleLogOutSessionAction = () => {
    localStorage.removeItem('dairy_current_user_session'); // Wipe active profile token
    setIsLoggedIn(false);
    setIsMenuOpen(false);
    setCurrentScreen('Dashboard');
    alert('🚪 Terminal session locked safely. Operator signed out.');
  };

  // --- INTERRUPT LAYER 1: DEVICE HARDWARE ACCREDITATION ---
  if (!isLicensed) {
    return (
      <div className="license-block-screen">
        <div className="license-modal-card">
          <h2>🔒 Register Device License</h2>
          <p>This management terminal is unregistered. Input your license key and define your farm name to activate the device database.</p>
          <form onSubmit={handleVerifyLicenseAndBrand}>
            <input type="text" placeholder="LICENSE KEY" value={licenseKeyInput} onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())} required />
            <input type="text" placeholder="Farm Name" value={farmNameInput} onChange={(e) => setFarmNameInput(e.target.value)} required style={{ marginTop: '4px' }} />
            <button type="submit" style={{ marginTop: '8px', backgroundColor: '#16a085' }}>Activate</button>
          </form>
        </div>
      </div>
    );
  }

  // INTERRUPT LAYER 2: ONE-TIME TERMS OF USE LEGAL AGREEMENT
  if (!hasAcceptedTerms) {
    return (
      <div className="license-block-screen" style={{ backgroundColor: '#2c3e50' }}>
        <div className="license-modal-card" style={{ maxWidth: '350px', textAlign: 'left' }}>
          <h2 style={{ color: '#27ae60', textAlign: 'center', marginBottom: '10px' }}>End-User Terms of Use</h2>
          <div className="terms-scroller-box-pane" style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '11px', color: '#5d6d7e', border: '1px solid #eaeded', padding: '8px', borderRadius: '6px', marginBottom: '12px', lineHeight: '1.4' }}>
            <p style={{ marginTop: 0 }}><strong>1. Ownership of Offline Data:</strong> All farm logs, metrics, financial accounting sheets and herd profiles are stored 100% locally inside this smartphone hardware. The developer holds zero remote access or network liability for data preservation.</p>
            <p><strong>2. Manual Backup Responsibility:</strong> It is the exclusive operational duty of the farm manager to use the System Settings console to export routine weekly backup snapshots to protect against mechanical hardware losses or physical theft.</p>
            <p><strong>3. Financial Integrity:</strong> Financial summaries are calculations derived from manual entries. Typos must be modified instantly inside the ledger edit sub-drawers to prevent retroactive accounting variances.</p>
          </div>
          <button type="button" onClick={handleAcceptTermsOfUseDoc} style={{ width: '100%', padding: '12px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            I Agree, Launch Application
          </button>
        </div>
      </div>
    );
  }

  // LAYER 3: EVERY SESSION OPERATOR PROFILE PASSCODE LOCK
  if (!isLoggedIn) {
    return (
      <LoginScreen 
        onLoginSuccess={(verifiedOperatorName) => {
          setCurrentUserProfile(verifiedOperatorName);
          setIsLoggedIn(true);
        }} 
      />
    );
  }

  return (
    <div className="app-mobile-shell">
      
      {/* SESSION TIMEOUT WARNING MODAL */}
      {sessionWarningVisible && (
        <div className="session-warning-overlay">
          <div className="session-warning-modal">
            <h2>⏱️ Session Expiring Soon</h2>
            <p>Your session will expire in 2 minutes due to inactivity. Click anywhere to continue working.</p>
            <button 
              onClick={() => setSessionWarningVisible(false)}
              style={{ 
                width: '100%', 
                padding: '12px', 
                backgroundColor: '#27ae60', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}
      
      {/* 1. MASTER HEADFLOATING HEADER BAR CONTAINER */}
      <header className="main-app-top-header" style={{ backgroundColor: '#16a085' }}>
        <div className="farmer-branding-logo">
          <span>{farmBrandingLogo}</span> {/* DYNAMIC LOGO INCORPORATION LINKED FROM VERIFICATION INPUT */}
        </div>
        <button type="button" className="hamburger-menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</button>
      </header>

      {isMenuOpen && <div className="drawer-overlay" onClick={() => setIsMenuOpen(false)}></div>}

      {/* 2. SLIDING DRAWER MENU CONTAINER */}
      <nav className={`slide-out-navigation-drawer ${isMenuOpen ? 'open' : ''}`}>
        <div className="drawer-header-branding" style={{ backgroundColor: '#11816b' }}>
          <h3>Dairy Farm System V1</h3>
          {/* DYNAMIC ACCOUNT USERNAME STRING DISCLOSURE CARD LINKED FROM LOGIN SCREEN */}
          <p>Active Operator: <strong>{currentUserProfile}</strong></p>
        </div>
        
        <div className="drawer-links-stack">
          <button type="button" className={currentScreen === 'Dashboard' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('Dashboard'); setIsMenuOpen(false); }}>Dashboard Overview</button>
          <button type="button" className={currentScreen === 'Milk Production' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('Milk Production'); setIsMenuOpen(false); }}>Milk Production</button>
          <button type="button" className={currentScreen === 'Cow Registry' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('Cow Registry'); setSelectedCowId(null); setIsMenuOpen(false); }}>Herd Registry</button>
          <button type="button" className={currentScreen === 'Breeding Log' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('Breeding Log'); setIsMenuOpen(false); }}>Breeding & AI</button>
          <button type="button" className={currentScreen === 'Feed Log' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('Feed Log'); setIsMenuOpen(false); }}>Feed Allocation</button>
          <button type="button" className={currentScreen === 'Health Log' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('Health Log'); setIsMenuOpen(false); }}>Medical & Health</button>
          <button type="button" className={currentScreen === 'Financial Ledger' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('Financial Ledger'); setIsMenuOpen(false); }}>Financial Ledger</button>
          <button type="button" className={currentScreen === 'System Settings' ? 'nav-anchor active' : 'nav-anchor'} onClick={() => { setCurrentScreen('System Settings'); setIsMenuOpen(false); }}>Settings</button>
        </div>

        <div className="drawer-footer-logout">
          {/* 🔒 CLOSES PASSCODE SESSIONS AND FORCES TERMINAL LOCK ON ACCIDENTAL TAPS */}
          <button type="button" className="logout-action-btn" onClick={handleLogOutSessionAction}>Log Out</button>
        </div>
      </nav>

      {/* 3. CORE VIEWPORT CONTAINER HUB */}
      <main className="master-app-content-viewport">
        {currentScreen === 'Dashboard' && <Dashboard />}
        {currentScreen === 'Milk Production' && <MilkLog />}
        {currentScreen === 'Breeding Log' && <BreedingLog />}
        {currentScreen === 'Feed Log' && <FeedLog />}
        {currentScreen === 'Health Log' && <HealthLog />}
        {currentScreen === 'Financial Ledger' && <FinancialLedger />}
        {currentScreen === 'System Settings' && <SystemSettings />}

        {currentScreen === 'Cow Registry' && (
          <div className="registry-flow-container">
            {selectedCowId === null ? (
              <Cows onSelectCow={(id) => setSelectedCowId(id)} />
            ) : (
              <CowProfile cowId={selectedCowId} onBackToList={() => setSelectedCowId(null)} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
