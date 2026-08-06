import React, { useState, useEffect } from 'react';
import './BreedingLog.css';

function BreedingLog() {
  const [herd, setHerd] = useState([]);
  const [eligibleCows, setEligibleCows] = useState([]);
  const [breedingEvents, setBreedingEvents] = useState([]);
  const [activePregnancies, setActivePregnancies] = useState([]);

  const [formType, setFormType] = useState('Insemination'); 
  const [selectedCowId, setSelectedCowId] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [semenTag, setSemenTag] = useState('');
  const [bullNotes, setBullNotes] = useState('');
  const [vetName, setVetName] = useState('');
  const [serviceCost, setServiceCost] = useState('');
  
  const [isBoughtPregnant, setIsBoughtPregnant] = useState(false);
  const [manualDueDate, setManualDueDate] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    refreshBreedingTerminal();
  }, []);

  const refreshBreedingTerminal = () => {
    const savedHerd = localStorage.getItem('dairy_herd') || '[]';
    const parsedHerd = JSON.parse(savedHerd);
    setHerd(parsedHerd);

    // 🔒 BREEDING CONSTRAINT REMEDIAL FILTER: 
    // Cannot inseminate Males, Calves, already Pregnant cows, Dry resting cows, OR ANY ARCHIVED ANIMALS!
    const eligibleList = parsedHerd.filter(animal => 
      animal.gender === 'Female' && 
      animal.status !== 'Calf' && 
      animal.status !== 'Pregnant' &&
      animal.status !== 'Dry' &&
      !animal.status.startsWith('Archived') // 🔏 THE LOCKDOWN FIX
    );
    setEligibleCows(eligibleList);

    if (eligibleList.length > 0) setSelectedCowId(eligibleList[0].id.toString());

    // Load Events (Heat cycle tracking rows)
    const savedEvents = localStorage.getItem('dairy_breeding_events') || '[]';
    setBreedingEvents(JSON.parse(savedEvents));

    // 🔒 SEED INITIATION REPAIR: Map existing pregnant cows from registry into active tracker automatically 
    const savedPregnancies = localStorage.getItem('dairy_pregnancies') || '[]';
    let currentPregnanciesArray = JSON.parse(savedPregnancies);

    parsedHerd.forEach(cow => {
      if ((cow.status === 'Pregnant' || cow.status === 'Dry') && cow.calvingDate) {
        const structuralExists = currentPregnanciesArray.some(p => p.cowId === cow.id);
        if (!structuralExists) {
          currentPregnanciesArray.push({
            id: Date.now() + cow.id,
            cowId: cow.id,
            cowName: cow.name,
            cowTag: cow.tagNumber,
            inseminationDate: cow.dob || 'Unknown / Bought Entry',
            semenTag: cow.sireTag || 'Unknown',
            expectedDueDate: cow.calvingDate,
            isDry: cow.status === 'Dry'
          });
        }
      }
    });
    setActivePregnancies(currentPregnanciesArray);
    localStorage.setItem('dairy_pregnancies', JSON.stringify(currentPregnanciesArray));
  };

  const handleLogBreedingEvent = (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // 🔒 TIMELINE DATE LOCK GAURD
    const pickedDate = new Date(serviceDate);
    const today = new Date();
    if (pickedDate > today) {
      return setErrorMessage('❌ Date Violation: Breeding operations cannot be logged into the future!');
    }

    if (!selectedCowId) return setErrorMessage('❌ Selection Error: No open eligible cow selected.');
    const targetCow = herd.find(c => c.id.toString() === selectedCowId);
    if (!targetCow) return;

    const baseEvent = {
      id: Date.now(),
      cowId: targetCow.id,
      cowName: targetCow.name,
      cowTag: targetCow.tagNumber,
      eventDate: serviceDate,
      eventType: formType
    };

    let masterEventsArray = JSON.parse(localStorage.getItem('dairy_breeding_events') || '[]');
    let masterPregnanciesArray = JSON.parse(localStorage.getItem('dairy_pregnancies') || '[]');
    let masterHerdArray = JSON.parse(localStorage.getItem('dairy_herd') || '[]');

    if (formType === 'Insemination') {
      const costValue = parseFloat(serviceCost) || 0;
      const aiRecord = { ...baseEvent, semenTag, bullNotes, vetName, cost: costValue };
      masterEventsArray = [aiRecord, ...masterEventsArray];

      let calculatedDueDate = '';
      if (isBoughtPregnant && manualDueDate) {
        calculatedDueDate = manualDueDate;
      } else {
        const dateObj = new Date(serviceDate);
        dateObj.setDate(dateObj.getDate() + 283); // Standard 283-day gestation calculation
        calculatedDueDate = dateObj.toISOString().split('T')[0];
      }

      const activePregnancyRecord = {
        id: Date.now(),
        cowId: targetCow.id,
        cowName: targetCow.name,
        cowTag: targetCow.tagNumber,
        inseminationDate: serviceDate,
        semenTag: semenTag || 'Bought Pregnant',
        expectedDueDate: calculatedDueDate,
        isDry: false
      };
      masterPregnanciesArray = [activePregnancyRecord, ...masterPregnanciesArray];

      masterHerdArray = masterHerdArray.map(animal => {
        if (animal.id === targetCow.id) {
          return { ...animal, status: 'Pregnant', calvingDate: calculatedDueDate, sireTag: semenTag || 'Unknown' };
        }
        return animal;
      });

    } else {
      // Just logging heat trace cycle item
      masterEventsArray = [baseEvent, ...masterEventsArray];
    }

    localStorage.setItem('dairy_breeding_events', JSON.stringify(masterEventsArray));
    localStorage.setItem('dairy_pregnancies', JSON.stringify(masterPregnanciesArray));
    localStorage.setItem('dairy_herd', JSON.stringify(masterHerdArray));

    setSemenTag('');
    setBullNotes('');
    setVetName('');
    setServiceCost('');
    setIsBoughtPregnant(false);
    setManualDueDate('');
    
    setSuccessMessage(`Breeding event successfully committed to record!`);
    refreshBreedingTerminal();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleMarkAsDry = (cowId) => {
    // 🔒 DRY CELL CONFLICT FILTER GUARD
    const pregnancy = activePregnancies.find(p => p.cowId === cowId);
    if (pregnancy) {
      const insDate = new Date(pregnancy.inseminationDate);
      const today = new Date();
      const differenceInDays = Math.ceil((today - insDate) / (1000 * 60 * 60 * 24));
      
      if (differenceInDays < 180 && pregnancy.inseminationDate !== 'Unknown / Bought Entry') {
        alert(`❌ Biological Violation: This cow was inseminated too recently (${differenceInDays} days ago). You cannot mark her as a Dry resting cow yet!`);
        return;
      }
    }

    let pregnancies = JSON.parse(localStorage.getItem('dairy_pregnancies') || '[]');
    pregnancies = pregnancies.map(p => p.cowId === cowId ? { ...p, isDry: true } : p);
    localStorage.setItem('dairy_pregnancies', JSON.stringify(pregnancies));

    let masterHerd = JSON.parse(localStorage.getItem('dairy_herd') || '[]');
    masterHerd = masterHerd.map(a => a.id === cowId ? { ...a, status: 'Dry' } : a);
    localStorage.setItem('dairy_herd', JSON.stringify(masterHerd));

    alert('🌾 Status advanced: Animal is now set as a Dry Cow.');
    refreshBreedingTerminal();
  };

  const handleLogMiscarriage = (cowId) => {
    if (window.confirm('💔 Delete pregnancy records and return cow to open pool?')) {
      let pregnancies = JSON.parse(localStorage.getItem('dairy_pregnancies') || '[]').filter(p => p.cowId !== cowId);
      localStorage.setItem('dairy_pregnancies', JSON.stringify(pregnancies));

      let masterHerd = JSON.parse(localStorage.getItem('dairy_herd') || '[]').map(a => 
        a.id === cowId ? { ...a, status: 'Milking', calvingDate: '' } : a
      );
      localStorage.setItem('dairy_herd', JSON.stringify(masterHerd));

      alert('Pregnancy reset complete.');
      refreshBreedingTerminal();
    }
  };

  const heatEvents = breedingEvents.filter(e => e.eventType === 'Heat');

  return (
    <div className="breeding-log-page-wrapper">
      
      {/* SECTION 1: LOGGER DRAWER */}
      <div className="breeding-card-box">
        <h2>Log AI Insemination or Heat Cycle</h2>
        <div className="form-toggle-bar">
          <button type="button" className={formType === 'Insemination' ? 'toggle-tab active' : 'toggle-tab'} onClick={() => setFormType('Insemination')}>Artificial Insemination</button>
          <button type="button" className={formType === 'Heat' ? 'toggle-tab active' : 'toggle-tab'} onClick={() => setFormType('Heat')}>Heat Cycle Trace</button>
        </div>

        {successMessage && <div className="breeding-alert alert-success">{successMessage}</div>}
        {errorMessage && <div className="breeding-alert alert-danger">{errorMessage}</div>}

        <form onSubmit={handleLogBreedingEvent}>
          <div className="breeding-row-grid">
            <div className="breeding-input-field">
              <label>Select Cow *</label>
              {eligibleCows.length === 0 ? (
                <select disabled className="disabled-select">
                  <option>No open eligible milking cows available today.</option>
                </select>
              ) : (
                <select value={selectedCowId} onChange={(e) => setSelectedCowId(e.target.value)} required>
                  {eligibleCows.map((c) => <option key={c.id} value={c.id}>{c.name} (Tag: {c.tagNumber})</option>)}
                </select>
              )}
            </div>
            <div className="breeding-input-field">
              <label>Date *</label>
              <input type="date" value={serviceDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => setServiceDate(e.target.value)} required />
            </div>
          </div>
          {formType === 'Insemination' && (
            <div className="ai-extended-form-fields animate-fade">
              <div className="checkbox-lock-row">
                <label className="checkbox-label-wrapper">
                  <input type="checkbox" checked={isBoughtPregnant} onChange={(e) => setIsBoughtPregnant(e.target.checked)} />
                  <span>This cow was bought already pregnant</span>
                </label>
              </div>

              {isBoughtPregnant && (
                <div className="breeding-input-field bought-pregnant-viewport animate-fade">
                  <label>Type Estimated Due Date Provided by Seller *</label>
                  <input type="date" value={manualDueDate} onChange={(e) => setManualDueDate(e.target.value)} required={isBoughtPregnant} />
                </div>
              )}

              <div className="breeding-row-grid">
                <div className="breeding-input-field">
                  <label>Semen Tag Name / Bull ID</label>
                  <input type="text" placeholder="e.g. BULL-CH-80" value={semenTag} onChange={(e) => setSemenTag(e.target.value)} />
                </div>
                <div className="breeding-input-field">
                  <label>Vet Name</label>
                  <input type="text" placeholder="Dr. John" value={vetName} onChange={(e) => setVetName(e.target.value)} />
                </div>
              </div>

              <div className="breeding-row-grid">
                <div className="breeding-input-field">
                  <label>AI Service Cost (Ksh)</label>
                  <input type="number" placeholder="e.g. 45" value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} />
                </div>
                <div className="breeding-input-field">
                  <label>Bull Quality Notes</label>
                  <input type="text" placeholder="Genetic notes" value={bullNotes} onChange={(e) => setBullNotes(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="commit-breeding-btn" disabled={eligibleCows.length === 0}>
            Save Event to History
          </button>
        </form>
      </div>

      {/* SECTION 2: LIVE PREGNANCY TRACKERS */}
      <div className="breeding-card-box">
        <h2>Pregnancy & Dry Cow Tracker ({activePregnancies.length})</h2>
        {activePregnancies.length === 0 ? (
          <p className="empty-sub-notice">No cows recorded as currently pregnant inside the herd registry.</p>
        ) : (
          <div className="pregnancy-mobile-deck">
            {activePregnancies.map((p) => {
              // Hunt for her current status in the database to see if she was archived since getting pregnant
              const matchingHerdAsset = herd.find(a => a.id === p.cowId);
              const isAssetArchived = matchingHerdAsset?.status.startsWith('Archived');

              return (
                <div 
                  key={p.id} 
                  className={`pregnancy-card-row ${isAssetArchived ? 'state-archived-pregnancy-ghost' : p.isDry ? 'state-dry-box' : 'state-pregnant-box'}`}
                >
                  <div className="pregnancy-card-main-info">
                    <h4>
                      <strong>{p.cowName}</strong> <small>(Tag: {p.cowTag})</small>
                      {isAssetArchived && <span className="ghost-alert-tag"> [Archived Asset]</span>}
                    </h4>
                    <p>Sire Straw Ref: <strong>{p.semenTag}</strong></p>
                    <p className="due-date-text">📅 Expected Due Date: <strong>{new Date(p.expectedDueDate).toLocaleDateString()}</strong></p>
                    <span className={p.isDry ? "dry-pill-badge" : "milking-pill-badge"}>
                      {isAssetArchived ? "🔒 Locked Archive" : p.isDry ? "🍂 Rest Ration: Dry Cow" : "🍼 Active Milk Line"}
                    </span>
                  </div>
                  
                  <div className="pregnancy-card-actions-cluster">
                    {/* 🔒 CONSTRAINT: Completely hide action toggles if the animal is dead or sold */}
                    {isAssetArchived ? (
                      <small className="disabled-notice-label">Locked</small>
                    ) : (
                      <>
                        {!p.isDry && <button type="button" className="action-row-btn dry" onClick={() => handleMarkAsDry(p.cowId)}>Mark Dry</button>}
                        <button type="button" className="action-row-btn miscarriage" onClick={() => handleLogMiscarriage(p.cowId)}>💔 Miscarriage</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        )}
      </div>

      {/* 📊 SECTION 3: LIVE HEAT TRACKING REGISTRY TABLE */}
      <div className="breeding-card-box">
        <h2>Heat Cycle Ledger ({heatEvents.length})</h2>
        {heatEvents.length === 0 ? (
          <p className="empty-sub-notice">No heat track signatures logged in history yet.</p>
        ) : (
          <div className="table-scroll-frame" style={{ overflowX: 'auto' }}>
            <table className="heat-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Tag</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {heatEvents.map(e => (
                  <tr key={e.id}>
                    <td><strong>{e.cowName}</strong></td>
                    <td>{e.cowTag}</td>
                    <td>{new Date(e.eventDate).toLocaleDateString()}</td>
                    <td><span className="heat-badge-glow">On Heat</span></td>
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

export default BreedingLog;
