import React, { useRef, useState } from 'react';
import './SystemSettings.css';

import {
  downloadFarmBackup,
  decryptBackupFile,
  restoreFarmData,
} from '../../utils/backupUtils';

function SystemSettings() {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  // ============================================================
  // DOWNLOAD BACKUP
  // ============================================================

  const handleExportBackup = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await downloadFarmBackup();

      setSuccessMessage(
        'Backup encrypted and downloaded successfully. Save the file somewhere safe.'
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        'System Error: Failed to create the farm backup.'
      );
    }
  };

  // ============================================================
  // RESTORE BACKUP
  // ============================================================

  const handleImportRestore = (event) => {
    setSuccessMessage('');
    setErrorMessage('');

    const uploadedFile = event.target.files[0];

    if (!uploadedFile) {
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = async (loadEvent) => {
      try {
        const parsedPackage = JSON.parse(
          loadEvent.target.result
        );

        // Decrypt and validate first.
        // Nothing is deleted at this stage.
        const decryptedBackup =
          await decryptBackupFile(parsedPackage);

        const confirmed = window.confirm(
          `This backup belongs to "${decryptedBackup.farmName}".\n\n` +
          'Restoring it will replace the current farm records on this device.\n\n' +
          'Your device license will NOT be changed.\n\n' +
          'Do you want to continue?'
        );

        if (!confirmed) {
          return;
        }

        restoreFarmData(decryptedBackup);

        setSuccessMessage(
          'System restored successfully. Reloading the application...'
        );

        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (error) {
        console.error(error);

        setErrorMessage(
          error.message ||
          'Restore failed. The backup file may be damaged or invalid.'
        );
      }

      // Allow the same file to be selected again later.
      event.target.value = '';
    };

    fileReader.onerror = () => {
      setErrorMessage(
        'Could not read the selected backup file.'
      );

      event.target.value = '';
    };

    fileReader.readAsText(uploadedFile);
  };

  // ============================================================
  // EMERGENCY WIPE
  // ============================================================

  const handleEmergencySystemWipe = () => {
    const firstConfirm = window.confirm(
      'EMERGENCY RESET:\n\n' +
      'Are you absolutely sure you want to completely erase ALL farm records on this device?\n\n' +
      'This cannot be undone.'
    );

    if (!firstConfirm) {
      return;
    }

    const secondaryConfirm = window.prompt(
      'Type RESET to confirm permanent erasure:'
    );

    if (secondaryConfirm === 'RESET') {

      // These are the same data keys used by the backup system.
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
      ];

      dairyKeys.forEach((key) => {
        localStorage.removeItem(key);
      });

      alert(
        'Farm records have been wiped. Your device license remains active.'
      );

      window.location.reload();

    } else {
      alert(
        'Wipe cancelled. Confirmation text did not match.'
      );
    }
  };

  return (
    <div className="settings-page-container">

      {/* SUCCESS MESSAGE */}

      {successMessage && (
        <div className="settings-alert alert-success">
          {successMessage}
        </div>
      )}

      {/* ERROR MESSAGE */}

      {errorMessage && (
        <div className="settings-alert alert-danger">
          {errorMessage}
        </div>
      )}

      {/* =====================================================
          BACKUP
      ====================================================== */}

      <div className="settings-card-box">

        <div className="settings-icon-header">
          <h2>Manual Data Backup</h2>
        </div>

        <p>
          Create an encrypted backup containing your herd,
          milk production, breeding, feed, health and financial
          records.
        </p>

        <p>
          Save the backup file somewhere safe, such as Google
          Drive or another storage device.
        </p>

        <button
          type="button"
          className="settings-action-btn export-btn"
          onClick={handleExportBackup}
        >
          Download Farm Backup File
        </button>

      </div>

      {/* =====================================================
          RESTORE
      ====================================================== */}

      <div className="settings-card-box">

        <div className="settings-icon-header">
          <h2>Manual Data Restore</h2>
        </div>

        <p>
          Restore farm records from a previously created
          encrypted backup file.
        </p>

        <p>
          The backup must belong to this farm.
        </p>

        <button
          type="button"
          className="settings-action-btn restore-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload & Restore Backup File
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportRestore}
          style={{ display: 'none' }}
        />

      </div>

      {/* =====================================================
          EMERGENCY RESET
      ====================================================== */}

      <div className="settings-card-box danger-zone-box">

        <div className="settings-icon-header">
          <h2 style={{ color: '#c0392b' }}>
            Emergency Reset
          </h2>
        </div>

        <p>
          Completely clear the farm records stored on this
          device.
        </p>

        <p>
          Your device license will remain active.
        </p>

        <button
          type="button"
          className="settings-action-btn wipe-btn"
          onClick={handleEmergencySystemWipe}
        >
          Permanently Wipe Farm Data
        </button>

      </div>

    </div>
  );
}

export default SystemSettings;