import React, { useState, useEffect } from 'react';
import './HealthLog.css';

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function HealthLog() {
  // =========================================================
  // STATE 1: CORE STORAGE ARRAYS
  // =========================================================
  const [activeHerd, setActiveHerd] = useState([]);
  const [healthLedger, setHealthLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // STATE 2: NEW EVENT INPUT FIELDS
  // =========================================================
  const [selectedCowId, setSelectedCowId] = useState('');
  const [administeredBy, setAdministeredBy] = useState('Farmer');
  const [treatmentDate, setTreatmentDate] = useState(getLocalDateString());
  const [diagnosis, setDiagnosis] = useState('');
  const [medication, setMedication] = useState('');
  const [vetName, setVetName] = useState('');
  const [treatmentCost, setTreatmentCost] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('');
  const [treatmentStatus, setTreatmentStatus] = useState('One-time');
  const [frequency, setFrequency] = useState('None');

  // =========================================================
  // RECURRING TREATMENT / REMINDER STATE
  // =========================================================
  const [reminderSourceId, setReminderSourceId] = useState(null);
  const [reminderSourceSeriesId, setReminderSourceSeriesId] = useState(null);

  // =========================================================
  // STATE 3: INLINE EDIT TRACKERS
  // =========================================================
  const [editingLogId, setEditingLogId] = useState(null);
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editWithdrawal, setEditWithdrawal] = useState('');
  const [editStatus, setEditStatus] = useState('One-time');

  // =========================================================
  // STATE 4: UI
  // =========================================================
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 5;

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';

    const [year, month, day] = dateString.split('-').map(Number);

    if (!year || !month || !day) return dateString;

    return new Date(year, month - 1, day).toLocaleDateString();
  };

  const compareCalendarDates = (dateA, dateB) => {
    if (!dateA || !dateB) return 0;

    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;

    return 0;
  };

  // =========================================================
  // RECURRING TREATMENT HELPERS
  // =========================================================

  const calculateNextDueDate = (baseDate, selectedFrequency) => {
    if (!baseDate || selectedFrequency === 'None') {
      return '';
    }

    const [year, month, day] = baseDate.split('-').map(Number);

    if (!year || !month || !day) {
      return '';
    }

    const nextDate = new Date(year, month - 1, day);

    switch (selectedFrequency) {
      case 'Every 3 months':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;

      case 'Every 6 months':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;

      case 'Annually':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;

      default:
        return '';
    }

    return getLocalDateString(nextDate);
  };

  const getReminderStatus = (nextDueDate) => {
    const today = getLocalDateString();

    if (!nextDueDate) return 'none';

    if (nextDueDate < today) return 'overdue';

    if (nextDueDate === today) return 'today';

    return 'upcoming';
  };

  const getDaysDifference = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 0;

    const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
    const [toYear, toMonth, toDay] = toDate.split('-').map(Number);

    const from = new Date(fromYear, fromMonth - 1, fromDay);
    const to = new Date(toYear, toMonth - 1, toDay);

    const difference = to.getTime() - from.getTime();

    return Math.round(difference / (1000 * 60 * 60 * 24));
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    refreshHealthTerminal();
    setLoading(false);
  }, []);

  const refreshHealthTerminal = () => {
    // -------------------------------------------------------
    // LOAD ACTIVE HERD
    // -------------------------------------------------------
    const savedHerd = localStorage.getItem('dairy_herd') || '[]';

    let parsedHerd = [];

    try {
      parsedHerd = JSON.parse(savedHerd);
    } catch (error) {
      console.error('Could not read dairy herd data:', error);
      parsedHerd = [];
    }

    const activeCattle = parsedHerd.filter(
      animal =>
        !String(animal?.status || '')
          .toLowerCase()
          .startsWith('archived')
    );

    setActiveHerd(activeCattle);

    // Only choose first cow if there isn't already a valid selection.
    setSelectedCowId(previousId => {
      const stillExists = activeCattle.some(
        animal => String(animal.id) === String(previousId)
      );

      if (stillExists) return previousId;

      return activeCattle.length > 0
        ? activeCattle[0].id.toString()
        : '';
    });

    // -------------------------------------------------------
    // LOAD HEALTH LEDGER
    // -------------------------------------------------------
    const savedLogs = localStorage.getItem('dairy_health_logs') || '[]';

    let parsedLogs = [];

    try {
      parsedLogs = JSON.parse(savedLogs);
    } catch (error) {
      console.error('Could not read health ledger:', error);
      parsedLogs = [];
    }

    setHealthLedger(Array.isArray(parsedLogs) ? parsedLogs : []);
  };

  // =========================================================
  // CURRENT SELECTED ANIMAL
  // =========================================================

  const currentSelectedAnimal = activeHerd.find(
    cow => String(cow.id) === String(selectedCowId)
  );

  // =========================================================
  // MILK WITHDRAWAL ELIGIBILITY
  // =========================================================

  const isEligibleForMilkingWithdrawal =
    currentSelectedAnimal &&
    currentSelectedAnimal.gender === 'Female' &&
    currentSelectedAnimal.status !== 'Calf';

  // =========================================================
  // MILK WITHDRAWAL CHECK
  // =========================================================

  const checkIsWithdrawalActive = (loggedDateStr, daysCount) => {
    if (!daysCount || parseInt(daysCount, 10) === 0) {
      return false;
    }

    const loggedDate = new Date(`${loggedDateStr}T00:00:00`);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const releaseDate = new Date(loggedDate);

    releaseDate.setDate(
      releaseDate.getDate() + parseInt(daysCount, 10)
    );

    return today < releaseDate;
  };

  // =========================================================
  // RECURRING REMINDERS
  // =========================================================

  const recurringReminderRecords = healthLedger
    .filter(log => log.frequency && log.frequency !== 'None' && log.nextDueDate)
    .filter(log => {
      /*
        IMPORTANT:
        If a later treatment already points back to this treatment
        through previousTreatmentId, this old record has already been
        completed for its next cycle.

        That prevents the old reminder from staying visible after
        the farmer records the next treatment.
      */
      const hasCompletedNextCycle = healthLedger.some(
        laterLog =>
          String(laterLog.previousTreatmentId || '') === String(log.id)
      );

      return !hasCompletedNextCycle;
    })
    .map(log => {
      const status = getReminderStatus(log.nextDueDate);

      return {
        ...log,
        reminderStatus: status
      };
    })
    .filter(log => log.reminderStatus !== 'none')
    .sort((a, b) => {
      const statusOrder = {
        overdue: 1,
        today: 2,
        upcoming: 3
      };

      const statusDifference =
        statusOrder[a.reminderStatus] -
        statusOrder[b.reminderStatus];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return a.nextDueDate.localeCompare(b.nextDueDate);
    });

  // =========================================================
  // REMINDER COUNTS
  // =========================================================

  const overdueReminders = recurringReminderRecords.filter(
    reminder => reminder.reminderStatus === 'overdue'
  );

  const todayReminders = recurringReminderRecords.filter(
    reminder => reminder.reminderStatus === 'today'
  );

  const upcomingReminders = recurringReminderRecords.filter(
    reminder => reminder.reminderStatus === 'upcoming'
  );

  // =========================================================
  // LOAD A REMINDER INTO THE MEDICAL FORM
  // =========================================================

  const handleRecordReminder = reminder => {
    const linkedCow = activeHerd.find(
      cow => String(cow.id) === String(reminder.cowId)
    );

    if (!linkedCow) {
      setErrorMessage(
        'This animal is no longer available in the active herd.'
      );
      return;
    }

    /*
      IMPORTANT:
      We use TODAY as the default new treatment date.

      The farmer can change this to the actual date they remember
      administering the treatment.
    */
    const today = getLocalDateString();

    setSelectedCowId(String(reminder.cowId));

    setAdministeredBy(
      reminder.administeredBy === 'Vet' ? 'Vet' : 'Farmer'
    );

    setTreatmentDate(today);

    setDiagnosis(reminder.diagnosis || '');

    setMedication(
      reminder.medication && reminder.medication !== 'None Specified'
        ? reminder.medication
        : ''
    );

    setVetName(
      reminder.administeredBy === 'Vet'
        ? reminder.vetName || ''
        : ''
    );

    /*
      Cost is deliberately NOT copied.

      The new treatment may have a different cost.
    */
    setTreatmentCost('');

    setWithdrawalDays(
      reminder.withdrawalDays !== undefined
        ? String(reminder.withdrawalDays)
        : ''
    );

    setTreatmentStatus(
      reminder.treatmentStatus === 'Chronic'
        ? 'Chronic'
        : 'One-time'
    );

    setFrequency(reminder.frequency || 'None');

    // Preserve the chain for future cow-profile timeline.
    setReminderSourceId(reminder.id);
    setReminderSourceSeriesId(
      reminder.recurringSeriesId || `health-series-${reminder.id}`
    );

    setSuccessMessage(
      `Recurring treatment loaded for ${reminder.cowName}. Check the date and update any details before submitting.`
    );

    setErrorMessage('');

    // Scroll the farmer back to the form.
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // =========================================================
  // SUBMIT NEW HEALTH RECORD
  // =========================================================

  const handleLogHealthSubmission = e => {
    e.preventDefault();

    setSuccessMessage('');
    setErrorMessage('');

    if (!treatmentDate) {
      return setErrorMessage(
        'Date Error: Please enter the actual treatment date.'
      );
    }

    // Future dates are never allowed.
    const today = getLocalDateString();

    if (treatmentDate > today) {
      return setErrorMessage(
        'Date Violation: Medical events cannot be logged into future dates.'
      );
    }

    if (!selectedCowId) {
      return setErrorMessage(
        'Selection Error: No animal selected.'
      );
    }

    if (!currentSelectedAnimal) {
      return setErrorMessage(
        'Selection Error: The selected animal could not be found.'
      );
    }

    if (!diagnosis.trim()) {
      return setErrorMessage(
        'Field Error: Diagnosis/Reason field cannot be left blank.'
      );
    }

    if (!medication.trim()) {
      return setErrorMessage(
        'Field Error: Medication Administered field cannot be left blank.'
      );
    }

    if (administeredBy === 'Vet' && !vetName.trim()) {
      return setErrorMessage(
        'Field Error: Please enter the veterinarian name.'
      );
    }

    const costVal = parseFloat(treatmentCost) || 0;

    const daysVal = isEligibleForMilkingWithdrawal
      ? parseInt(withdrawalDays, 10) || 0
      : 0;

    if (costVal < 0 || daysVal < 0) {
      return setErrorMessage(
        'Numeric Error: Financial costs or withdrawal counts cannot be negative values.'
      );
    }

    // -------------------------------------------------------
    // DETERMINE RECURRING SERIES
    // -------------------------------------------------------

    let recurringSeriesId = reminderSourceSeriesId;

    if (frequency !== 'None' && !recurringSeriesId) {
      recurringSeriesId = `health-series-${Date.now()}`;
    }

    /*
      The next due date is based on the ACTUAL TREATMENT DATE
      entered by the farmer, not the original reminder date.
    */
    const nextDueDate = calculateNextDueDate(
      treatmentDate,
      frequency
    );

    // -------------------------------------------------------
    // CREATE NEW RECORD
    // -------------------------------------------------------

    const newHealthRecord = {
      id: Date.now(),

      cowId: currentSelectedAnimal.id,
      cowName: currentSelectedAnimal.name,
      cowTag: currentSelectedAnimal.tagNumber,

      administeredBy,

      treatmentDate,

      diagnosis: diagnosis.trim(),

      medication: medication.trim(),

      vetName:
        administeredBy === 'Vet'
          ? vetName.trim() || 'Private Vet'
          : 'Farmer / Staff',

      cost: costVal,

      withdrawalDays: daysVal,

      treatmentStatus,

      frequency,

      nextDueDate,

      notes: '',

      // -----------------------------------------------------
      // RECURRING TREATMENT CHAIN
      // -----------------------------------------------------

      /*
        If this record came from a reminder, connect it to
        the previous treatment.
      */
      previousTreatmentId: reminderSourceId || null,

      /*
        All treatments in the same recurring cycle share this ID.
        This will be very useful when we build the cow profile.
      */
      recurringSeriesId:
        frequency !== 'None'
          ? recurringSeriesId
          : null,

      /*
        Helpful future metadata.
      */
      isRecurring:
        frequency !== 'None',

      recordedAt: new Date().toISOString()
    };

    // -------------------------------------------------------
    // SAVE TO MASTER HEALTH LEDGER
    // -------------------------------------------------------

    const savedLogs =
      localStorage.getItem('dairy_health_logs');

    let existingLogsArray = [];

    try {
      existingLogsArray = savedLogs
        ? JSON.parse(savedLogs)
        : [];
    } catch (error) {
      console.error(
        'Could not read existing health records:',
        error
      );

      return setErrorMessage(
        'Storage Error: Existing medical records could not be read safely. No new record was saved.'
      );
    }

    const updatedLogsArray = [
      newHealthRecord,
      ...existingLogsArray
    ];

    localStorage.setItem(
      'dairy_health_logs',
      JSON.stringify(updatedLogsArray)
    );

    // -------------------------------------------------------
    // CALVING / BIRTH AUTO STATUS
    // -------------------------------------------------------

    const calvingKeywords = [
      'calving',
      'birth',
      'parturition',
      'calved',
      'delivered'
    ];

    if (
      calvingKeywords.some(keyword =>
        diagnosis.toLowerCase().includes(keyword)
      )
    ) {
      let masterHerd = [];

      try {
        masterHerd = JSON.parse(
          localStorage.getItem('dairy_herd') || '[]'
        );
      } catch (error) {
        console.error(
          'Could not read herd while processing calving:',
          error
        );
        masterHerd = [];
      }

      masterHerd = masterHerd.map(animal => {
        if (
          animal.id === currentSelectedAnimal.id &&
          animal.gender === 'Female'
        ) {
          const [year, month, day] =
            treatmentDate.split('-').map(Number);

          const calvingDate = new Date(
            year,
            month - 1,
            day
          );

          const alertStartDate = new Date(calvingDate);
          alertStartDate.setDate(
            alertStartDate.getDate() + 45
          );

          const alertEndDate = new Date(calvingDate);
          alertEndDate.setDate(
            alertEndDate.getDate() + 60
          );

          return {
            ...animal,
            status: 'Milking',
            calvingAlertStartDate:
              getLocalDateString(alertStartDate),
            calvingAlertEndDate:
              getLocalDateString(alertEndDate)
          };
        }

        return animal;
      });

      localStorage.setItem(
        'dairy_herd',
        JSON.stringify(masterHerd)
      );
    }

    // -------------------------------------------------------
    // RESET FORM
    // -------------------------------------------------------

    setDiagnosis('');
    setMedication('');
    setVetName('');
    setTreatmentCost('');
    setWithdrawalDays('');
    setTreatmentStatus('One-time');
    setFrequency('None');

    setReminderSourceId(null);
    setReminderSourceSeriesId(null);

    setCurrentPage(1);

    setSuccessMessage(
      `Medical record saved successfully for ${currentSelectedAnimal.name}!`
    );

    refreshHealthTerminal();

    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  // =========================================================
  // INLINE EDIT
  // =========================================================

  const handleStartInlineEdit = log => {
    setEditingLogId(log.id);
    setEditDiagnosis(log.diagnosis);
    setEditCost(log.cost);
    setEditWithdrawal(log.withdrawalDays);
    setEditStatus(log.treatmentStatus);
  };

  const handleSaveInlineAdjustment = (
    logId,
    isCowCapableOfMilk
  ) => {
    const costValue = parseFloat(editCost) || 0;

    const daysValue = isCowCapableOfMilk
      ? parseInt(editWithdrawal, 10) || 0
      : 0;

    if (
      costValue < 0 ||
      daysValue < 0 ||
      !editDiagnosis.trim()
    ) {
      alert(
        'Entry Violation: Adjustment inputs cannot be negative or blank.'
      );
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

    localStorage.setItem(
      'dairy_health_logs',
      JSON.stringify(updatedLogs)
    );

    setEditingLogId(null);

    alert('Health ledger record adjusted safely.');
  };

  // =========================================================
  // DELETE
  // =========================================================

  const handleDeleteRecord = logId => {
    if (
      window.confirm(
        'Purge Action: Are you sure you want to permanently delete this health card from device memory?'
      )
    ) {
      const updatedLogs = healthLedger.filter(
        log => log.id !== logId
      );

      setHealthLedger(updatedLogs);

      localStorage.setItem(
        'dairy_health_logs',
        JSON.stringify(updatedLogs)
      );

      alert('Record purged safely.');
    }
  };

  // =========================================================
  // PAGINATION
  // =========================================================

  const totalPages =
    Math.ceil(healthLedger.length / itemsPerPage) || 1;

  const currentLedgerSlice = healthLedger.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // =========================================================
  // RECURRING REMINDER DISPLAY HELPER
  // =========================================================

  const renderReminderMessage = reminder => {
    const today = getLocalDateString();

    if (reminder.reminderStatus === 'overdue') {
      const daysOverdue = getDaysDifference(
        reminder.nextDueDate,
        today
      );

      return `${daysOverdue} day${
        daysOverdue === 1 ? '' : 's'
      } overdue`;
    }

    if (reminder.reminderStatus === 'today') {
      return 'DUE TODAY';
    }

    const daysUntil = getDaysDifference(
      today,
      reminder.nextDueDate
    );

    return `Due in ${daysUntil} day${
      daysUntil === 1 ? '' : 's'
    }`;
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="health-log-page-container">

      {/* =====================================================
          SECTION 1: RECURRING HEALTH REMINDERS
          ===================================================== */}

      {recurringReminderRecords.length > 0 && (
        <div className="health-reminders-card">

          <div className="health-reminders-header">
            <div>
              <h2>Health & Treatment Reminders</h2>
              <p>
                Recurring treatments that need attention.
              </p>
            </div>

            <div className="health-reminder-counts">
              {overdueReminders.length > 0 && (
                <span className="reminder-count overdue">
                  {overdueReminders.length} Overdue
                </span>
              )}

              {todayReminders.length > 0 && (
                <span className="reminder-count today">
                  {todayReminders.length} Due Today
                </span>
              )}

              {upcomingReminders.length > 0 && (
                <span className="reminder-count upcoming">
                  {upcomingReminders.length} Upcoming
                </span>
              )}
            </div>
          </div>

          <div className="health-reminders-list">

            {recurringReminderRecords.map(reminder => (
              <div
                key={reminder.id}
                className={`health-reminder-item ${reminder.reminderStatus}`}
              >

                <div className="health-reminder-main">

                  <div className="health-reminder-status-icon">
                    {reminder.reminderStatus === 'overdue'
                      ? '!'
                      : reminder.reminderStatus === 'today'
                      ? '!'
                      : '•'}
                  </div>

                  <div className="health-reminder-details">

                    <strong>
                      {reminder.cowName || 'Unnamed Cow'}
                    </strong>

                    <span className="health-reminder-tag">
                      Tag: {reminder.cowTag || 'Unknown'}
                    </span>

                    <div className="health-reminder-treatment">
                      {reminder.diagnosis}
                    </div>

                    <div className="health-reminder-medication">
                      {reminder.medication}
                    </div>

                    <div className="health-reminder-due-line">
                      <strong>
                        {renderReminderMessage(reminder)}
                      </strong>

                      <span>
                        Scheduled:{' '}
                        {formatDateForDisplay(
                          reminder.nextDueDate
                        )}
                      </span>
                    </div>

                  </div>

                </div>

                <button
                  type="button"
                  className="record-reminder-btn"
                  onClick={() =>
                    handleRecordReminder(reminder)
                  }
                >
                  Record Treatment
                </button>

              </div>
            ))}

          </div>

        </div>
      )}

      {/* =====================================================
          SECTION 2: LOGGING INPUT PANEL
          ===================================================== */}

      <div className="health-form-card">

        <h2>Treatment & Health Logs</h2>

        {successMessage && (
          <div className="health-alert alert-success">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="health-alert alert-danger">
            {errorMessage}
          </div>
        )}

        {reminderSourceId && (
          <div className="recurring-entry-notice">
            <strong>Recurring treatment loaded</strong>

            <span>
              Review the information below. You can change the
              treatment date to the date the farmer actually
              administered the treatment.
            </span>

            <button
              type="button"
              onClick={() => {
                setReminderSourceId(null);
                setReminderSourceSeriesId(null);
              }}
            >
              Cancel Reminder Entry
            </button>
          </div>
        )}

        <form onSubmit={handleLogHealthSubmission}>

          {/* ADMINISTERED BY */}

          <div className="admin-toggle-field-row">

            <label className="field-group-label">
              Who Administered Treatment? *
            </label>

            <div className="toggle-button-group">

              <button
                type="button"
                className={
                  administeredBy === 'Farmer'
                    ? 'toggle-choice active'
                    : 'toggle-choice'
                }
                onClick={() =>
                  setAdministeredBy('Farmer')
                }
              >
                Farmer / Farm's Staff
              </button>

              <button
                type="button"
                className={
                  administeredBy === 'Vet'
                    ? 'toggle-choice active'
                    : 'toggle-choice'
                }
                onClick={() =>
                  setAdministeredBy('Vet')
                }
              >
                Vet
              </button>

            </div>
          </div>

          {/* COW + DATE */}

          <div className="health-row-grid">

            <div className="health-input-field">

              <label>Select Cow *</label>

              {activeHerd.length === 0 ? (
                <select
                  disabled
                  className="disabled-select"
                >
                  <option>
                    No active cow registered.
                  </option>
                </select>
              ) : (
                <select
                  value={selectedCowId}
                  onChange={e =>
                    setSelectedCowId(e.target.value)
                  }
                  required
                >
                  {activeHerd.map(cow => (
                    <option
                      key={cow.id}
                      value={cow.id}
                    >
                      {cow.name} (Tag: {cow.tagNumber}) •{' '}
                      {cow.status}
                    </option>
                  ))}
                </select>
              )}

            </div>

            <div className="health-input-field">

              <label>
                Treatment Date *
              </label>
              <input
                type="date"
                value={treatmentDate}
                max={getLocalDateString()}
                onChange={e =>
                  setTreatmentDate(e.target.value)
                }
                required
              />

            </div>

          </div>

          {/* DIAGNOSIS + MEDICATION */}

          <div className="health-row-grid">

            <div className="health-input-field">

              <label>
                Diagnosis / Reason for Treatment *
              </label>

              <input
                type="text"
                placeholder="e.g. Deworming, Mastitis, Tick Spray"
                value={diagnosis}
                onChange={e =>
                  setDiagnosis(e.target.value)
                }
                required
              />

            </div>

            <div className="health-input-field">

              <label>
                Medication Administered *
              </label>

              <input
                type="text"
                placeholder="e.g. Amoxyline Diamond..."
                value={medication}
                onChange={e =>
                  setMedication(e.target.value)
                }
                required
              />

            </div>

          </div>

          {/* VET + COST */}

          <div className="health-row-grid">

            {administeredBy === 'Vet' ? (
              <div className="health-input-field highlighted-vet-entry-box">

                <label>
                  Veterinarian Name *
                </label>

                <input
                  type="text"
                  placeholder="e.g. Dr. Mwangi"
                  value={vetName}
                  onChange={e =>
                    setVetName(e.target.value)
                  }
                  required
                />

              </div>
            ) : (
              <div className="health-input-field highlighted-farmer-entry-box">

                <label>
                  Treatment Provider
                </label>

                <input
                  type="text"
                  value="Self Administration (Staff)"
                  disabled
                />

              </div>
            )}

            <div className="health-input-field">

              <label>
                Total Medical Cost (KSh) *
              </label>

              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 1500"
                value={treatmentCost}
                onChange={e =>
                  setTreatmentCost(e.target.value)
                }
                required
              />

            </div>

          </div>

          {/* WITHDRAWAL + CONDITION */}

          <div className="health-row-grid">

            {isEligibleForMilkingWithdrawal ? (
              <div className="health-input-field active-withdrawal-entry-box">

                <label>
                  Milk Withdrawal Period (Days) *
                </label>

                <input
                  type="number"
                  min="0"
                  placeholder="Enter 0 if milk is safe for parlor"
                  value={withdrawalDays}
                  onChange={e =>
                    setWithdrawalDays(e.target.value)
                  }
                  required
                />

              </div>
            ) : (
              <div className="health-input-field disabled-withdrawal-entry-box">

                <label>
                  Milk Withdrawal Period
                </label>

                <input
                  type="text"
                  value="0 Days (Not a Milking Cow)"
                  disabled
                />

              </div>
            )}

            <div className="health-input-field">

              <label>
                Nature of Condition *
              </label>

              <select
                value={treatmentStatus}
                onChange={e =>
                  setTreatmentStatus(e.target.value)
                }
                required
              >
                <option value="One-time">
                  First time
                </option>

                <option value="Chronic">
                  Recurring / Follow-up Required
                </option>
              </select>

            </div>

          </div>

          {/* FREQUENCY + NEXT DATE */}

          <div className="health-row-grid">

            <div className="health-input-field">

              <label>
                Recurring Treatment / Procedure
              </label>

              <select
                value={frequency}
                onChange={e =>
                  setFrequency(e.target.value)
                }
              >
                <option value="None">
                  One-time Only
                </option>

                <option value="Every 3 months">
                  Every 3 months (e.g. Deworming)
                </option>

                <option value="Every 6 months">
                  Every 6 months
                </option>

                <option value="Annually">
                  Annually (e.g. Vaccination)
                </option>
              </select>

            </div>

            {frequency !== 'None' && (
              <div className="health-input-field recurring-next-date-box">

                <label>
                  Next Due Date
                </label>

                <input
                  type="text"
                  value={formatDateForDisplay(
                    calculateNextDueDate(
                      treatmentDate,
                      frequency
                    )
                  )}
                  disabled
                />

                <small>
                  Calculated from the treatment date above.
                </small>

              </div>
            )}

          </div>

          <button
            type="submit"
            className="commit-health-btn"
            disabled={activeHerd.length === 0}
          >
            Submit Medical Record
          </button>

        </form>

      </div>

      {/* =====================================================
          SECTION 3: HISTORICAL LEDGER
          ===================================================== */}

      <div className="health-ledger-card">

        <h2>
          Medical History ({healthLedger.length})
        </h2>

        {loading ? (
          <p className="empty-health-ledger-box">
            Loading medical history...
          </p>
        ) : healthLedger.length === 0 ? (
          <div className="empty-health-ledger-box">
            <p>
              No historical clinical treatments or
              vaccination entries registered yet.
            </p>
          </div>
        ) : (
          <>

            <div className="health-mobile-cards-stack">

              {currentLedgerSlice.map(log => {

                const isWithdrawalActive =
                  checkIsWithdrawalActive(
                    log.treatmentDate,
                    log.withdrawalDays
                  );

                const canThisRowWithdrawMilk =
                  log.withdrawalDays > 0;

                return (
                  <div
                    key={log.id}
                    className="health-record-item-row"
                  >

                    <div className="health-card-header-line">

                      <span className="health-date-label">
                        {formatDateForDisplay(
                          log.treatmentDate
                        )}
                      </span>

                      <div className="health-action-controls-cluster">

                        <button
                          type="button"
                          className="inline-action-link-btn edit"
                          onClick={() =>
                            handleStartInlineEdit(log)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="inline-action-link-btn delete"
                          onClick={() =>
                            handleDeleteRecord(log.id)
                          }
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                    {editingLogId === log.id ? (

                      <div className="inline-health-adjustment-drawer animate-fade">

                        <div className="inline-edit-field">

                          <label>
                            Diagnosis:
                          </label>

                          <input
                            type="text"
                            value={editDiagnosis}
                            onChange={e =>
                              setEditDiagnosis(
                                e.target.value
                              )
                            }
                          />

                        </div>

                        <div className="inline-edit-field">

                          <label>
                            Cost (KSh):
                          </label>

                          <input
                            type="number"
                            min="0"
                            value={editCost}
                            onChange={e =>
                              setEditCost(
                                e.target.value
                              )
                            }
                          />

                        </div>

                        {log.withdrawalDays !==
                          undefined && (
                          <div className="inline-edit-field">

                            <label>
                              Withdrawal Days:
                            </label>

                            <input
                              type="number"
                              min="0"
                              value={editWithdrawal}
                              disabled={
                                log.withdrawalDays === 0
                              }
                              onChange={e =>
                                setEditWithdrawal(
                                  e.target.value
                                )
                              }
                            />

                          </div>
                        )}

                        <div className="inline-edit-field">

                          <label>
                            Condition's Nature:
                          </label>

                          <select
                            value={editStatus}
                            onChange={e =>
                              setEditStatus(
                                e.target.value
                              )
                            }
                          >
                            <option value="One-time">
                              One-time
                            </option>

                            <option value="Chronic">
                              Chronic
                            </option>
                          </select>

                        </div>

                        <div className="inline-edit-buttons-row">

                          <button
                            type="button"
                            className="inline-save-adjust-btn"
                            onClick={() =>
                              handleSaveInlineAdjustment(
                                log.id,
                                log.withdrawalDays > 0
                              )
                            }
                          >
                            Apply
                          </button>

                          <button
                            type="button"
                            className="inline-cancel-adjust-btn"
                            onClick={() =>
                              setEditingLogId(null)
                            }
                          >
                            Cancel
                          </button>

                        </div>

                      </div>

                    ) : (

                      <div className="health-card-body-details">

                        <div className="health-title-cost-flex">

                          <h4>
                            <strong>
                              {log.cowName}
                            </strong>{' '}

                            <small>
                              ({log.cowTag})
                            </small>{' '}

                            •{' '}

                            <span className="diagnosis-highlight">
                              {log.diagnosis}
                            </span>
                          </h4>

                          <span className="health-cost-tag">
                            KSh{' '}
                            {Number(
                              log.cost || 0
                            ).toLocaleString()}
                          </span>

                        </div>

                        <p className="med-line-text">
                          Drug:{' '}
                          <strong>
                            {log.medication}
                          </strong>{' '}
                          • Administered By:{' '}
                          {log.vetName}
                        </p>

                        {log.nextDueDate && (
                          <p className="next-due-text">

                            Next Due:{' '}

                            {formatDateForDisplay(
                              log.nextDueDate
                            )}

                            {log.frequency !==
                              'None' && (
                              <span className="recurring-history-label">
                                Recurring
                              </span>
                            )}

                          </p>
                        )}

                        <div className="health-status-badge-line">

                          <span
                            className={
                              log.treatmentStatus ===
                              'Chronic'
                                ? 'care-status-pill work'
                                : 'care-status-pill done'
                            }
                          >
                            {log.treatmentStatus ===
                            'Chronic'
                              ? 'Chronic (Follow-up)'
                              : 'One-time Event'}
                          </span>

                          {!canThisRowWithdrawMilk ? (

                            <span className="milk-safety-alert-badge neutral">
                              Non-Milking Cow
                            </span>

                          ) : isWithdrawalActive ? (

                            <span className="milk-safety-alert-badge dump">
                              DUMP MILK (
                              {log.withdrawalDays}{' '}
                              Days)
                            </span>

                          ) : (

                            <span className="milk-safety-alert-badge safe">
                              Safe / Clean Milk
                            </span>

                          )}

                        </div>

                      </div>

                    )}

                  </div>
                );
              })}

            </div>

            {/* PAGINATION */}

            {totalPages > 1 && (
              <div className="health-pagination-deck">

                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage(
                      page => page - 1
                    )
                  }
                >
                  ◀ Prev
                </button>

                <span className="page-indicator-text">
                  Page{' '}
                  <strong>
                    {currentPage}
                  </strong>{' '}
                  of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={
                    currentPage === totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      page => page + 1
                    )
                  }
                >
                  Next ▶
                </button>

              </div>
            )}

          </>
        )}

      </div>

    </div>
  );
}

export default HealthLog;
