import React, { useState, useEffect } from 'react';
import './MilkLog.css';

function MilkLog() {
  // --- STATE 1: CORE SELECTION AND LOG ARRAYS ---
  const [eligibleCows, setEligibleCows] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [dropdownCows, setDropdownCows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- 🔒 CALENDAR BARRIER: Permanently locked to today's local string ---
  const todayString = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // --- STATE 2: YIELD INPUT FIELDS ---
  const [selectedCowId, setSelectedCowId] = useState('');
  const [morningMilk, setMorningMilk] = useState('');
  const [eveningMilk, setEveningMilk] = useState('');
  
  // Field freeze trackers for selective part-day logging
  const [isMorningDisabled, setIsMorningDisabled] = useState(false);
  const [isEveningDisabled, setIsEveningDisabled] = useState(false);

  // --- ENGINE 1: INITIAL COMPONENT LOAD INJECTION ---
  useEffect(() => {
    refreshMilkProductionTerminal();
    setLoading(false);
  }, []);

  // --- ENGINE 2: REFRESH DROPDOWNS AND WORK TABLES ---
  const refreshMilkProductionTerminal = () => {
    // A. Gather today's logged lines from local memory
    const savedMilkLogs = localStorage.getItem('dairy_milk_logs');
    const allLogsArray = savedMilkLogs ? JSON.parse(savedMilkLogs) : [];
    const filteredTodayRecords = allLogsArray.filter(log => log.record_date === todayString);
    setTodayRecords(filteredTodayRecords);

    // B. Gather herd directory for open female filters
    const savedHerd = localStorage.getItem('dairy_herd') || '[]';
    if (savedHerd) {
      const parsedHerd = JSON.parse(savedHerd);
      
      // Strict Filter: Only female cattle who are active milkers or pregnant heifers
      const initialFemales = parsedHerd.filter(animal => 
        animal.gender === 'Female' && (animal.status === 'Milking' || animal.status === 'Pregnant')
      );
      setEligibleCows(initialFemales);

      // Dropout Filter: Hide cows who have already completed BOTH milk shifts today
      const finalDropdownSelectionList = initialFemales.filter(cow => {
        const todayCowLog = filteredTodayRecords.find(log => log.cowId === cow.id);
        if (!todayCowLog) return true; // No records yet? Keep in dropdown list
        
        const hasAM = todayCowLog.morning_milk > 0 || todayCowLog.is_am_logged;
        const hasPM = todayCowLog.evening_milk > 0 || todayCowLog.is_pm_logged;
        
        return !(hasAM && hasPM); // Hide if both are logged
      });

      setDropdownCows(finalDropdownSelectionList);

      // Pre-select the top matching animal option index
      if (finalDropdownSelectionList.length > 0) {
        setSelectedCowId(finalDropdownSelectionList[0].id.toString());
      } else {
        setSelectedCowId('');
      }
    }
  };

  // --- ENGINE 3: DYNAMIC INPUT LOCK WATCHER ---
  useEffect(() => {
    if (!selectedCowId) {
      setIsMorningDisabled(false);
      setIsEveningDisabled(false);
      return;
    }

    const matchingLog = todayRecords.find(log => log.cowId === parseInt(selectedCowId));
    if (matchingLog) {
      if (matchingLog.morning_milk > 0 || matchingLog.is_am_logged) {
        setIsMorningDisabled(true);
        setMorningMilk('0');
      } else {
        setIsMorningDisabled(false);
        setMorningMilk('');
      }

      if (matchingLog.evening_milk > 0 || matchingLog.is_pm_logged) {
        setIsEveningDisabled(true);
        setEveningMilk('0');
      } else {
        setIsEveningDisabled(false);
        setEveningMilk('');
      }
    } else {
      setIsMorningDisabled(false);
      setIsEveningDisabled(false);
      setMorningMilk('');
      setEveningMilk('');
    }
  }, [selectedCowId, todayRecords]);

  // --- ENGINE 4: COMMIT RECORD ENTRY SHEET (UPSERT LOGIC) ---
  const handleLogMilkSubmission = (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!selectedCowId) {
      setErrorMessage('❌ Selection Error: No remaining eligible animals left to milk today.');
      return;
    }

    const amYieldInput = parseFloat(morningMilk) || 0;
    const pmYieldInput = parseFloat(eveningMilk) || 0;

    if (amYieldInput < 0 || pmYieldInput < 0) {
      setErrorMessage('❌ Calculation Error: Milk volumes cannot be negative.');
      return;
    }

    const targetCow = eligibleCows.find(c => c.id.toString() === selectedCowId);
    const savedMilkLogs = localStorage.getItem('dairy_milk_logs');
    let masterLogsArray = savedMilkLogs ? JSON.parse(savedMilkLogs) : [];

    const existingLogIndex = masterLogsArray.findIndex(
      log => log.cowId === parseInt(selectedCowId) && log.record_date === todayString
    );

    if (existingLogIndex !== -1) {
      // Update existing entry with afternoon data session securely
      const originalLog = masterLogsArray[existingLogIndex];
      
      const newAM = isMorningDisabled ? originalLog.morning_milk : amYieldInput;
      const newPM = isEveningDisabled ? originalLog.evening_milk : pmYieldInput;

      masterLogsArray[existingLogIndex] = {
        ...originalLog,
        morning_milk: newAM,
        evening_milk: newPM,
        total_daily_milk: newAM + newPM, // Simple volume summary metric
        is_am_logged: originalLog.is_am_logged || amYieldInput > 0,
        is_pm_logged: originalLog.is_pm_logged || pmYieldInput > 0
      };
    } else {
      // Brand new entry block payload (NO PRICING VARS OR MONEY FIELDS)
      const newRecord = {
        id: Date.now(),
        cowId: parseInt(selectedCowId),
        cowName: targetCow ? targetCow.name : 'Unnamed',
        cowTag: targetCow ? targetCow.tagNumber : 'Unknown',
        record_date: todayString,
        morning_milk: amYieldInput,
        evening_milk: pmYieldInput,
        total_daily_milk: amYieldInput + pmYieldInput,
        is_am_logged: amYieldInput > 0,
        is_pm_logged: pmYieldInput > 0
      };
      masterLogsArray = [newRecord, ...masterLogsArray];
    }

    localStorage.setItem('dairy_milk_logs', JSON.stringify(masterLogsArray));
    setSuccessMessage(`🎉 Milk production records updated for ${targetCow?.name || 'Animal'}!`);
    
    setMorningMilk('');
    setEveningMilk('');
    refreshMilkProductionTerminal();

    setTimeout(() => setSuccessMessage(''), 2500);
  };

  return (
    <div className="milk-production-page-container">
      
      {/* SECTION 1: DAILY PARLOR LOGGER SHEET */}
      <div className="milk-form-card">
        <h2>🥛 Daily Parlor Collection Entry Sheet</h2>
        <p className="calendar-lock-pill">📅 Locked Working Session: <strong>{new Date().toDateString()}</strong></p>
        
        {successMessage && <div className="milk-alert-banner alert-success">{successMessage}</div>}
        {errorMessage && <div className="milk-alert-banner alert-danger">{errorMessage}</div>}

        <form onSubmit={handleLogMilkSubmission}>
          <div className="milk-form-field">
            <label>Select Cow for Entry *</label>
            {dropdownCows.length === 0 ? (
              <select disabled className="disabled-select">
                <option>All eligible milking cattle records completed for today!</option>
              </select>
            ) : (
              <select value={selectedCowId} onChange={(e) => setSelectedCowId(e.target.value)} required>
                {dropdownCows.map((cow) => (
                  <option key={cow.id} value={cow.id}>
                    {cow.name} (Tag: {cow.tagNumber})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="milk-form-row">
            <div className="milk-form-field">
              <label>Morning Yield (Liters)</label>
              <input 
                type="number" 
                step="0.1" 
                placeholder={isMorningDisabled ? "Logged" : "e.g. 14.5"}
                value={morningMilk} 
                disabled={isMorningDisabled}
                onChange={(e) => setMorningMilk(e.target.value)} 
              />
              {isMorningDisabled && <small className="lock-notice-text">🔒 Morning locked for this cow</small>}
            </div>
            
            <div className="milk-form-field">
              <label>Evening Yield (Liters)</label>
              <input 
                type="number" 
                step="0.1" 
                placeholder={isEveningDisabled ? "Logged" : "e.g. 10.2"} 
                value={eveningMilk} 
                disabled={isEveningDisabled}
                onChange={(e) => setEveningMilk(e.target.value)} 
              />
              {isEveningDisabled && <small className="lock-notice-text">🔒 Evening locked for this cow</small>}
            </div>
          </div>

          <button 
            type="submit" 
            className="commit-milk-btn"
            disabled={dropdownCows.length === 0}
          >
            💾 Commit Session Entry
          </button>
        </form>
      </div>

      {/* SECTION 2: TODAY'S PARLOR YIELD REGISTRY SHEET */}
      <div className="collection-sheet-card">
        <h2>📋 Today's Parlor Yield Registry Sheet ({todayRecords.length})</h2>
        
        {loading ? (
          <p className="sheet-status-text">Syncing internal device memory indices...</p>
        ) : todayRecords.length === 0 ? (
          <div className="empty-sheet-box">
            🥣 <p>No milk weights logged in the parlor lines for today yet.</p>
          </div>
        ) : (
          <div className="sheet-table-scroll-wrapper">
            <table className="collection-data-table">
              <thead>
                <tr>
                  <th>Cow Profile</th>
                  <th>AM Yield</th>
                  <th>PM Yield</th>
                  <th>Daily Total</th>
                </tr>
              </thead>
              <tbody>
                {todayRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.cowName}</strong>
                      <small>Tag ID: {record.cowTag}</small>
                    </td>
                    <td>{record.is_am_logged || record.morning_milk > 0 ? `${record.morning_milk} L` : 'Pending'}</td>
                    <td>{record.is_pm_logged || record.evening_milk > 0 ? `${record.evening_milk} L` : 'Pending'}</td>
                    <td className="table-aggregated-total-cell">
                      {record.total_daily_milk} Liters
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MilkLog;
