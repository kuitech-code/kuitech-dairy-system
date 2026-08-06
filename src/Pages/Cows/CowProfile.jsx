import React, { useState, useEffect } from 'react';
import CowForm from '../../components/CowForm';
import './CowProfile.css';

function CowProfile({ cowId, onBackToList }) {
  // Core States
  const [cow, setCow] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- HUMAN PROOFING EDIT STATES ---
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editSireTag, setEditSireTag] = useState('');
  const [editDamTag, setEditDamTag] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Milk History & Feed States (Set empty as requested, ready for future data)
  const [milkHistory, setMilkHistory] = useState([]);
  const [milkCurrentPage, setMilkCurrentPage] = useState(1);
  const [feedHistory, setFeedHistory] = useState([]);
  const [feedCurrentPage, setFeedCurrentPage] = useState(1);
  const [healthHistory, setHealthHistory] = useState([]);
  const [feedDateFilter, setFeedDateFilter] = useState('All'); // All, Week, Month
  const itemsPerPage = 5;

  // Breed/Status dropdown lists for editing validation
  const statusOptions = ['Calf', 'Heifer', 'Pregnant', 'Milking'];

  // Load Cow Data from local storage
    useEffect(() => {
    const savedHerd = localStorage.getItem('dairy_herd');
    if (savedHerd) {
      const foundCow = JSON.parse(savedHerd).find((animal) => animal.id === cowId);
      if (foundCow) {
        setCow(foundCow);
        // Pre-fill edit fields just in case they click edit
        setEditName(foundCow.name);
        setEditStatus(foundCow.status);
        setEditSireTag(foundCow.sireTag === 'Unknown' ? '' : foundCow.sireTag);
        setEditDamTag(foundCow.damTag === 'Unknown' ? '' : foundCow.damTag);
        setEditNotes(foundCow.notes);
      }
    }
    setLoading(false);
  }, [cowId]);

  // 🎯 REAL TIME LOOKUP ENGINE: Reads matching records from local storage safely
  useEffect(() => {
    // 🚀 THE FIX: If the cow data isn't ready yet, turn off history loading and wait.
    if (!cow) {
      setHistoryLoading(false);
      return;
    }

    if (activeTab === 'Milk History') {
      setHistoryLoading(true);
      
      // 1. Pull down the master parlor logs from the phone's storage
      const savedMilkLogs = localStorage.getItem('dairy_milk_logs');
      
      if (savedMilkLogs) {
        const allLogsArray = JSON.parse(savedMilkLogs);
        
        // 2. Filter out and grab ONLY the records that belong to this specific cow
        const matchingCowsLogs = allLogsArray.filter(
          (log) => log.cowId === cowId
        );
        
        setMilkHistory(matchingCowsLogs);
      } else {
        setMilkHistory([]); // Sets a clean empty array if no logs exist yet
      }
      
      // Turn off loading when search completes successfully
      setHistoryLoading(false);
    }
  }, [activeTab, cow, cowId]);

  // 🎯 REAL TIME FEED LOOKUP ENGINE: Gathers records by Group or Individual ID
  useEffect(() => {
    if (!cow) return;

    if (activeTab === 'Feed History') {
      // 1. Pull down master feed expenditures from phone storage
      const savedFeedReceipts = localStorage.getItem('dairy_feed_receipts');
      
      if (savedFeedReceipts) {
        const allReceiptsArray = JSON.parse(savedFeedReceipts);

        // 2. 🧠 DYNAMIC FILTER LOOP: Grab receipt if it matches her profile parameters
        const matchingDietLogs = allReceiptsArray.filter((receipt) => {
          // Condition A: It was assigned to the whole herd
          const isWholeHerd = receipt.allocationType === 'Group' && receipt.targetGroup === 'All Herd';
          
          // Condition B: It was assigned to her specific production status group
          const isHerGroup = receipt.allocationType === 'Group' && receipt.targetGroup === cow.status;
          
          // Condition C: She was checked manually inside the multi-cow checkbox list
          const isHerIdChecked = receipt.allocationType === 'Multi-Cow' && receipt.targetCowIds.includes(cow.id);

          return isWholeHerd || isHerGroup || isHerIdChecked;
        });

        setFeedHistory(matchingDietLogs);
      } else {
        setFeedHistory([]);
      }
      setFeedCurrentPage(1); // Reset pagination back to page one on load
    }
  }, [activeTab, cow, cowId]);

  // Handle saving the human-proofed corrected edits
  const handleSaveChanges = (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      alert('Cow name cannot be left blank.');
      return;
    }

    const savedHerd = localStorage.getItem('dairy_herd');
    if (savedHerd) {
      const herdArray = JSON.parse(savedHerd);
      const updatedHerd = herdArray.map((animal) => {
        if (animal.id === cowId) {
          return {
            ...animal,
            name: editName.trim(),
            status: animal.gender === 'Male' ? 'Calf' : editStatus, // Keep males as Calf
            sireTag: editSireTag.trim() === '' ? 'Unknown' : editSireTag,
            damTag: editDamTag.trim() === '' ? 'Unknown' : editDamTag,
            notes: editNotes
          };
        }
        return animal;
      });

      localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
      // Update local state instantly so the screen refreshes
      setCow({
        ...cow,
        name: editName.trim(),
        status: cow.gender === 'Male' ? 'Calf' : editStatus,
        sireTag: editSireTag.trim() === '' ? 'Unknown' : editSireTag,
        damTag: editDamTag.trim() === '' ? 'Unknown' : editDamTag,
        notes: editNotes
      });
      setIsEditing(false);
    }
  };

  // 💰 ARCHIVE ENGINE: Handles selling or logging deaths and updates financials offline
  const handleArchiveAnimal = (actionType) => {
    let salePrice = 0;
    
    if (actionType === 'Sold') {
      const inputPrice = window.prompt(`Enter the total sale price for ${cow.name} ($):`, "1500");
      if (inputPrice === null) return; // Cancelled
      salePrice = parseFloat(inputPrice) || 0;
      if (salePrice < 0) return alert('❌ Financial Error: Sale price cannot be negative.');
    } else {
      const confirmDeath = window.confirm(`⚠️ Confirm Death: Are you sure you want to log ${cow.name} as deceased? Income will be recorded as $0.00.`);
      if (!confirmDeath) return;
    }

    // A. Update Cow Status inside master herd list array
    const savedHerd = localStorage.getItem('dairy_herd');
    if (savedHerd) {
      const updatedHerd = JSON.parse(savedHerd).map((animal) => {
        if (animal.id === cowId) {
          return { 
            ...animal, 
            status: `Archived (${actionType})`,
            notes: `${animal.notes || ''} [Animal ${actionType} on ${new Date().toLocaleDateString()} for $${salePrice.toFixed(2)}]`
          };
        }
        return animal;
      });
      localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
    }

    // B. Inject transaction data directly into the Financial Ledger storage array!
    const savedFinances = localStorage.getItem('dairy_financial_records') || '[]';
    const masterFinancesArray = JSON.parse(savedFinances);
    
    const newFinancialRecord = {
      id: Date.now(),
      type: 'Income',
      category: `Livestock Sale (${actionType})`,
      amount: salePrice,
      date: new Date().toISOString().split('T')[0],
      notes: `Automated ledger entry: ${cow.name} (Tag: ${cow.tagNumber}) marked as ${actionType}.`
    };
    
    localStorage.setItem('dairy_financial_records', JSON.stringify([newFinancialRecord, ...masterFinancesArray]));

    // C. Remove animal from active breeding pregnancy arrays if she was pregnant
    const savedPregnancies = localStorage.getItem('dairy_pregnancies') || '[]';
    const filteredPregnancies = JSON.parse(savedPregnancies).filter(p => p.cowId !== cowId);
    localStorage.setItem('dairy_pregnancies', JSON.stringify(filteredPregnancies));

    alert(`📋 ${cow.name} has been archived successfully. Ledger updated with $${salePrice.toFixed(2)} income.`);
    onBackToList(); // Boot user back to herd list immediately
  };


  if (loading) return <div className="ledger-loading">Querying database rows...</div>;
  if (!cow) return <div className="profile-error-screen">❌ Profile not found.</div>;

  // Pagination Math for Milk
  const totalMilkPages = Math.ceil(milkHistory.length / itemsPerPage) || 1;
  const currentMilkRecordsSlice = milkHistory.slice((milkCurrentPage - 1) * itemsPerPage, milkCurrentPage * itemsPerPage);

  // Pagination Math for Feed
  const totalFeedPages = Math.ceil(feedHistory.length / itemsPerPage) || 1;
  const currentFeedSlice = feedHistory.slice((feedCurrentPage - 1) * itemsPerPage, feedCurrentPage * itemsPerPage);

  return (
    <div className="profile-mobile-container">
      <button className="back-link-btn" onClick={onBackToList}>◀ Back to Herd's List</button>

          {/* Dynamic Profile Summary Banner */}
      <div className={`profile-header-card ${cow.status.startsWith('Archived') ? 'ghost-profile-mode' : ''}`}>
        <div className="avatar-frame">
          {cow.image ? <img src={cow.image} alt={cow.name} className="profile-real-img" /> : <span className="profile-emoji-img">🐄</span>}
        </div>
        <div className="header-info">
          <h2>
            {cow.name} 
            <span className={`status-badge tag-${cow.status.toLowerCase().replace(/[^a-z]/g, '')}`}>{cow.status}</span>
          </h2>
          <p className="tag-sub">Tag Number: <strong>{cow.tagNumber}</strong></p>
          <p className="meta-sub">{cow.breed} • {cow.gender}</p>
          {cow.status.startsWith('Archived') && <p className="deactivated-warning-text">🔒 Locked Profile (De-registered Asset)</p>}
        </div>
        
        {/* 🔒 CONSTRAINT: Hide the Edit Button entirely if the animal is archived */}
        {!cow.status.startsWith('Archived') && (
          <button className="edit-trigger-btn" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {/* HUMAN PROOFING EDIT DROPDOWN (Now hides De-registration buttons here) */}
      {isEditing && (
        <div className="edit-dropdown-form">
          <h3>Correct Cow's Details</h3>
          <CowForm 
            initialData={cow}
            onCancel={() => setIsEditing(false)}
            onSave={(updatedData) => {
              const savedHerd = localStorage.getItem('dairy_herd');
              if (savedHerd) {
                const updatedHerd = JSON.parse(savedHerd).map((animal) => {
                  if (animal.id === cowId) return { ...animal, ...updatedData };
                  return animal;
                });
                localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
                setCow({ ...cow, ...updatedData });
                setIsEditing(false);
                alert('Changes saved successfully!');
              }
            }}
          />
          
          {/* 🔒 HIDDEN ARCHIVE DECK: Tucked safely inside Edit Panel away from accidental taps */}
          <div className="danger-zone-divider">
            <h4>Permanent Farm Exit Options</h4>
            <p>Archiving an animal locks her profile permanently. Milk and feed parameters will freeze immediately.</p>
            <div className="archive-actions-deck" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" className="archive-pill-btn sell" onClick={() => handleArchiveAnimal('Sold')}>Sell Cow</button>
              <button type="button" className="archive-pill-btn die" onClick={() => handleArchiveAnimal('Died')}>Log Death</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB NAVIGATION: Clean & strictly formatted. Rule 1: Male has NO tabs other than Overview & Feed */}
      <div className="tabs-navigation">
        <button className={activeTab === 'Overview' ? 'tab-link active' : 'tab-link'} onClick={() => setActiveTab('Overview')}>Overview</button>
        <button className={activeTab === 'Feed History' ? 'tab-link active' : 'tab-link'} onClick={() => setActiveTab('Feed History')}>Feed History</button>
        {cow.gender === 'Female' && (
          <>
            <button className={activeTab === 'Milk History' ? 'tab-link active' : 'tab-link'} onClick={() => setActiveTab('Milk History')}>Milk History</button>
            <button className={activeTab === 'Health Records' ? 'tab-link active' : 'tab-link'} onClick={() => setActiveTab('Health Records')}>Health Records</button>
          </>
        )}
      </div>

      {/* CORE WORKSPACE DETAILS */}
      <div className="tab-content-area">

        {/* ACTIVE TAB WORKSPACE: Overview */}
        {activeTab === 'Overview' && (
          <div className="overview-panel">
            <div className="bio-row"><span>Date of Birth:</span> <strong>{new Date(cow.dob).toLocaleDateString()}</strong></div>
            <div className="bio-row"><span>Sire (Father):</span> <strong className={cow.sireTag === 'Unknown' ? 'dim-text' : ''}>{cow.sireTag}</strong></div>
            <div className="bio-row"><span>Dam (Mother):</span> <strong className={cow.damTag === 'Unknown' ? 'dim-text' : ''}>{cow.damTag}</strong></div>
            {cow.status === 'Pregnant' && cow.calvingDate && (
              <div className="bio-row special-alert-row"><span>Expected Calving:</span> <strong>{new Date(cow.calvingDate).toLocaleDateString()}</strong></div>
            )}
            <div className="notes-display-box">
              <label>Special Marks & Notes:</label>
              <p>{cow.notes || "No extra descriptive logs recorded for this animal."}</p>
            </div>
          </div>
        )}

        {/* ACTIVE TAB WORKSPACE: Milk History Data Table (Your exact layout!) */}
        {activeTab === 'Milk History' && (
          <div className="milk-history-tab-pane">
            {historyLoading ? (
              <div className="ledger-loading">Querying database rows...</div>
            ) : milkHistory.length === 0 ? (
              <div className="empty-ledger-box">
                <p>No milk production logged for <strong>{cow.name}</strong> yet.</p>
              </div>
            ) : (
              <>
                <div className="profile-table-container">
                  <table className="profile-data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Morning</th>
                        <th>Evening</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>                                  
                      {currentMilkRecordsSlice.map((record) => (
                        <tr key={record.id}>
                          {/* A. Display the calendar date of collection */}
                          <td className="date-cell">
                            {new Date(record.record_date).toLocaleDateString()}
                          </td>
                          
                          {/* B. Display Morning Volume */}
                          <td>{record.morning_milk} L</td>
                          
                          {/* C. Display Evening Volume */}
                          <td>{record.evening_milk} L</td>
                          
                          {/* D. Display Calculated Total Volume & Antibiotic Check */}
                          <td className="bold-total-cell">
                            {record.total_daily_milk} Liters
                            {record.is_contaminated > 0 && (
                              <span className="profile-table-residue-warn-badge" title="Residue risk detected! This milk was dumped.">
                                DUMP MILK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}

                    </tbody>
                  </table>
                </div>

                <div className="pagination-controls-navigation-bar">
                  <button 
                    onClick={() => setMilkCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={milkCurrentPage === 1}
                    className="pagination-btn"
                  >
                    ⬅ Previous
                  </button>
                  <span className="pagination-page-indicator-text">
                    Page <strong>{milkCurrentPage}</strong> of {totalMilkPages || 1} 
                    <small className="total-records-count">({milkHistory.length} Total Logs)</small>
                  </span>
                  <button 
                    onClick={() => setMilkCurrentPage(prev => Math.min(prev + 1, totalMilkPages))}
                    disabled={milkCurrentPage === totalMilkPages || totalMilkPages === 0}
                    className="pagination-btn"
                  >
                    Next ➡
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ACTIVE TAB WORKSPACE: Feed History Local Ledger List */}
        {activeTab === 'Feed History' && (
          <div className="milk-history-tab-pane">
            
            {/* LEDGER HEADER WITH COMPACT MOBILE FILTER PILLS */}
            <div className="ledger-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="filter-button-deck-wrapper" style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className={feedDateFilter === 'All' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setFeedDateFilter('All'); setFeedCurrentPage(1); }}>All</button>
                <button type="button" className={feedDateFilter === 'Week' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setFeedDateFilter('Week'); setFeedCurrentPage(1); }}>Week</button>
                <button type="button" className={feedDateFilter === 'Month' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setFeedDateFilter('Month'); setFeedCurrentPage(1); }}>Month</button>
              </div>
            </div>

            {/* RUN PROCESSING WINDOW TIME FILTER MATCHES */}
            {(() => {
              const processedFeedSlice = feedHistory.filter(receipt => {
                if (feedDateFilter === 'All') return true;
                const rDate = new Date(receipt.purchaseDate);
                const today = new Date();
                if (feedDateFilter === 'Week') {
                  const limit = new Date(); limit.setDate(today.getDate() - 7);
                  return rDate >= limit;
                }
                if (feedDateFilter === 'Month') {
                  const limit = new Date(); limit.setDate(today.getDate() - 30);
                  return rDate >= limit;
                }
                return true;
              });

              const totalFPages = Math.ceil(processedFeedSlice.length / itemsPerPage) || 1;
              const currentFeedViewSlice = processedFeedSlice.slice((feedCurrentPage - 1) * itemsPerPage, feedCurrentPage * itemsPerPage);

              if (processedFeedSlice.length === 0) {
                return (
                  <div className="empty-ledger-box">
                    <p>No dietary allocations registered for <strong>{cow.name}</strong> inside this time window.</p>
                  </div>
                );
              }

              return (
                <>
                  <div className="profile-table-container">
                    <table className="profile-data-table">
                      <thead>
                        <tr>
                          <th>Allocation Date</th>
                          <th>Feed Type</th>
                          <th> Ration</th>
                          <th>Purchased Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentFeedViewSlice.map((record) => (
                          <tr key={record.id}>
                            <td className="date-cell">{new Date(record.purchaseDate).toLocaleDateString()}</td>
                            <td style={{ fontWeight: 'bold', color: '#34495e' }}>{record.feedType}</td>
                            <td>
                              {record.allocationType === 'Group' ? (
                                <span className="allocation-indicator group" style={{ fontSize: '10px' }}>Group: {record.targetGroup}</span>
                              ) : (
                                <span className="allocation-indicator individual" style={{ fontSize: '10px' }}>Individual Multi-Cow</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 'bold' }}>{record.qty} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* THUMB PAGINATION CONTROLS ROW */}
                  {totalFPages > 1 && (
                    <div className="pagination-controls-navigation-bar">
                      <button 
                        type="button"
                        onClick={() => setFeedCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={feedCurrentPage === 1}
                        className="pagination-btn"
                      >
                        ⬅ Previous
                      </button>
                      
                      <span className="pagination-page-indicator-text">
                        Page <strong>{feedCurrentPage}</strong> of {totalFPages}
                        <small className="total-records-count">({processedFeedSlice.length} Rations Matched)</small>
                      </span>

                      <button 
                        type="button"
                        onClick={() => setFeedCurrentPage(prev => Math.min(prev + 1, totalFPages))}
                        disabled={feedCurrentPage === totalFPages}
                        className="pagination-btn"
                      >
                        Next ➡
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ACTIVE TAB WORKSPACE: Health Records Ledger */}
        {activeTab === 'Health Records' && (
          <div className="health-history-tab-pane">
            {healthHistory.length === 0 ? (
              <div className="empty-ledger-box">
                <p>No health or vaccination cards logged for <strong>{cow.name}</strong> yet.</p>
              </div>
            ) : (
              <div className="history-panel">
                {/* Future health rows will go here! */}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default CowProfile;
