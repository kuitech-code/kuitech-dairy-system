import React, { useState, useEffect } from 'react';
import './HealthLog.css';

function HealthLog() {
  // --- STATE 1: CORE STORAGE ARRAYS ---
  const [activeHerd, setActiveHerd] = useState([]);
  const [healthLedger, setHealthLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- STATE 2: NEW EVENT INPUT FIELDS STATES ---
  const [selectedCowId, setSelectedCowId] = useState('');
  const [administeredBy, setAdministeredBy] = useState('Farmer'); // Farmer vs Vet
  const [treatmentDate, setTreatmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [diagnosis, setDiagnosis] = useState('');
  const [medication, setMedication] = useState(''); // 🔒 Unlocked standard text field
  const [vetName, setVetName] = useState('');
  const [treatmentCost, setTreatmentCost] = useState(''); // Saved in KSh
  const [withdrawalDays, setWithdrawalDays] = useState(''); // Days to dump milk
  const [treatmentStatus, setTreatmentStatus] = useState('One-time'); // One-time vs Chronic

  // --- STATE 3: IN-LINE HUMAN PROOFING EDIT TRACKERS ---
  const [editingLogId, setEditingLogId] = useState(null);
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editWithdrawal, setEditWithdrawal] = useState('');
  const [editStatus, setEditStatus] = useState('One-time');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- STATE 4: SYSTEM UI PAGINATION FLOORS ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // --- ENGINE 1: INITIAL REFRESH MOUNT ---
  useEffect(() => {
    refreshHealthTerminal();
    setLoading(false);
  }, []);

  const refreshHealthTerminal = () => {
    // Load herd list (Excluding any archived dead/sold animals)
    const savedHerd = localStorage.getItem('dairy_herd') || '[]';
    const parsedHerd = JSON.parse(savedHerd);
    const activeCattle = parsedHerd.filter(animal => !animal.status.startsWith('Archived'));
    setActiveHerd(activeCattle);
    
    if (activeCattle.length > 0) {
      setSelectedCowId(activeCattle[0].id.toString());
    }

    // Load master health sheet ledger from memory storage
    const savedLogs = localStorage.getItem('dairy_health_logs') || '[]';
    setHealthLedger(JSON.parse(savedLogs));
  };

  // Find currently chosen animal to dynamically inspect status rules inside the UI elements
  const currentSelectedAnimal = activeHerd.find(c => c.id.toString() === selectedCowId);

  // 🔒 RULE: Milk withdrawal input only appears if animal is a Female capable of producing milk (Milking/Pregnant/Dry/Heifer)
  const isEligibleForMilkingWithdrawal = currentSelectedAnimal && currentSelectedAnimal.gender === 'Female' && currentSelectedAnimal.status !== 'Calf';

  // --- ENGINE 2: DATE CALCULATION SAFETY VALIDATOR ---
  const checkIsWithdrawalActive = (loggedDateStr, daysCount) => {
    if (!daysCount || parseInt(daysCount) === 0) return false;
    const loggedDate = new Date(loggedDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Strip hours for absolute evaluation

    const releaseDate = new Date(loggedDate);
    releaseDate.setDate(releaseDate.getDate() + parseInt(daysCount));
    return today < releaseDate;
  };

  // --- ENGINE 3: SUBMIT TREATMENT SHEET ACTION ---
  const handleLogHealthSubmission = (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // Calendar Ceiling Guard: Block inputting future dates
    if (new Date(treatmentDate) > new Date()) {
      return setErrorMessage('❌ Date Violation: Medical events cannot be logged into future dates.');
    }

    if (!selectedCowId) return setErrorMessage('❌ Selection Error: No animal selected.');
    if (!diagnosis.trim()) return setErrorMessage('❌ Field Error: Diagnosis/Reason field cannot be left blank.');

    const costVal = parseFloat(treatmentCost) || 0;
    // Force withdrawal days to 0 if the animal is a bull or calf
    const daysVal = isEligibleForMilkingWithdrawal ? (parseInt(withdrawalDays) || 0) : 0;

    if (costVal < 0 || daysVal < 0) {
      return setErrorMessage('❌ Numeric Error: Financial costs or withdrawal counts cannot be negative values.');
    }

    // Package payload data row sheet matching your old summary requirements
    const newHealthRecord = {
      id: Date.now(),
      cowId: currentSelectedAnimal.id,
      cowName: currentSelectedAnimal.name,
      cowTag: currentSelectedAnimal.tagNumber,
      administeredBy,
      treatmentDate,
      diagnosis: diagnosis.trim(),
      medication: medication.trim() || 'None Specified',
      vetName: administeredBy === 'Vet' ? (vetName.trim() || 'Private Vet') : 'Farmer / Staff',
      cost: costVal,
      withdrawalDays: daysVal,
      treatmentStatus,
      notes: ''
    };

    const savedLogs = localStorage.getItem('dairy_health_logs');
    const existingLogsArray = savedLogs ? JSON.parse(savedLogs) : [];
    const updatedLogsArray = [newHealthRecord, ...existingLogsArray];

    localStorage.setItem('dairy_health_logs', JSON.stringify(updatedLogsArray));

    // Reset Entry Forms
    setDiagnosis('');
    setMedication('');
    setVetName('');
    setTreatmentCost('');
    setWithdrawalDays('');
    setTreatmentStatus('One-time');
    setCurrentPage(1);

    setSuccessMessage(`🎉 Medical record saved successfully for ${currentSelectedAnimal.name}!`);
    refreshHealthTerminal();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // --- ENGINE 4: HUMAN PROOFING IN-LINE LEDGER REPAIRS ---
  const handleStartInlineEdit = (log) => {
    setEditingLogId(log.id);
    setEditDiagnosis(log.diagnosis);
    setEditCost(log.cost);
    setEditWithdrawal(log.withdrawalDays);
    setEditStatus(log.treatmentStatus);
  };

  const handleSaveInlineAdjustment = (logId, isCowCapableOfMilk) => {
    const costValue = parseFloat(editCost) || 0;
    const daysValue = isCowCapableOfMilk ? (parseInt(editWithdrawal) || 0) : 0;

    if (costValue < 0 || daysValue < 0 || !editDiagnosis.trim()) {
      alert('❌ Entry Violation: Adjustments inputs cannot be negative or blank.');
      return;
    }

    const updatedLogs = healthLedger.map(log => {
      if (log.id === logId) {
        return {
          ...log,
          diagnosis: editDiagnosis.trim(),
          cost: costValue,
          withdrawalDays: daysValue,
          treatmentStatus: editStatus
        };
      }
      return log;
    });

    setHealthLedger(updatedLogs);
    localStorage.setItem('dairy_health_logs', JSON.stringify(updatedLogs));
    setEditingLogId(null);
    alert('✏️ Health ledger record adjusted safely.');
  };

  const handleDeleteRecord = (logId) => {
    if (window.confirm('⚠️ Purge Action: Are you sure you want to permanently delete this health card from device memory?')) {
      const updatedLogs = healthLedger.filter(log => log.id !== logId);
      setHealthLedger(updatedLogs);
      localStorage.setItem('dairy_health_logs', JSON.stringify(updatedLogs));
      alert('🗑️ Record purged safely.');
    }
  };

  // --- ENGINE 5: PAGINATION MATHEMATICS ---
  const totalPages = Math.ceil(healthLedger.length / itemsPerPage) || 1;
  const currentLedgerSlice = healthLedger.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="health-log-page-container">
      
      {/* SECTION 1: LOGGING INPUT PANEL DESK */}
      <div className="health-form-card">
        <h2>💉 Record Treatment & Health Logs</h2>
        
        {successMessage && <div className="health-alert alert-success">{successMessage}</div>}
        {errorMessage && <div className="health-alert alert-danger">{errorMessage}</div>}

        <form onSubmit={handleLogHealthSubmission}>
          
          {/* Administered By Selector Toggle Buttons Box */}
          <div className="admin-toggle-field-row">
            <label className="field-group-label">Who Administered Treatment? *</label>
            <div className="toggle-button-group">
              <button type="button" className={administeredBy === 'Farmer' ? 'toggle-choice active' : 'toggle-choice'} onClick={() => setAdministeredBy('Farmer')}>Farmer / Farm Staff</button>
              <button type="button" className={administeredBy === 'Vet' ? 'toggle-choice active' : 'toggle-choice'} onClick={() => setAdministeredBy('Vet')}>Private Vet / Technician</button>
            </div>
          </div>

          <div className="health-row-grid">
            <div className="health-input-field">
              <label>Select Animal Target *</label>
              {activeHerd.length === 0 ? (
                <select disabled className="disabled-select">
                  <option>⚠️ No active cattle registered in registry pools.</option>
                </select>
              ) : (
                <select value={selectedCowId} onChange={(e) => setSelectedCowId(e.target.value)} required>
                  {activeHerd.map(c => <option key={c.id} value={c.id}>{c.name} (Tag: {c.tagNumber}) • {c.status}</option>)}
                </select>
              )}
            </div>
            <div className="health-input-field">
              <label>Treatment Date *</label>
              <input type="date" value={treatmentDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => setTreatmentDate(e.target.value)} required />
            </div>
          </div>

          <div className="health-row-grid">
            <div className="health-input-field">
              <label>Diagnosis / Reason for Treatment *</label>
              <input type="text" placeholder="e.g. Deworming, Mastitis, Tick Spray" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} required />
            </div>
            <div className="health-input-field">
              <label>Medication Administered *</label>
              {/* 🔒 UNLOCKED STANDARD TEXT INPUT FIELD */}
              <input type="text" placeholder="e.g. Levafas Diamond, Penistrep" value={medication} onChange={(e) => setMedication(e.target.value)} required />
            </div>
          </div>

          <div className="health-row-grid">
            {/* 🔒 CONSTRAINT: Hide Vet Name input box entirely if treatment was self-administered by Farmer */}
            {administeredBy === 'Vet' ? (
              <div className="health-input-field highlighted-vet-entry-box">
                <label>Veterinarian Name *</label>
                <input type="text" placeholder="e.g. Dr. Mwangi" value={vetName} onChange={(e) => setVetName(e.target.value)} required={administeredBy === 'Vet'} />
              </div>
            ) : (
              <div className="health-input-field highlighted-farmer-entry-box">
                <label>Treatment Provider</label>
                <input type="text" value="Self Administration (Staff)" disabled />
              </div>
            )}
            
            <div className="health-input-field">
              {/* 🔒 LOCALIZED CURRENCY SETTING CHANGE: Kenyan Shillings (KSh) */}
              <label>Total Medical Cost (KSh) *</label>
              <input type="number" step="1" placeholder="e.g. 1500" value={treatmentCost} onChange={(e) => setTreatmentCost(e.target.value)} required />
            </div>
          </div>

          <div className="health-row-grid">
            {/* 🔒 STRICT BIOLOGICAL RULES: Milk withdrawal input only opens up for milking capable female cattle */}
            {isEligibleForMilkingWithdrawal ? (
              <div className="health-input-field active-withdrawal-entry-box">
                <label>Milk Withdrawal Period (Days) *</label>
                <input type="number" placeholder="Enter 0 if milk is safe for parlor" value={withdrawalDays} onChange={(e) => setWithdrawalDays(e.target.value)} required={isEligibleForMilkingWithdrawal} />
              </div>
            ) : (
              <div className="health-input-field disabled-withdrawal-entry-box">
                <label>Milk Withdrawal Period</label>
                <input type="text" value="0 Days (Not a Milking Cow)" disabled />
              </div>
            )}
            
            <div className="health-input-field">
              {/* 🔒 UPDATED STATUS VALUES TYPE RULES: One-time vs Chronic */}
              <label>Nature of Condition *</label>
              <select value={treatmentStatus} onChange={(e) => setTreatmentStatus(e.target.value)} required>
                <option value="One-time">One-time / Acute Condition</option>
                <option value="Chronic">Chronic / Follow-up Required</option>
              </select>
            </div>
          </div>

          <button type="submit" className="commit-health-btn" disabled={activeHerd.length === 0}>
            💾 Commit Medical Sheet Record
          </button>
        </form>
      </div>

      {/* SECTION 2: THE HISTORICAL LEDGER OUTPUT DATA GRID VIEWPORT */}
      <div className="health-ledger-card">
        <h2>📋 Farm Medical History Ledger Sheet ({healthLedger.length})</h2>
        
        {healthLedger.length === 0 ? (
          <div className="empty-health-ledger-box">
            <p>🩺 No historical clinical treatments or vaccination entries registered yet.</p>
          </div>
        ) : (
          <>
            <div className="health-mobile-cards-stack">
              {currentLedgerSlice.map((log) => {
                const isWithdrawalActive = checkIsWithdrawalActive(log.treatmentDate, log.withdrawalDays);
                const canThisRowWithdrawMilk = log.withdrawalDays > 0;

                return (
                  <div key={log.id} className="health-record-item-row">
                    <div className="health-card-header-line">
                      <span className="health-date-label">📅 {new Date(log.treatmentDate).toLocaleDateString()}</span>
                      
                      <div className="health-action-controls-cluster">
                        <button type="button" className="inline-action-link-btn edit" onClick={() => handleStartInlineEdit(log)}>✏️ Edit</button>
                        <button type="button" className="inline-action-link-btn delete" onClick={() => handleDeleteRecord(log.id)}>✕ Purge</button>
                      </div>
                    </div>

                    {editingLogId === log.id ? (
                      /* IN-LINE HUMAN PROOFING ADJUSTMENT PANEL VIEW DRAWER */
                      <div className="inline-health-adjustment-drawer animate-fade">
                        <div className="inline-edit-field">
                          <label>Diagnosis Adjust:</label>
                          <input type="text" value={editDiagnosis} onChange={(e) => setEditDiagnosis(e.target.value)} />
                        </div>
                        <div className="inline-edit-field">
                          <label>Cost (KSh Adjustment):</label>
                          <input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} />
                        </div>
                        {log.withdrawalDays !== undefined && (
                          <div className="inline-edit-field">
                            <label>Withdrawal Days:</label>
                            <input type="number" value={editWithdrawal} disabled={log.withdrawalDays === 0} onChange={(e) => setEditWithdrawal(e.target.value)} />
                          </div>
                        )}
                        <div className="inline-edit-field">
                          <label>Condition Nature:</label>
                          <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                            <option value="One-time">One-time</option>
                            <option value="Chronic">Chronic</option>
                          </select>
                        </div>
                        <div className="inline-edit-buttons-row">
                          <button type="button" className="inline-save-adjust-btn" onClick={() => handleSaveInlineAdjustment(log.id, log.withdrawalDays > 0)}>Apply</button>
                          <button type="button" className="inline-cancel-adjust-btn" onClick={() => setEditingLogId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* STANDARD HEALTH DETAILS DISCLOSURE DECK */
                      <div className="health-card-body-details">
                        <div className="health-title-cost-flex">
                          <h4>
                            <strong>{log.cowName}</strong> <small>({log.cowTag})</small> • <span className="diagnosis-highlight">{log.diagnosis}</span>
                          </h4>
                          {/* 🔒 LOCALIZED CURRENCY LABEL FLAG */}
                          <span className="health-cost-tag">KSh {log.cost.toLocaleString()}</span>
                        </div>
                        <p className="med-line-text">Drug: <strong>{log.medication}</strong> • Administered By: {log.vetName}</p>
                        
                        <div className="health-status-badge-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <span className={`care-status-pill ${log.treatmentStatus === 'Chronic' ? 'work' : 'done'}`}>
                            {log.treatmentStatus === 'Chronic' ? '⏳ Chronic (Follow-up)' : '✅ One-time Event'}
                          </span>
                          
                          {/* 🔒 Dynamic Milk safety indicators checks logic */}
                          {!canThisRowWithdrawMilk ? (
                            <span className="milk-safety-alert-badge neutral">🟢 Non-Milking Asset</span>
                          ) : isWithdrawalActive ? (
                            <span className="milk-safety-alert-badge dump">❌ DUMP MILK ({log.withdrawalDays} Days)</span>
                          ) : (
                            <span className="milk-safety-alert-badge safe">✅ Safe / Clean Line</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* QUICK TAP PAGINATION ROW FOOTER */}
            {totalPages > 1 && (
              <div className="health-pagination-deck">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>◀ Prev</button>
                <span className="page-indicator-text">Page <strong>{currentPage}</strong> of {totalPages}</span>
                <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next ▶</button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}

export default HealthLog;
