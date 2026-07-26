import React, { useState, useEffect } from 'react';
import './FeedLog.css';

function FeedLog() {
  // --- STATE 1: MASTER CATALOG STATES (The Shopping List) ---
  const [catalogItems, setCatalogItems] = useState([]);
  const [newCatalogItem, setNewCatalogItem] = useState('');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  // --- STATE 2: REUSABLE MASTER COWS LIST (For Checkboxes) ---
  const [herd, setHerd] = useState([]);

  // --- STATE 3: ALLOCATION FORM STATES (The Receipt Entry) ---
  const [selectedFeedType, setSelectedFeedType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [allocationType, setAllocationType] = useState('Group'); // Group vs Multi-Cow
  const [targetGroup, setTargetGroup] = useState('All Herd'); // All, Milking, Pregnant, Calf, Heifer
  const [selectedCowIds, setSelectedCowIds] = useState([]); // Holds multi-cow checked arrays

  // --- STATE 4: ALLOCATION MASTER TABLE STATES (The Ledger Sheets) ---
  const [feedReceipts, setFeedReceipts] = useState([]);
  const [dateFilter, setDateFilter] = useState('All'); // All, Week, Month
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // --- STATE 5: RECEIPT IN-LINE EDIT TRACKERS ---
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editCost, setEditCost] = useState('');


  // --- ENGINE 1: INITIAL DIRECTORY SYNC LOOP ---
  useEffect(() => {
    // A. Load Master Feed Types Catalog list
    const savedCatalog = localStorage.getItem('dairy_feed_catalog');
    if (savedCatalog) {
      setCatalogItems(JSON.parse(savedCatalog));
    } else {
      const initialCatalog = ['Dairy Meal', 'Silage', 'Alfalfa Hay', 'Pre-Natal Minerals'];
      setCatalogItems(initialCatalog);
      localStorage.setItem('dairy_feed_catalog', JSON.stringify(initialCatalog));
    }

    // B. Load Master Herd List for our checkbox selector grid matrix
    const savedHerd = localStorage.getItem('dairy_herd') || '[]';
    const parsedHerd = JSON.parse(savedHerd);
    
    // 🔏 THE LOCKDOWN FIX: Filter out any archived animals so they don't appear in the feed assignment list!
    const activeHerdOnly = parsedHerd.filter(animal => !animal.status.startsWith('Archived'));
    setHerd(activeHerdOnly);

    // C. Load All Historical Feed Receipts Allocation database rows
    const savedReceipts = localStorage.getItem('dairy_feed_receipts') || '[]';
    setFeedReceipts(JSON.parse(savedReceipts));
  }, []);

  // Set the first item of the catalog as default select option once loaded
  useEffect(() => {
    if (catalogItems.length > 0 && !selectedFeedType) {
      setSelectedFeedType(catalogItems[0]);
    }
  }, [catalogItems]);

  // --- ENGINE 2: INVENTORY ITEMS HANDLERS ---
  const handleAddCatalogItem = (e) => {
    e.preventDefault();
    if (!newCatalogItem.trim()) return;

    if (catalogItems.includes(newCatalogItem.trim())) {
      alert('❌ This feed type already exists in your inventory selection dropdown list!');
      return;
    }

    const updatedCatalog = [...catalogItems, newCatalogItem.trim()];
    setCatalogItems(updatedCatalog);
    localStorage.setItem('dairy_feed_catalog', JSON.stringify(updatedCatalog));
    setNewCatalogItem('');
  };

  const handleDeleteCatalogItem = (itemToDelete) => {
    const updatedCatalog = catalogItems.filter(item => item !== itemToDelete);
    setCatalogItems(updatedCatalog);
    localStorage.setItem('dairy_feed_catalog', JSON.stringify(updatedCatalog));
    if (selectedFeedType === itemToDelete) setSelectedFeedType(updatedCatalog[0] || '');
  };

  // --- ENGINE 3: CHECKBOX SELECTION LISTENER ---
  const handleToggleCowCheckbox = (cowId) => {
    if (selectedCowIds.includes(cowId)) {
      setSelectedCowIds(selectedCowIds.filter(id => id !== cowId)); // remove if unchecked
    } else {
      setSelectedCowIds([...selectedCowIds, cowId]); // add if checked
    }
  };

  // --- ENGINE 4: RECORDING EXPENSE SUBMISSION SHEET ---
  const handleLogFeedAllocation = (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!selectedFeedType) return setErrorMessage('❌ Please create or select a Feed/Mineral item type.');
    if (!quantity || parseFloat(quantity) <= 0) return setErrorMessage('❌ Please enter a valid quantity.');
    if (!totalCost || parseFloat(totalCost) <= 0) return setErrorMessage('❌ Please enter a valid total money expense cost.');
    
    if (allocationType === 'Multi-Cow' && selectedCowIds.length === 0) {
      return setErrorMessage('❌ Multi-Cow Selection Error: Please check at least one cow box!');
    }

    // Build unique data receipt invoice payload
    const newFeedReceipt = {
      id: Date.now(),
      feedType: selectedFeedType,
      qty: parseFloat(quantity),
      cost: parseFloat(totalCost),
      purchaseDate: new Date().toISOString().split('T')[0], // Locked automatically to today's local string
      allocationType,
      targetGroup: allocationType === 'Group' ? targetGroup : '',
      targetCowIds: allocationType === 'Multi-Cow' ? selectedCowIds : [] // saves the exact target checked array
    };

    const updatedReceipts = [newFeedReceipt, ...feedReceipts];
    setFeedReceipts(updatedReceipts);
    localStorage.setItem('dairy_feed_receipts', JSON.stringify(updatedReceipts));

    // Clear Allocation Fields
    setQuantity('');
    setTotalCost('');
    setSelectedCowIds([]);
    setCurrentPage(1); // Back to page 1

    setSuccessMessage('🎉 Feed transaction purchase logged successfully to offline ledger!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // --- ENGINE 5: TIME WINDOW DATE FILTER MATRICES ---
  const filteredReceipts = feedReceipts.filter(receipt => {
    if (dateFilter === 'All') return true;

    const receiptDate = new Date(receipt.purchaseDate);
    const today = new Date();
    
    if (dateFilter === 'Week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(today.getDate() - 7);
      return receiptDate >= oneWeekAgo;
    }
    
    if (dateFilter === 'Month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(today.getDate() - 30);
      return receiptDate >= oneMonthAgo;
    }
    return true;
  });

  // --- ENGINE 6: PAGINATION CALCULATIONS ---
  const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage) || 1;
  const currentSlice = filteredReceipts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- ENGINE 7: IN-LINE RECEIPT LEDGER MODIFICATION ACTIONS ---
  const handleStartEditReceipt = (receipt) => {
    setEditingReceiptId(receipt.id);
    setEditQty(receipt.qty);
    setEditCost(receipt.cost);
  };

  const handleSaveInlineReceiptEdit = (receiptId) => {
    if (!editQty || parseFloat(editQty) <= 0 || !editCost || parseFloat(editCost) <= 0) {
      alert('❌ Please enter valid quantity and financial expense adjustments!');
      return;
    }

    const updatedMasterList = feedReceipts.map((receipt) => {
      if (receipt.id === receiptId) {
        return {
          ...receipt,
          qty: parseFloat(editQty),
          cost: parseFloat(editCost)
        };
      }
      return receipt;
    });

    setFeedReceipts(updatedMasterList);
    localStorage.setItem('dairy_feed_receipts', JSON.stringify(updatedMasterList));
    setEditingReceiptId(null); // Close the adjustment panel
    alert('✏️ Feed purchase receipt modified successfully!');
  };

  const handleDeleteReceipt = (receiptId) => {
    if (window.confirm('⚠️ Are you sure you want to completely erase this feed expense receipt from history?')) {
      const updatedMasterList = feedReceipts.filter(receipt => receipt.id !== receiptId);
      setFeedReceipts(updatedMasterList);
      localStorage.setItem('dairy_feed_receipts', JSON.stringify(updatedMasterList));
      alert('🗑️ Receipt item purged safely.');
    }
  };

  return (
    <div className="feed-log-page-wrapper">
      
      {/* SECTION 1: INVENTORY MANAGEMENT CATALOG TOGGLE */}
      <div className="feed-card-box">
        <div className="catalog-header-row" onClick={() => setIsCatalogOpen(!isCatalogOpen)}>
          <h2>📦 Manage Feed & Minerals Catalog List</h2>
          <button type="button" className="toggle-drawer-arrow">{isCatalogOpen ? '▲ Close' : '▼ Open List'}</button>
        </div>

        {isCatalogOpen && (
          <div className="catalog-dropdown-drawer animate-fade">
            <form onSubmit={handleAddCatalogItem} className="catalog-add-inline-form">
              <input 
                type="text" 
                placeholder="e.g. Dairy Meal 16% Max" 
                value={newCatalogItem} 
                onChange={(e) => setNewCatalogItem(e.target.value)} 
                required 
              />
              <button type="submit">➕ Add Item</button>
            </form>

            <ul className="catalog-items-unordered-list">
              {catalogItems.map((item, index) => (
                <li key={index} className="catalog-list-row-item">
                  <span>🌾 {item}</span>
                  <button type="button" onClick={() => handleDeleteCatalogItem(item)} className="catalog-row-delete-btn">Delete ✕</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* SECTION 2: THE EXPENSE PURCHASE LOGGING FORM */}
      <div className="feed-card-box">
        <h2>💰 Log Feed Allocation Expense Receipt</h2>
        
        {successMessage && <div className="feed-alert alert-success">{successMessage}</div>}
        {errorMessage && <div className="feed-alert alert-danger">{errorMessage}</div>}

        <form onSubmit={handleLogFeedAllocation}>
          <div className="feed-row-grid">
            <div className="feed-input-field">
              <label>Select Catalog Feed Item *</label>
              <select value={selectedFeedType} onChange={(e) => setSelectedFeedType(e.target.value)} required>
                {catalogItems.map((item, i) => <option key={i} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="feed-input-field">
              <label>Total Quantity (kg/liters) *</label>
              <input type="number" step="0.1" placeholder="e.g. 50" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
          </div>

          <div className="feed-row-grid">
            <div className="feed-input-field">
              <label>Total Financial Cost ($) *</label>
              <input type="number" step="0.01" placeholder="e.g. 240.00" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} required />
            </div>
            <div className="feed-input-field">
              <label>Allocation Distribution Target *</label>
              <select value={allocationType} onChange={(e) => setAllocationType(e.target.value)} required>
                <option value="Group">Assign to Status Production Group</option>
                <option value="Multi-Cow">Assign to Specific Multi-Cows Checkbox List</option>
              </select>
            </div>
          </div>

          {/* DYNAMIC FIELD CONDITIONAL VIEWPORTS */}
          {allocationType === 'Group' ? (
            <div className="feed-input-field highlighted-group-viewport">
              <label>Select Production Target Group *</label>
              <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)}>
                <option value="All Herd">🌍 Whole Herd Group (All Animals)</option>
                <option value="Milking">🐄 Milking Cows Group</option>
                <option value="Pregnant">🤰 Pregnant Heifers Group</option>
                <option value="Calf">🍼 Calves Group</option>
                <option value="Heifer">🌾 Standard Heifers Group</option>
              </select>
            </div>
          ) : (
            <div className="feed-input-field highlighted-cows-checkbox-viewport">
              <label>Check All Targets Receiving This Feed Ration *</label>
              {herd.length === 0 ? (
                <p className="no-cows-alert">⚠️ Please register animals inside your Cow Registry first.</p>
              ) : (
                <div className="checkbox-scrollable-grid-frame">
                  {herd.map((cow) => (
                    <label key={cow.id} className="checkbox-grid-row-card">
                      <input 
                        type="checkbox" 
                        checked={selectedCowIds.includes(cow.id)} 
                        onChange={() => handleToggleCowCheckbox(cow.id)} 
                      />
                      <span><strong>{cow.name}</strong> <small>({cow.tagNumber}) • {cow.status}</small></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="submit" className="commit-allocation-btn">💾 Log Allocation & Expense</button>
        </form>
      </div>

      {/* SECTION 3: FILTERABLE RECEIPTS MANAGEMENT LEDGER */}
      <div className="feed-card-box">
        <div className="ledger-header-row-flex">
          <h2>📋 Financial Feed Ledger</h2>
          <div className="filter-button-deck-wrapper">
            <button type="button" className={dateFilter === 'All' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setDateFilter('All'); setCurrentPage(1); }}>All</button>
            <button type="button" className={dateFilter === 'Week' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setDateFilter('Week'); setCurrentPage(1); }}>Week</button>
            <button type="button" className={dateFilter === 'Month' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setDateFilter('Month'); setCurrentPage(1); }}>Month</button>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="empty-ledger-notice">🌾 No feed transactions registered within this selected time window.</div>
        ) : (
          <>
            <div className="receipt-mobile-cards-stack">
              {currentSlice.map((receipt) => (
                <div key={receipt.id} className="receipt-card-item-row">
                  <div className="receipt-card-header-line">
                    <span className="receipt-date-label">📅 {new Date(receipt.purchaseDate).toLocaleDateString()}</span>
                    
                    <div className="receipt-action-controls-cluster">
                      <button type="button" className="inline-action-link-btn edit" onClick={() => handleStartEditReceipt(receipt)}>✏️ Edit</button>
                      <button type="button" className="inline-action-link-btn delete" onClick={() => handleDeleteReceipt(receipt.id)}>✕ Purge</button>
                    </div>
                  </div>

                  {editingReceiptId === receipt.id ? (
                    /* DROPDOWN ADJUSTMENT BOX VIEWPORT FOR HUMAN PROOFING */
                    <div className="inline-receipt-adjustment-drawer animate-fade">
                      <div className="inline-edit-field">
                        <label>Adjust Weight (kg/L):</label>
                        <input type="number" step="0.1" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                      </div>
                      <div className="inline-edit-field">
                        <label>Adjust Cost ($):</label>
                        <input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} />
                      </div>
                      <div className="inline-edit-buttons-row">
                        <button type="button" className="inline-save-adjust-btn" onClick={() => handleSaveInlineReceiptEdit(receipt.id)}>Apply</button>
                        <button type="button" className="inline-cancel-adjust-btn" onClick={() => setEditingReceiptId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* REGULAR LEDGER DISPLAY VIEWPORT */
                    <div className="receipt-card-body-details">
                      <div className="feed-title-cost-flex">
                        <h4>Feed: <strong>{receipt.feedType}</strong> ({receipt.qty} kg/L)</h4>
                        <span className="receipt-cost-tag">-${receipt.cost.toFixed(2)}</span>
                      </div>
                      <p>
                        Distribution: {receipt.allocationType === 'Group' ? (
                          <span className="allocation-indicator group">🌍 Group: {receipt.targetGroup}</span>
                        ) : (
                          <span className="allocation-indicator individual">🐄 Multi-Cow ({receipt.targetCowIds.length} checked)</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* QUICK TAP PAGINATION ROW FOOTER */}
            {totalPages > 1 && (
              <div className="feed-pagination-deck">
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

export default FeedLog;
