import React, { useEffect, useMemo, useState } from 'react';
import './MilkLog.css';
import { showAppDialog } from '../../utils/appDialog';

const getLocalDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const readArray = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

function MilkLog() {
  const todayString = getLocalDateString();
  const [eligibleCows, setEligibleCows] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState(todayString);
  const [historyCowId, setHistoryCowId] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const historyPageSize = 10;
  const [entries, setEntries] = useState({});
  const [editExisting, setEditExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const refresh = () => {
    const herd = readArray('dairy_herd');
    setEligibleCows(herd.filter((animal) => animal.gender === 'Female' && ['Milking', 'Pregnant'].includes(animal.status)));
    setAllLogs(readArray('dairy_milk_logs'));
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const dateRecords = useMemo(
    () => allLogs.filter((log) => log.record_date === selectedDate),
    [allLogs, selectedDate]
  );
  const recordByCow = useMemo(() => {
    const map = new Map();
    dateRecords.forEach((log) => map.set(String(log.cowId), log));
    return map;
  }, [dateRecords]);

  const getEntryValue = (cow, shift) => {
    const record = recordByCow.get(String(cow.id));
    const shiftKey = shift === 'morning' ? 'morning_milk' : 'evening_milk';
    const loggedKey = shift === 'morning' ? 'is_am_logged' : 'is_pm_logged';
    const saved = record ? record[shiftKey] : '';
    if (entries[cow.id]?.[shift] !== undefined) return entries[cow.id][shift];
    if (!record) return '';
    const hasSavedShift = record[loggedKey] || Number(saved) > 0;
    return hasSavedShift ? String(saved ?? 0) : '';
  };

  const setEntryValue = (cowId, shift, value) => {
    setEntries((current) => ({ ...current, [cowId]: { ...current[cowId], [shift]: value } }));
    setSuccessMessage('');
    setErrorMessage('');
  };

  const enteredCount = eligibleCows.filter((cow) =>
    ['morning', 'evening'].some((shift) => getEntryValue(cow, shift) !== '')
  ).length;
  const missingCount = Math.max(eligibleCows.length - enteredCount, 0);
  const enteredTotal = eligibleCows.reduce((sum, cow) => {
    return sum + ['morning', 'evening'].reduce((cowSum, shift) => {
      const value = getEntryValue(cow, shift);
      return cowSum + (value === '' ? 0 : Number(value) || 0);
    }, 0);
  }, 0);

  const historyRecords = useMemo(() => allLogs
    .filter((log) => log.record_date)
    .filter((log) => !historyStartDate || log.record_date >= historyStartDate)
    .filter((log) => !historyEndDate || log.record_date <= historyEndDate)
    .filter((log) => !historyCowId || String(log.cowId) === historyCowId)
    .sort((a, b) => b.record_date.localeCompare(a.record_date) || String(a.cowName || '').localeCompare(String(b.cowName || ''))),
  [allLogs, historyStartDate, historyEndDate, historyCowId]);
  const historyTotal = historyRecords.reduce((sum, log) => sum + (Number(log.total_daily_milk) || (Number(log.morning_milk) || 0) + (Number(log.evening_milk) || 0)), 0);
  const historyTotalPages = Math.ceil(historyRecords.length / historyPageSize);
  const visibleHistoryRecords = historyRecords.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

  useEffect(() => { setHistoryPage(1); }, [historyStartDate, historyEndDate, historyCowId]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    if (!selectedDate || selectedDate > todayString) {
      setErrorMessage('Choose today or a date in the past. Future milk records are not allowed.');
      return;
    }

    const changes = [];
    for (const cow of eligibleCows) {
      const changedValues = {};
      for (const shift of ['morning', 'evening']) {
        const raw = entries[cow.id]?.[shift];
        if (raw === undefined || raw === '') continue;
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount < 0 || amount > 40) {
          setErrorMessage(`${cow.name}: each shift must be between 0 and 40 liters.`);
          return;
        }
        changedValues[shift] = amount;
      }
      if (Object.keys(changedValues).length > 0) changes.push({ cow, changedValues });
    }

    if (changes.length === 0) {
      setErrorMessage('Enter at least one morning or evening reading before saving.');
      return;
    }

    const latestLogs = readArray('dairy_milk_logs');
    const confirmTotal = changes.reduce((sum, { cow, changedValues }) => {
      const existing = latestLogs.find((log) => String(log.cowId) === String(cow.id) && log.record_date === selectedDate);
      const morning = changedValues.morning ?? (Number(existing?.morning_milk) || 0);
      const evening = changedValues.evening ?? (Number(existing?.evening_milk) || 0);
      return sum + morning + evening;
    }, 0);
    const confirmText = `Save milk readings for ${changes.length} cow${changes.length === 1 ? '' : 's'} on ${selectedDate}?\n\nDaily total for these cows: ${confirmTotal.toFixed(1)} L`;
    if (!await showAppDialog({ title: 'Review milk readings', message: confirmText, type: 'confirm', confirmText: 'Save readings' })) return;

    let savedCount = 0;
    const nextLogs = [...latestLogs];
    for (const { cow, changedValues } of changes) {
      const index = nextLogs.findIndex((log) => String(log.cowId) === String(cow.id) && log.record_date === selectedDate);
      const original = index >= 0 ? nextLogs[index] : null;
      const morning = changedValues.morning ?? (Number(original?.morning_milk) || 0);
      const evening = changedValues.evening ?? (Number(original?.evening_milk) || 0);
      const record = {
        ...(original || {}),
        id: original?.id ?? Date.now() + savedCount,
        cowId: cow.id,
        cowName: cow.name || 'Unnamed',
        cowTag: cow.tagNumber || 'Unknown',
        record_date: selectedDate,
        morning_milk: morning,
        evening_milk: evening,
        total_daily_milk: morning + evening,
        is_am_logged: original?.is_am_logged || changedValues.morning !== undefined || morning > 0,
        is_pm_logged: original?.is_pm_logged || changedValues.evening !== undefined || evening > 0,
      };
      if (index >= 0) nextLogs[index] = record;
      else nextLogs.unshift(record);
      savedCount += 1;
    }

    localStorage.setItem('dairy_milk_logs', JSON.stringify(nextLogs));
    setAllLogs(nextLogs);
    setEntries({});
    setEditExisting(false);
    setSuccessMessage(`Saved ${savedCount} cow${savedCount === 1 ? '' : 's'} for ${selectedDate}.`);
  };

  return (
    <div className="milk-production-page-container">
      <section className="milk-form-card">
        <h2>Milk Card Entry</h2>
        <p className="milk-card-instructions">
          <span className="milk-card-instructions-icon" aria-hidden="true">ℹ</span>
          <span>Enter the readings from the staff card for each cow. Log morning and evening separately, or save one shift now and add the other later.</span>
        </p>
        <div className="milk-form-row milk-card-controls">
          <div className="milk-form-field">
            <label htmlFor="milk-record-date">Record date</label>
            <input id="milk-record-date" type="date" value={selectedDate} max={todayString} onChange={(event) => { setSelectedDate(event.target.value); setEntries({}); setSuccessMessage(''); setErrorMessage(''); }} />
          </div>
          {dateRecords.length > 0 && (
            <label className="milk-edit-toggle">
              <input type="checkbox" checked={editExisting} onChange={(event) => { setEditExisting(event.target.checked); setEntries({}); }} />
              Allow corrections to saved readings
            </label>
          )}
        </div>
        <p className="calendar-lock-pill">{selectedDate === todayString ? 'Today' : 'Past date'}: <strong>{selectedDate}</strong> · {dateRecords.length} cow records already saved</p>
        {successMessage && <div className="milk-alert-banner alert-success" role="status">{successMessage}</div>}
        {errorMessage && <div className="milk-alert-banner alert-danger" role="alert">{errorMessage}</div>}

        {loading ? <p className="sheet-status-text">Loading herd records…</p> : eligibleCows.length === 0 ? (
          <div className="empty-sheet-box"><p>No eligible female cows are currently listed as milking or pregnant.</p></div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="milk-card-summary" aria-live="polite">
              <span><strong>{enteredCount}</strong> of {eligibleCows.length} cows entered</span>
              <span><strong>{missingCount}</strong> missing</span>
              <span><strong>{enteredTotal.toFixed(1)} L</strong> entered total</span>
            </div>
            <div className="sheet-table-scroll-wrapper">
              <table className="collection-data-table milk-card-table">
                <thead><tr><th>Cow</th><th>Morning (L)</th><th>Evening (L)</th><th>Daily total</th><th>Status</th></tr></thead>
                <tbody>
                  {eligibleCows.map((cow) => {
                    const existing = recordByCow.get(String(cow.id));
                    const morningValue = getEntryValue(cow, 'morning');
                    const eveningValue = getEntryValue(cow, 'evening');
                    const rowTotal = (Number(morningValue) || 0) + (Number(eveningValue) || 0);
                    const touched = morningValue !== '' || eveningValue !== '';
                    return (
                      <tr key={cow.id}>
                        <td><strong>{cow.name}</strong><small>Tag ID: {cow.tagNumber || 'Unknown'}</small></td>
                        {['morning', 'evening'].map((shift) => {
                          const value = shift === 'morning' ? morningValue : eveningValue;
                          return <td key={shift}><input className="milk-card-input" aria-label={`${cow.name} ${shift} milk in liters`} type="number" min="0" max="40" step="0.1" placeholder="—" value={value} disabled={Boolean(existing) && !editExisting && entries[cow.id]?.[shift] === undefined} onChange={(event) => setEntryValue(cow.id, shift, event.target.value)} /></td>;
                        })}
                        <td className="table-aggregated-total-cell">{rowTotal.toFixed(1)} L</td>
                        <td>{touched ? (existing ? 'Saved / updated' : 'Ready to save') : 'Missing'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {dateRecords.length > 0 && !editExisting && <p className="lock-notice-text">Saved readings are locked to prevent accidental duplicate entry. Turn on corrections to change them.</p>}
            <button type="submit" className="commit-milk-btn">Review and save readings</button>
          </form>
        )}
      </section>

      <section className="collection-sheet-card">
        <h2>Milk Record Sheet for today ({selectedDate} ({dateRecords.length}))</h2>
        {dateRecords.length === 0 ? <div className="empty-sheet-box"><p>No milk logged for this date yet.</p></div> : (
          <div className="sheet-table-scroll-wrapper">
            <table className="collection-data-table">
              <thead><tr><th>Cow</th><th>Morning</th><th>Evening</th><th>Total</th></tr></thead>
              <tbody>{dateRecords.map((record) => <tr key={record.id}><td><strong>{record.cowName}</strong><small>Tag ID: {record.cowTag}</small></td><td>{record.is_am_logged || record.morning_milk > 0 ? `${record.morning_milk} L` : 'Pending'}</td><td>{record.is_pm_logged || record.evening_milk > 0 ? `${record.evening_milk} L` : 'Pending'}</td><td className="table-aggregated-total-cell">{record.total_daily_milk} L</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="collection-sheet-card">
        <button
          type="button"
          className="milk-history-toggle"
          aria-expanded={isHistoryOpen}
          aria-controls="farm-milk-history"
          onClick={() => setIsHistoryOpen((open) => !open)}
        >
          <span><strong>Farm Milk Production Records ({historyRecords.length})</strong><small>Search and review daily herd production</small></span>
          <span className="milk-history-toggle-icon" aria-hidden="true">{isHistoryOpen ? '−' : '+'}</span>
        </button>
        {isHistoryOpen && <div id="farm-milk-history" className="milk-history-content">
        <p className="milk-history-instructions">
          <span className="milk-history-instructions-icon" aria-hidden="true">⌕</span>
          <span>Explore the herd’s daily milk records. Narrow the list by date or cow to find a specific entry.</span>
        </p>
        <div className="milk-history-filters">
          <div className="milk-form-field">
            <label htmlFor="milk-history-from">From</label>
            <input id="milk-history-from" type="date" max={todayString} value={historyStartDate} onChange={(event) => setHistoryStartDate(event.target.value)} />
          </div>
          <div className="milk-form-field">
            <label htmlFor="milk-history-to">To</label>
            <input id="milk-history-to" type="date" max={todayString} value={historyEndDate} onChange={(event) => setHistoryEndDate(event.target.value)} />
          </div>
          <div className="milk-form-field">
            <label htmlFor="milk-history-cow">Cow</label>
            <select id="milk-history-cow" value={historyCowId} onChange={(event) => setHistoryCowId(event.target.value)}>
              <option value="">All cows</option>
              {Array.from(new Map(allLogs.map((log) => [String(log.cowId), log])).values())
                .sort((a, b) => String(a.cowName || '').localeCompare(String(b.cowName || '')))
                .map((log) => <option key={log.cowId} value={String(log.cowId)}>{log.cowName || 'Unnamed'} · {log.cowTag || 'No tag'}</option>)}
            </select>
          </div>
          <div className="milk-history-filter-action">
            <button type="button" className="clear-milk-filters-btn" onClick={() => { setHistoryStartDate(''); setHistoryEndDate(todayString); setHistoryCowId(''); setHistoryPage(1); }}>Clear Search</button>
          </div>
        </div>
        <div className="milk-card-summary"><span><strong>{historyRecords.length}</strong> daily records</span><span><strong>{historyTotal.toFixed(1)} L</strong> total in range</span></div>
        {historyRecords.length === 0 ? <div className="empty-sheet-box"><p>No milk records match these filters.</p></div> : (
          <div className="sheet-table-scroll-wrapper">
            <table className="collection-data-table milk-history-table">
              <thead><tr><th>Date</th><th>Cow</th><th>Morning</th><th>Evening</th><th>Total</th></tr></thead>
              <tbody>{visibleHistoryRecords.map((record) => <tr key={`${record.cowId}-${record.record_date}`}><td>{record.record_date}</td><td><strong>{record.cowName || 'Unnamed'}</strong><small>Tag ID: {record.cowTag || 'Unknown'}</small></td><td>{record.is_am_logged || record.morning_milk > 0 ? `${Number(record.morning_milk) || 0} L` : '—'}</td><td>{record.is_pm_logged || record.evening_milk > 0 ? `${Number(record.evening_milk) || 0} L` : '—'}</td><td className="table-aggregated-total-cell">{Number(record.total_daily_milk) || (Number(record.morning_milk) || 0) + (Number(record.evening_milk) || 0)} L</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {historyTotalPages > 1 && <div className="milk-history-pagination" aria-label="Milk history pages">
          <button type="button" disabled={historyPage === 1} onClick={() => setHistoryPage((page) => page - 1)}>Previous</button>
          <span>Page <strong>{historyPage}</strong> of {historyTotalPages}</span>
          <button type="button" disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage((page) => page + 1)}>Next</button>
        </div>}
        </div>}
      </section>
    </div>
  );
}

export default MilkLog;
