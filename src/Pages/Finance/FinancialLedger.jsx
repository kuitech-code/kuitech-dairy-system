import React, { useState, useEffect } from 'react';
import './FinancialLedger.css';

function FinancialLedger() {
  // --- STATE 1: CORE DATA STORAGE ARRAYS ---
  const [milkLogs, setMilkLogs] = useState([]);
  const [livestockSales, setLivestockSales] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [feedLogs, setFeedLogs] = useState([]);
  const [breedingLogs, setBreedingLogs] = useState([]);
  const [manualIncomes, setManualIncomes] = useState([]);
  const [manualExpenses, setManualExpenses] = useState([]);

  // --- STATE 2: PERSISTENT MILK PRICE SETTING ---
  const [milkPrice, setMilkPrice] = useState(() => {
    return parseFloat(localStorage.getItem('dairy_global_milk_price')) || 40;
  });
  const [isChangingPrice, setIsChangingPrice] = useState(false);
  const [tempPriceInput, setEditTempPriceInput] = useState('');

  // --- STATE 3: MANUAL TRANSACTION ENTRY FORMS ---
  const [formMode, setFormTypeMode] = useState('Expense'); // 🔒 Fixed variable linkage
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // --- STATE 4: STATEMENT FILTERS ---
  const [filterType, setFilterType] = useState('All'); 
  const [monthFilter, setMonthFilter] = useState(''); 

  // --- STATE 5: UI TABLE PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // --- ENGINE 1: READ MASTER MEMORY STORAGE ---
  useEffect(() => {
    hydrateLedgerTerminal();
  }, []);

  const hydrateLedgerTerminal = () => {
    setMilkLogs(JSON.parse(localStorage.getItem('dairy_milk_logs') || '[]'));
    setHealthLogs(JSON.parse(localStorage.getItem('dairy_health_logs') || '[]'));
    setFeedLogs(JSON.parse(localStorage.getItem('dairy_feed_receipts') || '[]'));
    setManualIncomes(JSON.parse(localStorage.getItem('dairy_manual_incomes') || '[]'));
    setManualExpenses(JSON.parse(localStorage.getItem('dairy_manual_expenses') || '[]'));
    setBreedingLogs(JSON.parse(localStorage.getItem('dairy_breeding_events') || '[]').filter(e => e.eventType === 'Insemination' && e.cost > 0));

    const herd = JSON.parse(localStorage.getItem('dairy_herd') || '[]');
    setLivestockSales(herd.filter(cow => cow.status.startsWith('Archived (Sold)')));
  };

  const handleSaveMilkPriceSetting = (e) => {
    e.preventDefault();
    const parsedRate = parseFloat(tempPriceInput) || 0;
    if (parsedRate <= 0) return alert('❌ Error: Price must be greater than 0.');
    
    localStorage.setItem('dairy_global_milk_price', parsedRate.toString());
    setMilkPrice(parsedRate);
    setIsChangingPrice(false);
    setEditTempPriceInput('');
  };

  const handleSaveManualTransaction = (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(txAmount) || 0;
    if (parsedAmount <= 0 || !txDescription.trim()) {
      alert('❌ Validation Error: Complete required fields.');
      return;
    }

    const newTxRecord = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0], // Today's Date String
      description: txDescription.trim(),
      amount: parsedAmount,
      notes: txNotes.trim()
    };

    if (formMode === 'Income') {
      const updated = [newTxRecord, ...manualIncomes];
      setManualIncomes(updated);
      localStorage.setItem('dairy_manual_incomes', JSON.stringify(updated));
    } else {
      const updated = [newTxRecord, ...manualExpenses];
      setManualExpenses(updated);
      localStorage.setItem('dairy_manual_expenses', JSON.stringify(updated));
    }

    setTxDescription('');
    setTxAmount('');
    setTxNotes('');
    setSuccessMessage(`Saved to ${formMode} ledger ledger lines!`);
    hydrateLedgerTerminal();
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  const handleDeleteManualItem = (recordId, typeKey) => {
    if (window.confirm('Reset item statement?')) {
      if (typeKey === 'Income') {
        const filtered = manualIncomes.filter(item => item.id !== recordId);
        setManualIncomes(filtered);
        localStorage.setItem('dairy_manual_incomes', JSON.stringify(filtered));
      } else {
        const filtered = manualExpenses.filter(item => item.id !== recordId);
        setManualExpenses(filtered);
        localStorage.setItem('dairy_manual_expenses', JSON.stringify(filtered));
      }
      hydrateLedgerTerminal();
    }
  };

  // --- ENGINE 2: UNIFIED COMPILATION AND ABSOLUTE CHRONO-SORTING ---
  const compiledStatementsList = [];
  const currentMonthString = new Date().toISOString().slice(0, 7); // Active Month Key

  let monthlyIncomeTotal = 0;
  let monthlyExpenseTotal = 0;
  let monthlyMilkTotal = 0;
  let monthlySaleTotal = 0;

  // A. Process Milk Records
  milkLogs.forEach(log => {
    const logMonth = log.record_date.slice(0, 7);
    // 🔒 PRICE REVERSION PROTECTION: Fall back to historic baked values if found, otherwise use settings rate
    const activeRate = log.milkPriceAtLogging || milkPrice;
    const computedRevenue = log.total_daily_milk * activeRate;

    if (logMonth === currentMonthString) {
      monthlyIncomeTotal += computedRevenue;
      monthlyMilkTotal += computedRevenue;
    }

    compiledStatementsList.push({
      id: `milk-${log.id}`,
      timestamp: log.id,
      date: log.record_date,
      type: 'Income',
      category: 'Milk Yields',
      description: `Milk Log - ${log.cowName} (${log.cowTag})`,
      amount: computedRevenue,
      notes: `${log.total_daily_milk}L calculated at KSH ${activeRate}/L.`
    });
  });

  // B. Process Livestock Sales
  livestockSales.forEach(cow => {
    const notesText = cow.notes || '';
    const matchPrice = notesText.match(/Ksh\s*(\d+)/) || notesText.match(/\$(\d+)/) || [0, 45000];
    const parsedPrice = parseFloat(matchPrice[1]) || 45000;

    monthlyIncomeTotal += parsedPrice;
    monthlySaleTotal += parsedPrice;

    compiledStatementsList.push({
      id: `sale-${cow.id}`,
      timestamp: cow.id,
      date: new Date().toISOString().split('T')[0],
      type: 'Income',
      category: 'Asset Sale',
      description: `Sold ${cow.name} (Tag ID: ${cow.tagNumber})`,
      amount: parsedPrice,
      notes: cow.notes
    });
  });

  // C. Process Manual Incomes
  manualIncomes.forEach(inc => {
    if (inc.date.slice(0, 7) === currentMonthString) monthlyIncomeTotal += inc.amount;
    compiledStatementsList.push({ ...inc, type: 'Income', category: 'Manual Income', timestamp: inc.id });
  });

  // D. Process Feed Costs
  feedLogs.forEach(feed => {
    if (feed.purchaseDate.slice(0, 7) === currentMonthString) monthlyExpenseTotal += feed.cost;
    compiledStatementsList.push({
      id: `feed-${feed.id}`,
      timestamp: feed.id,
      date: feed.purchaseDate,
      type: 'Expense',
      category: 'Feed Supplies',
      description: `Feed Purchase: ${feed.feedType}`,
      amount: feed.cost,
      notes: `${feed.qty} kg/L logged.`
    });
  });

  // E. Process Health Costs
  healthLogs.forEach(health => {
    if (health.treatmentDate.slice(0, 7) === currentMonthString) monthlyExpenseTotal += health.cost;
    compiledStatementsList.push({
      id: `health-${health.id}`,
      timestamp: health.id,
      date: health.treatmentDate,
      type: 'Expense',
      category: 'Medical / Vet',
      description: `${health.cowName} - Treated for ${health.diagnosis}`,
      amount: health.cost,
      notes: `Administered by: ${health.vetName}`
    });
  });

  // F. Process Breeding Service Costs
  breedingLogs.forEach(event => {
    if (event.eventDate.slice(0, 7) === currentMonthString) monthlyExpenseTotal += event.cost;
    compiledStatementsList.push({
      id: `ai-${event.id}`,
      timestamp: event.id,
      date: event.eventDate,
      type: 'Expense',
      category: 'Breeding Services',
      description: `AI Insemination: ${event.cowName}`,
      amount: event.cost,
      notes: `Straw Code: ${event.semenTag}`
    });
  });

  // G. Process Manual Expenses
  manualExpenses.forEach(exp => {
    if (exp.date.slice(0, 7) === currentMonthString) monthlyExpenseTotal += exp.amount;
    compiledStatementsList.push({ ...exp, type: 'Expense', category: 'Operational Expense', timestamp: exp.id });
  });

  // 🔒 CRITICAL CHRONO-SORT ENGINE: Pulls absolute recent entries straight to the top of list
  compiledStatementsList.sort((a, b) => {
    const compareDates = new Date(b.date) - new Date(a.date);
    if (compareDates !== 0) return compareDates; // Primary sort: Calendar Day
    return b.timestamp - a.timestamp; // Secondary fallback fallback: Submission ID Time
  });

  // Filter application layers
  const filteredStatements = compiledStatementsList.filter(item => {
    if (filterType === 'Income' && item.type !== 'Income') return false;
    if (filterType === 'Expenses' && item.type !== 'Expense') return false;
    if (monthFilter && item.date.slice(0, 7) !== monthFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredStatements.length / itemsPerPage) || 1;
  const currentViewSlice = filteredStatements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="finance-ledger-page-container">
      
      {/* 📊 SECTION 1: FLEXBOX MOBILE SUMMARY MATRIX GRID */}
      <div className="finance-section-title-header">
        <h3>Summary: This Month</h3>
      </div>
      <div className="financial-brief-flexbox-row">
        <div className="brief-flex-card green-gain">
          <span className="card-label">Income</span>
          <p>KSH {monthlyIncomeTotal.toLocaleString()}</p>
        </div>
        <div className="brief-flex-card red-loss">
          <span className="card-label">Expenses</span>
          <p>KES {monthlyExpenseTotal.toLocaleString()}</p>
        </div>
        <div className={`brief-flex-card net-profit-yield ${monthlyIncomeTotal - monthlyExpenseTotal >= 0 ? 'surplus' : 'deficit'}`}>
          <span className="card-label">Profit</span>
          <p>KES {(monthlyIncomeTotal - monthlyExpenseTotal).toLocaleString()}</p>
        </div>
      </div>

      <div className="financial-brief-flexbox-row breakdown-row">
        <div className="brief-flex-card breakdown-sub">
          <span className="card-label">Milk</span>
          <small>KSH {monthlyMilkTotal.toLocaleString()}</small>
        </div>
        <div className="brief-flex-card breakdown-sub">
          <span className="card-label">Cattle Sales</span>
          <small>KSH {monthlySaleTotal.toLocaleString()}</small>
        </div>
      </div>

      {/* ⚙️ SECTION 2: THE PERSISTENT MILK PRICE SETTING WIDGET */}
      <div className="finance-card-box settings-price-card">
        <h2>Milk Price Settings</h2>
        <div className="price-display-deck-row">
          <div>
            <p className="price-label-text">Current Rate:</p>
            <h3>KSH <strong>{milkPrice}</strong> per litre</h3>
          </div>
          {!isChangingPrice ? (
            <button type="button" className="price-adjust-trigger-btn" onClick={() => setIsChangingPrice(true)}>Change Price</button>
          ) : (
            <form onSubmit={handleSaveMilkPriceSetting} className="price-inline-adjust-form animate-fade">
              <input type="number" step="0.5" placeholder="KSH" value={tempPriceInput} onChange={(e) => setEditTempPriceInput(e.target.value)} required />
              <button type="submit" className="price-save-action-btn">Lock</button>
              <button type="button" className="price-cancel-action-btn" onClick={() => setIsChangingPrice(false)}>✕</button>
            </form>
          )}
        </div>
      </div>

      {/* ✍️ SECTION 3 & 4: OPEN FLEX RECORDER SHUTTLE DRAWER */}
      <div className="finance-card-box">
        <h2>Record Custom Entry</h2>
        {successMessage && <div className="finance-flash-banner success">{successMessage}</div>}
        
        <form onSubmit={handleSaveManualTransaction}>
          <div className="form-toggle-bar">
            {/* 🔒 FIX: Re-mapped onClick target anchors to communicate seamlessly with setFormTypeMode */}
            <button type="button" className={formMode === 'Expense' ? 'toggle-tab active' : 'toggle-tab'} onClick={() => setFormTypeMode('Expense')}>New Expense</button>
            <button type="button" className={formMode === 'Income' ? 'toggle-tab active' : 'toggle-tab'} onClick={() => setFormTypeMode('Income')}>New Income</button>
          </div>

          <div className="finance-form-row">
            <div className="finance-input-element" style={{ flex: 2 }}>
              <label>Description (items name) *</label>
              <input type="text" placeholder={formMode === 'Expense' ? "e.g. Worker wages, Wheelbarrow" : "e.g. Sold Manure..."} value={txDescription} onChange={(e) => setTxDescription(e.target.value)} required />
            </div>
            <div className="finance-input-element" style={{ flex: 1 }}>
              <label>Amount (KSH) *</label>
              <input type="number" placeholder="KSH" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} required />
            </div>
          </div>

          <div className="finance-input-element">
            <label>Optional Notes</label>
            <input type="text" placeholder="Add specific voucher descriptions..." value={txNotes} onChange={(e) => setTxNotes(e.target.value)} />
          </div>

          <button type="submit" className={`commit-tx-btn ${formMode.toLowerCase()}`}>
            Save {formMode} Entry
          </button>
        </form>
      </div>

      {/* 🔍 SECTION 5 & 6: STATEMENT LEDGER TIMELINE GRID SEARCH TABLE */}
      <div className="finance-card-box table-ledger-sheet-box">
        <div className="table-header-flex-controls-deck">
          <h2>Financial Statements ({filteredStatements.length})</h2>
          <div className="controls-flex-inputs-row">
            <input type="month" className="month-search-input" value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setCurrentPage(1); }} />
            <select className="type-select-dropdown" value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}>
              <option value="All">All</option>
              <option value="Income">Income (+)</option>
              <option value="Expenses">Expenses (-)</option>
            </select>
          </div>
        </div>

        {filteredStatements.length === 0 ? (
          <div className="empty-ledger-notice-card">No entries found.</div>
        ) : (
          <>
            <div className="statement-cards-mobile-stack">
              {currentViewSlice.map((entry) => (
                <div key={entry.id} className={`statement-card-row-item ${entry.type.toLowerCase()}`}>
                  <div className="statement-row-top-line">
                    <span className="statement-row-date">{new Date(entry.date).toLocaleDateString()}</span>
                    <span className={`statement-row-cash-badge ${entry.type === 'Income' ? 'gain' : 'loss'}`}>
                      {entry.type === 'Income' ? '+' : '-'} KSH {entry.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="statement-row-body-line">
                    <h4>{entry.description}</h4>
                    <small className="statement-category-tag">{entry.category}</small>
                    {entry.notes && <p className="statement-notes-subtext"><em>Notes: {entry.notes}</em></p>}
                    {entry.isManual && (
                      <button type="button" className="manual-tx-delete-trigger" onClick={() => handleDeleteManualItem(entry.id, entry.type)}>✕ Delete Line</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* NAVIGATION FOOTERS */}
            {totalPages > 1 && (
              <div className="finance-pagination-deck">
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

export default FinancialLedger;
