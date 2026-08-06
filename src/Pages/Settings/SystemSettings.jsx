import React, { useState } from 'react';
import './SystemSettings.css';

function SystemSettings() {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- KEY KEYS KEYS LIST WE WANT TO BACK UP ---
  const dairyKeys = [
    'dairy_herd',
    'dairy_milk_logs',
    'dairy_feed_receipts',
    'dairy_feed_catalog',
    'dairy_health_logs',
    'dairy_breeding_events',
    'dairy_pregnancies',
    'dairy_manual_incomes',
    'dairy_manual_expenses',
    'dairy_global_milk_price',
    'dairy_app_license_verified'
  ];

  // --- 📤 ENGINE 1: EXPORT MANUAL BACKUP FILE ---
  const handleExportBackup = () => {
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const backupData = {};
      
      // Pull every array from localStorage and nest it into a single object
      dairyKeys.forEach(key => {
        const value = localStorage.getItem(key);
        backupData[key] = value ? JSON.parse(value) : null;
      });

      // Convert the object into a downloadable text string
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      
      // Create a nice filename with today's date
      const dateStamp = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `GreenField_Dairy_Backup_${dateStamp}.json`);
      
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click(); // Trigger the download window on the phone
      downloadAnchor.remove();

      setSuccessMessage('📤 Backup file generated and downloaded successfully! Save this file somewhere safe.');
    } catch (err) {
      setErrorMessage('❌ System Error: Failed to generate backup package.');
      console.error(err);
    }
  };

  // --- 📥 ENGINE 2: IMPORT MANUAL RESTORE FILE ---
  const handleImportRestore = (e) => {
    setSuccessMessage('');
    setErrorMessage('');
    
    const fileReader = new FileReader();
    const uploadedFile = e.target.files[0];

    if (!uploadedFile) return;

    fileReader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        
        // Safety Verification Check: Make sure it's an actual dairy app backup file
        const hasHerdKey = 'dairy_herd' in parsedData;
        if (!hasHerdKey) {
          setErrorMessage('❌ File Rejection: This file is not a valid GreenField Dairy backup package.');
          return;
        }

        if (window.confirm('⚠️ WARNING: Restoring this backup will completely overwrite all current records on this phone. Do you want to proceed?')) {
          // Unpack each key and write it directly into localStorage memory
          Object.keys(parsedData).forEach(key => {
            if (dairyKeys.includes(key) && parsedData[key] !== null) {
              localStorage.setItem(key, JSON.stringify(parsedData[key]));
            }
          });

          setSuccessMessage('🎉 System Restored Successfully! All historical records are active.');
          setTimeout(() => {
            window.location.reload(); // Reload app to update all active UI grids instantly
          }, 1500);
        }
      } catch (err) {
        setErrorMessage('❌ Parse Error: The file appears to be corrupted or invalid.');
      }
    };

    fileReader.readAsText(uploadedFile);
  };

  // --- 🗑️ ENGINE 3: SYSTEM RESET EMERGENCY WIPE ---
  const handleEmergencySystemWipe = () => {
    if (window.confirm('🚨 EMERGENCY RESET: Are you absolutely sure you want to completely erase ALL records on this device? This cannot be undone!')) {
      const secondaryConfirm = window.prompt('Type the word RESET to confirm permanent erasure:');
      
      if (secondaryConfirm === 'RESET') {
        // Clear only our farm keys, leaving the device license intact if wanted
        dairyKeys.forEach(key => {
          if (key !== 'dairy_app_license_verified') {
            localStorage.removeItem(key);
          }
        });
        alert('🗑️ Device databases wiped clean.');
        window.location.reload();
      } else {
        alert('Wipe cancelled. Confirmation text did not match.');
      }
    }
  };

  return (
    <div className="settings-page-container">
      
      {/* SUCCESS/ERROR NOTIFICATION BANNERS */}
      {successMessage && <div className="settings-alert alert-success">{successMessage}</div>}
      {errorMessage && <div className="settings-alert alert-danger">{errorMessage}</div>}

      {/* CARD 1: BACKUP ENGINE */}
      <div className="settings-card-box">
        <div className="settings-icon-header">
          <h2>Manual Data Backup</h2>
        </div>
        <p>
          Download a secure snapshot file containing your entire herd directory, milk logs, breeding histories and financial statements. 
          We recommend saving this file to your Google Drive, email, or a separate device once a week.
        </p>
        <button type="button" className="settings-action-btn export-btn" onClick={handleExportBackup}>
          Download Farm Backup File
        </button>
      </div>

      {/* CARD 2: RESTORE ENGINE */}
      <div className="settings-card-box">
        <div className="settings-icon-header">
          <h2>Manual Data Restore</h2>
        </div>
        <p>
          Load your historical records onto a new smartphone device or roll back mistakes by selecting a previously exported <code>.json</code> backup file.
        </p>
        
        <label className="settings-file-picker-label">
          Select Backup File
          <input 
            type="file" 
            accept=".json" 
            onChange={handleImportRestore} 
            style={{ display: 'none' }} 
          />
        </label>
      </div>

      {/* CARD 3: DANGER DESTRUCTIVE MANAGEMENT WIPE ZONE */}
      <div className="settings-card-box danger-zone-box">
        <div className="settings-icon-header">
          <h2 style={{ color: '#c0392b' }}>Emergency Reset</h2>
        </div>
        <p>
          Completely clear the phone database memory and reset the terminal back to a fresh, blank slate. 
          This will delete all cows, production grids and logs permanently.
        </p>
        <button type="button" className="settings-action-btn wipe-btn" onClick={handleEmergencySystemWipe}>
          Permanently Wipe All Device Data
        </button>
      </div>

    </div>
  );
}

export default SystemSettings;
