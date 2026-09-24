import React, { useState, useEffect } from 'react';
import CowForm from '../../components/CowForm';
import './CowProfile.css';

const getAgeInMonths = (dob) => {
  if (!dob) return 0;

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 0;

  const today = new Date();
  return (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
};

const normalizeLifecycleStatus = (animal) => {
  if (!animal || !animal.dob) return animal;

  const ageInMonths = getAgeInMonths(animal.dob);
  const currentStatus = animal.status || 'Calf';

  if (currentStatus.startsWith('Archived')) return animal;

  if (animal.gender === 'Male') {
    return { ...animal, status: ageInMonths < 6 ? 'Calf' : 'Bull' };
  }

  if (ageInMonths < 6) return { ...animal, status: 'Calf' };

  if (['Dry', 'AI_PENDING', 'Eligible'].includes(currentStatus)) return { ...animal, status: 'Milking' };
  if (['Pregnant', 'Milking'].includes(currentStatus)) return animal;

  if (ageInMonths >= 6) {
    return { ...animal, status: 'Heifer' };
  }

  return animal;
};

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
  const [editCastrationDate, setEditCastrationDate] = useState('');
  const [editHeartGirth, setEditHeartGirth] = useState('');
  const [editBodyWidth, setEditBodyWidth] = useState('');

  // History & Feed States
  const [milkHistory, setMilkHistory] = useState([]);
  const [milkCurrentPage, setMilkCurrentPage] = useState(1);
  const [feedHistory, setFeedHistory] = useState([]);
  const [feedCurrentPage, setFeedCurrentPage] = useState(1);

  // SEPARATED LEDGERS FOR SPLIT TABS
  const [healthLogs, setHealthLogs] = useState([]);
  const [reproductionLogs, setReproductionLogs] = useState([]);

  const [feedDateFilter, setFeedDateFilter] = useState('All'); // All, Week, Month
  const itemsPerPage = 5;

  // Load Cow Data from local storage
  useEffect(() => {
    const savedHerd = localStorage.getItem('dairy_herd');
    if (savedHerd) {
      const herdArray = JSON.parse(savedHerd);
      const normalizedHerd = herdArray.map(normalizeLifecycleStatus);
      const foundCow = normalizedHerd.find((animal) => animal.id === cowId);
      if (foundCow) {
        localStorage.setItem('dairy_herd', JSON.stringify(normalizedHerd));
        setCow(foundCow);
        // Pre-fill edit fields just in case they click edit
        setEditName(foundCow.name);
        setEditStatus(foundCow.status);
        setEditSireTag(foundCow.sireTag === 'Unknown' ? '' : foundCow.sireTag);
        setEditDamTag(foundCow.damTag === 'Unknown' ? '' : foundCow.damTag);
        setEditNotes(foundCow.notes);
        setEditCastrationDate(foundCow.castrationDate || '');
        setEditHeartGirth(foundCow.heartGirth || '');
        setEditBodyWidth(foundCow.bodyWidth || '');
      }
    }
    setLoading(false);
  }, [cowId]);

  // MILK LOOKUP ENGINE
  useEffect(() => {
    if (!cow) {
      setHistoryLoading(false);
      return;
    }

    if (activeTab === 'Milk History') {
      setHistoryLoading(true);
      const savedMilkLogs = localStorage.getItem('dairy_milk_logs');
      if (savedMilkLogs) {
        const allLogsArray = JSON.parse(savedMilkLogs);
        const matchingCowsLogs = allLogsArray.filter((log) => log.cowId === cowId);
        setMilkHistory(matchingCowsLogs);
      } else {
        setMilkHistory([]);
      }
      setHistoryLoading(false);
    }
  }, [activeTab, cow, cowId]);

  // SEPARATED DATA RESOLUTION: Segregates true medical incidents from dynamic breeding timelines
  useEffect(() => {
    if (!cow) return;

    if (activeTab === 'Health Records' || activeTab === 'Reproduction') {
      const breedingEvents = JSON.parse(localStorage.getItem('dairy_breeding_events') || '[]');
      const generalHealthEvents = JSON.parse(localStorage.getItem('dairy_health_logs') || '[]');

      // 1. Health Tab gets strictly diagnostic and medical log treatments
      const medicalFilter = generalHealthEvents
        .filter((event) => event.cowId === cowId)
        .sort((a, b) => new Date(b.treatmentDate) - new Date(a.treatmentDate));

      // 2. Reproduction Tab gets heats, services, checks, and drops
      const breedingFilter = breedingEvents
        .filter((event) => event.cowId === cowId)
        .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));

      setHealthLogs(medicalFilter);
      setReproductionLogs(breedingFilter);
    }
  }, [activeTab, cow, cowId]);

  // FEED LOOKUP ENGINE
  useEffect(() => {
    if (!cow) return;

    if (activeTab === 'Feed History') {
      const savedFeedReceipts = localStorage.getItem('dairy_feed_receipts');
      if (savedFeedReceipts) {
        const allReceiptsArray = JSON.parse(savedFeedReceipts);
        const matchingDietLogs = allReceiptsArray.filter((receipt) => {
          const isWholeHerd = receipt.allocationType === 'Group' && receipt.targetGroup === 'All Herd';
          const isHerGroup = receipt.allocationType === 'Group' && receipt.targetGroup === cow.status;
          const isHerIdChecked = receipt.allocationType === 'Multi-Cow' && receipt.targetCowIds.includes(cow.id);
          return isWholeHerd || isHerGroup || isHerIdChecked;
        });
        setFeedHistory(matchingDietLogs);
      } else {
        setFeedHistory([]);
      }
      setFeedCurrentPage(1);
    }
  }, [activeTab, cow, cowId]);

  // Handle saving edits
  const handleSaveChanges = (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      alert('Cow name cannot be left blank.');
      return;
    }

    const savedHerd = localStorage.getItem('dairy_herd');
    if (savedHerd) {
      const herdArray = JSON.parse(savedHerd);
      const normalizedStatus = normalizeLifecycleStatus({
        ...cow,
        name: editName.trim(),
        status: editStatus,
        sireTag: editSireTag.trim() === '' ? 'Unknown' : editSireTag,
        damTag: editDamTag.trim() === '' ? 'Unknown' : editDamTag,
        notes: editNotes
      }).status;

      const updatedHerd = herdArray.map((animal) => {
        if (animal.id === cowId) {
          return {
            ...animal,
            name: editName.trim(),
            status: normalizedStatus,
            sireTag: editSireTag.trim() === '' ? 'Unknown' : editSireTag,
            damTag: editDamTag.trim() === '' ? 'Unknown' : editDamTag,
            notes: editNotes
          };
        }
        return animal;
      });

      localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
      setCow({
        ...cow,
        name: editName.trim(),
        status: normalizedStatus,
        sireTag: editSireTag.trim() === '' ? 'Unknown' : editSireTag,
        damTag: editDamTag.trim() === '' ? 'Unknown' : editDamTag,
        notes: editNotes
      });
      setIsEditing(false);
    }
  };

  const handleArchiveAnimal = (actionType) => {
    let salePrice = 0;

    if (actionType === 'Sold') {
      const inputPrice = window.prompt(`Enter the total sale price for ${cow.name} (KSH):`, '50000');
      if (inputPrice === null) return;
      salePrice = parseFloat(inputPrice) || 0;
      if (salePrice < 0) return alert('Financial Error: Sale price cannot be negative.');
    } else {
      const confirmDeath = window.confirm(
        `Confirm Death: Are you sure you want to log ${cow.name} as deceased? Income will be recorded as KSH 0.00.`
      );
      if (!confirmDeath) return;
    }

    const savedHerd = localStorage.getItem('dairy_herd');
    if (savedHerd) {
      const updatedHerd = JSON.parse(savedHerd).map((animal) => {
        if (animal.id === cowId) {
          return {
            ...animal,
            status: `Archived (${actionType})`,
            notes: `${animal.notes || ''} [Animal ${actionType} on ${new Date().toLocaleDateString()} for KSH ${salePrice.toFixed(2)}]`
          };
        }
        return animal;
      });
      localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
    }

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

    const savedPregnancies = localStorage.getItem('dairy_pregnancies') || '[]';
    const filteredPregnancies = JSON.parse(savedPregnancies).filter((p) => p.cowId !== cowId);
    localStorage.setItem('dairy_pregnancies', JSON.stringify(filteredPregnancies));

    alert(`${cow.name} has been archived successfully. Ledger updated with KSH ${salePrice.toFixed(2)} income.`);
    onBackToList();
  };

  if (loading) return <div className="ledger-loading">Querying database rows...</div>;
  if (!cow) return <div className="profile-error-screen">Profile not found.</div>;

  const totalMilkPages = Math.ceil(milkHistory.length / itemsPerPage) || 1;
  const currentMilkRecordsSlice = milkHistory.slice((milkCurrentPage - 1) * itemsPerPage, milkCurrentPage * itemsPerPage);

  const totalFeedPages = Math.ceil(feedHistory.length / itemsPerPage) || 1;

  return (
    <div className="cow-profile-container">
      <button type="button" className="back-link-btn" onClick={onBackToList}>
        ◀ Back to Herd's List
      </button>

      {/* HEADER CARD */}
      <div className={`profile-header-card ${cow.status.startsWith('Archived') ? 'ghost-profile-mode' : ''}`}>
        <div className="profile-avatar">{cow.image ? <img src={cow.image} alt={cow.name} /> : <span className="e">🐄</span>}</div>
        <div className="profile-main-info">
          <h2>{cow.name}</h2>
          <span className={`status-badge tag-${cow.status.toLowerCase().replace(/[^a-z]/g, '')}`}>{cow.status}</span>
          <p className="tag-number">Tag Number: {cow.tagNumber}</p>
          <p className="sub-details">
            {cow.breed} • {cow.gender}
          </p>
        </div>

        {cow.status.startsWith('Archived') && (
          <div className="archived-banner">Locked Profile (Archived Asset)</div>
        )}

        {!cow.status.startsWith('Archived') && (
          <button type="button" className="edit-trigger-btn" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {/* EDIT & ARCHIVE DRAWER */}
      {isEditing && (
        <div className="edit-drawer-panel">
          <h3>Correct Cow's Details</h3>
          <CowForm
            initialData={cow}
            onCancel={() => setIsEditing(false)}
            onSave={(updatedData) => {
              const savedHerd = localStorage.getItem('dairy_herd');
              if (savedHerd) {
                const normalizedData = normalizeLifecycleStatus({ ...cow, ...updatedData });
                const updatedHerd = JSON.parse(savedHerd).map((animal) => {
                  if (animal.id === cowId) return { ...animal, ...normalizedData };
                  return animal;
                });
                localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
                setCow(normalizedData);
                setIsEditing(false);
                alert('Changes saved successfully!');
              }
            }}
          />
          <div className="archive-section">
            <h4>Permanent Farm Exit Options</h4>
            <p>Archiving an animal locks her profile permanently. Milk and feed parameters will freeze immediately.</p>
            <div className="archive-actions-deck" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" className="archive-pill-btn sell" onClick={() => handleArchiveAnimal('Sold')}>
                Sell Cow
              </button>
              <button type="button" className="archive-pill-btn die" onClick={() => handleArchiveAnimal('Died')}>
                Log Death
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS WITH SEGREGATED FILTERS */}
      <div className="profile-tabs-nav">
        <button
          type="button"
          className={activeTab === 'Overview' ? 'tab-link active' : 'tab-link'}
          onClick={() => setActiveTab('Overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={activeTab === 'Feed History' ? 'tab-link active' : 'tab-link'}
          onClick={() => setActiveTab('Feed History')}
        >
          Feed
        </button>
        <button
          type="button"
          className={activeTab === 'Health Records' ? 'tab-link active' : 'tab-link'}
          onClick={() => setActiveTab('Health Records')}
        >
          Health
        </button>

        {cow.gender === 'Female' && (
          <>
            <button
              type="button"
              className={activeTab === 'Milk History' ? 'tab-link active' : 'tab-link'}
              onClick={() => setActiveTab('Milk History')}
            >
              Milk
            </button>
            <button
              type="button"
              className={activeTab === 'Reproduction' ? 'tab-link active' : 'tab-link'}
              onClick={() => setActiveTab('Reproduction')}
            >
              Reproduction
            </button>
          </>
        )}
      </div>

      {/* CORE WORKSPACE DETAILS */}
      <div className="tab-content-container">
        {/* WORKSPACE: Overview */}
        {activeTab === 'Overview' && (
          <div className="overview-tab-pane">
            <p>
              <strong>Date of Birth:</strong> {new Date(cow.dob).toLocaleDateString()}
            </p>
            {cow.gender === 'Male' && cow.castrationDate && (
              <p>
                <strong>Castration Date:</strong> {new Date(cow.castrationDate).toLocaleDateString()}
              </p>
            )}
            {cow.heartGirth && (
              <p>
                <strong>Heart Girth:</strong> {cow.heartGirth} cm
              </p>
            )}
            {cow.bodyWidth && (
              <p>
                <strong>Body Width:</strong> {cow.bodyWidth} cm
              </p>
            )}
            <p>
              <strong>Sire (Father):</strong>{' '}
              <strong className={cow.sireTag === 'Unknown' ? 'dim-text' : ''}>{cow.sireTag}</strong>
            </p>
            <p>
              <strong>Dam (Mother):</strong>{' '}
              <strong className={cow.damTag === 'Unknown' ? 'dim-text' : ''}>{cow.damTag}</strong>
            </p>
            {cow.status === 'Pregnant' && cow.calvingDate && (
              <p>
                <strong>Expected Calving:</strong> {new Date(cow.calvingDate).toLocaleDateString()}
              </p>
            )}
            <div className="notes-block">
              <strong>Special Marks & Notes:</strong>
              <p>{cow.notes || 'No extra descriptive logs recorded for this animal.'}</p>
            </div>
          </div>
        )}

        {/* WORKSPACE: Milk History Data Table */}
        {activeTab === 'Milk History' && cow.gender === 'Female' && (
          <div className="milk-tab-pane">
            {historyLoading ? (
              <div className="ledger-loading">Querying database rows...</div>
            ) : milkHistory.length === 0 ? (
              <p className="empty-history-msg">No milk production logged for {cow.name} yet.</p>
            ) : (
              <>
                <table className="data-table">
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
                      <tr key={record.id || record.record_date}>
                        <td>{new Date(record.record_date).toLocaleDateString()}</td>
                        <td>{record.morning_milk} L</td>
                        <td>{record.evening_milk} L</td>
                        <td>
                          {record.total_daily_milk} Liters
                          {record.is_contaminated > 0 && <span className="warning-flag"> ⚠️ Contaminated</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pagination-wrapper">
                  <button
                    type="button"
                    onClick={() => setMilkCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={milkCurrentPage === 1}
                    className="pagination-btn"
                  >
                    ⬅ Previous
                  </button>
                  <span>
                    Page {milkCurrentPage} of {totalMilkPages || 1} ({milkHistory.length} Total Logs)
                  </span>
                  <button
                    type="button"
                    onClick={() => setMilkCurrentPage((prev) => Math.min(prev + 1, totalMilkPages))}
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

        {/* WORKSPACE: Feed History */}
        {activeTab === 'Feed History' && (
          <div className="feed-tab-pane">
            <div
              className="ledger-header-row"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}
            >
              <div className="filter-button-deck-wrapper" style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className={feedDateFilter === 'All' ? 'filter-pill active' : 'filter-pill'}
                  onClick={() => {
                    setFeedDateFilter('All');
                    setFeedCurrentPage(1);
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  className={feedDateFilter === 'Week' ? 'filter-pill active' : 'filter-pill'}
                  onClick={() => {
                    setFeedDateFilter('Week');
                    setFeedCurrentPage(1);
                  }}
                >
                  Week
                </button>
                <button
                  type="button"
                  className={feedDateFilter === 'Month' ? 'filter-pill active' : 'filter-pill'}
                  onClick={() => {
                    setFeedDateFilter('Month');
                    setFeedCurrentPage(1);
                  }}
                >
                  Month
                </button>
              </div>
            </div>

            {(() => {
              const processedFeedSlice = feedHistory.filter((receipt) => {
                if (feedDateFilter === 'All') return true;
                const rDate = new Date(receipt.purchaseDate);
                const today = new Date();
                if (feedDateFilter === 'Week') {
                  const limit = new Date();
                  limit.setDate(today.getDate() - 7);
                  return rDate >= limit;
                }
                if (feedDateFilter === 'Month') {
                  const limit = new Date();
                  limit.setDate(today.getDate() - 30);
                  return rDate >= limit;
                }
                return true;
              });

              const totalFPages = Math.ceil(processedFeedSlice.length / itemsPerPage) || 1;
              const currentFeedViewSlice = processedFeedSlice.slice(
                (feedCurrentPage - 1) * itemsPerPage,
                feedCurrentPage * itemsPerPage
              );

              if (processedFeedSlice.length === 0) {
                return (
                  <p className="empty-history-msg">
                    No dietary allocations registered for {cow.name} inside this time window.
                  </p>
                );
              }

              return (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Allocation Date</th>
                        <th>Feed Type</th>
                        <th>Ration Type</th>
                        <th>Purchased Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentFeedViewSlice.map((record) => (
                        <tr key={record.id}>
                          <td>{new Date(record.purchaseDate).toLocaleDateString()}</td>
                          <td>{record.feedType}</td>
                          <td>{record.allocationType === 'Group' ? 'Group Allocation' : 'Individual Check'}</td>
                          <td>{record.qty} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {totalFPages > 1 && (
                    <div className="pagination-wrapper">
                      <button
                        type="button"
                        onClick={() => setFeedCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={feedCurrentPage === 1}
                        className="pagination-btn"
                      >
                        ⬅ Previous
                      </button>
                      <span>
                        Page {feedCurrentPage} of {totalFPages} ({processedFeedSlice.length} Rations Matched)
                      </span>
                      <button
                        type="button"
                        onClick={() => setFeedCurrentPage((prev) => Math.min(prev + 1, totalFPages))}
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

        {/* WORKSPACE: Health Records (Universal Medical History for All Livestock) */}
        {activeTab === 'Health Records' && (
          <div className="health-tab-pane">
            <div className="profile-reproductive-status" style={{ marginBottom: '16px' }}>
              <strong>Current Asset Status: </strong>
              <span className="status-value">{cow.status}</span>
            </div>

            {healthLogs.length === 0 ? (
              <p className="empty-history-msg">
                No veterinary diagnostics or treatment records logged for {cow.name} yet.
              </p>
            ) : (
              <div className="reproductive-timeline">
                {healthLogs.map((event) => (
                  <div className="reproductive-timeline-row" key={`health-${event.id}`}>
                    <div className="timeline-header">
                      <strong>{event.diagnosis || 'Medical Assessment'}</strong>
                      <span className="event-date">{new Date(event.treatmentDate).toLocaleDateString()}</span>
                    </div>
                    <div className="timeline-body">
                      {event.medication ? `Treatment: ${event.medication}` : ''}
                      {event.notes ? ` • Notes: ${event.notes}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE: Reproduction (Exclusively Female Analytics Logs) */}
        {activeTab === 'Reproduction' && cow.gender === 'Female' && (
          <div className="reproduction-tab-pane">
            {(() => {
              const aiServices = reproductionLogs.filter((event) => event.eventType === 'Insemination');
              const pregnancyChecks = reproductionLogs.filter(
                (event) => event.eventType === 'Pregnancy Check' && event.result === 'Pregnant'
              );
              const calves = JSON.parse(localStorage.getItem('dairy_herd') || '[]').filter(
                (animal) => animal.damTag === cow.tagNumber
              );
              const totalAiCost = aiServices.reduce((total, event) => total + (Number(event.cost) || 0), 0);

              return (
                <>
                  <div className="repro-summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                    <div className="summary-card">
                      <p>Heat records</p>
                      <h3>{reproductionLogs.filter((event) => event.eventType === 'Heat').length}</h3>
                    </div>
                    <div className="summary-card">
                      <p>Total AI services</p>
                      <h3>{aiServices.length}</h3>
                    </div>
                    <div className="summary-card">
                      <p>Successful pregnancies</p>
                      <h3>{pregnancyChecks.length}</h3>
                    </div>
                    <div className="summary-card">
                      <p>AI expenditure</p>
                      <h3>KSH {totalAiCost.toLocaleString()}</h3>
                    </div>
                  </div>

                  <div className="profile-reproductive-status" style={{ marginBottom: '16px' }}>
                    <strong>Reproductive Status: </strong>
                    <span className="status-value">{cow.status}</span>
                  </div>

                  {reproductionLogs.length === 0 ? (
                    <p className="empty-history-msg">
                      No reproduction or breeding logged for {cow.name} yet.
                    </p>
                  ) : (
                    <div className="reproductive-timeline">
                      {reproductionLogs.map((event) => (
                        <div className="reproductive-timeline-row" key={`breeding-${event.id}`}>
                          <div className="timeline-header">
                            <strong>{event.eventType}</strong>
                            <span className="event-date">{new Date(event.eventDate).toLocaleDateString()}</span>
                          </div>
                          <div className="timeline-body">
                            {event.eventType === 'Insemination' ? (
                              `Service ${event.serviceNumber || '#'} · Semen Tag: ${event.semenTag || 'Not Recorded'} · KSH ${(
                                Number(event.cost) || 0
                              ).toLocaleString()}`
                            ) : event.eventType === 'Heat' ? (
                              event.heatSigns || 'Heat observed'
                            ) : event.eventType === 'Calving' ? (
                              `Calf Tag Reference: ${event.calfTag || 'Not Linked'}`
                            ) : (
                              event.result || event.notes || 'Event recorded'
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="calves-section" style={{ marginTop: '20px' }}>
                    <h4>Calves produced</h4>
                    {calves.length === 0 ? (
                      <p className="empty-history-msg">No calves linked to this cow yet.</p>
                    ) : (
                      <div className="calves-list">
                        {calves.map((calf) => (
                          <div className="calf-card" key={calf.id}>
                            <strong>Tag: {calf.tagNumber}</strong>
                            <p>
                              {calf.name} · {calf.gender} · {new Date(calf.dob).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default CowProfile;
