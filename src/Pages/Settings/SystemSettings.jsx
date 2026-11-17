import React, { useEffect, useRef, useState } from 'react';
import './SystemSettings.css';
import { showAppDialog } from '../../utils/appDialog';

import {
  downloadFarmBackup,
  decryptBackupFile,
  restoreFarmData,
} from '../../utils/backupUtils';

function SystemSettings() {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const fileInputRef = useRef(null);
  const isApplyingUpdateRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let registration;
    let isMounted = true;
    const showWaitingWorker = () => {
      if (isMounted && registration?.waiting) setWaitingWorker(registration.waiting);
    };
    const handleControllerChange = () => {
      if (isApplyingUpdateRef.current) window.location.reload();
    };
    const handleUpdateFound = () => {
      const installingWorker = registration?.installing;
      if (!installingWorker) return;
      const handleStateChange = () => {
        if (installingWorker.state === 'installed') showWaitingWorker();
      };
      installingWorker.addEventListener('statechange', handleStateChange);
    };

    navigator.serviceWorker.getRegistration().then((currentRegistration) => {
      if (!isMounted || !currentRegistration) return;
      registration = currentRegistration;
      showWaitingWorker();
      registration.addEventListener('updatefound', handleUpdateFound);
      if (registration.installing) handleUpdateFound();
      registration.update().catch(() => {});
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      isMounted = false;
      registration?.removeEventListener('updatefound', handleUpdateFound);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [isApplyingUpdate]);

  const handleApplyUpdate = () => {
    if (!waitingWorker) return;
    isApplyingUpdateRef.current = true;
    setIsApplyingUpdate(true);
    waitingWorker.postMessage('SKIP_WAITING');
  };

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

        const confirmed = await showAppDialog({ title: 'Restore farm backup?', type: 'danger', confirmText: 'Restore backup', message:
          `This backup belongs to "${decryptedBackup.farmName}".\n\n` +
          'Restoring it will replace the current farm records on this device.\n\n' +
          'Your device license will NOT be changed.\n\n' +
          'Do you want to continue?'
        });

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

  const handleEmergencySystemWipe = async () => {
    const firstConfirm = await showAppDialog({ title: 'Emergency reset', type: 'danger', confirmText: 'Continue to confirmation', message:
      'EMERGENCY RESET:\n\n' +
      'Are you absolutely sure you want to completely erase ALL farm records on this device?\n\n' +
      'This cannot be undone.'
    });

    if (!firstConfirm) {
      return;
    }

    const secondaryConfirm = await showAppDialog({ title: 'Confirm permanent erasure', type: 'prompt', confirmText: 'Erase farm data', placeholder: 'Type RESET', message: 'This permanently erases farm records on this device. Type RESET to continue.' });

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

      await showAppDialog({ title: 'Farm data erased', message: 'Farm records have been wiped. Your device license remains active.' });

      window.location.reload();

    } else {
      await showAppDialog({ title: 'Reset cancelled', message: 'Confirmation text did not match. No records were erased.' });
    }
  };

  return (
    <div className="settings-page-container">

      {waitingWorker && (
        <div className="settings-update-card" role="status">
          <div>
            <strong>A new app update is ready</strong>
            <p>Update now to use the latest version. Your saved farm records will stay on this device.</p>
          </div>
          <button type="button" className="settings-action-btn update-btn" onClick={handleApplyUpdate} disabled={isApplyingUpdate}>
            {isApplyingUpdate ? 'Updating…' : 'Update app'}
          </button>
        </div>
      )}

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
