import React, { useState, useEffect } from 'react';
import CowForm from '../../components/CowForm';
import { formatCowAge, getCowAgeInMonths } from '../../utils/cowAge';
import { useToday } from '../../utils/useToday';
import './Cows.css';

const normalizeLifecycleStatus = (animal, today) => {
  if (!animal) return animal;
  if (!animal.dob) return { ...animal, status: animal.status || 'Calf' };

  const ageInMonths = getCowAgeInMonths(animal.dob, today);
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

function Cows({ onSelectCow }) {
  const today = useToday();
  const [herd, setHerd] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    try {
      const savedHerd = localStorage.getItem('dairy_herd');
      if (savedHerd) {
        const herdArray = JSON.parse(savedHerd);
        if (!Array.isArray(herdArray)) throw new Error('Stored herd data is not a list.');
        const normalizedHerd = herdArray.map((animal) => normalizeLifecycleStatus(animal, new Date()));
        setHerd(normalizedHerd);
        if (normalizedHerd.some((animal, index) => animal.status !== herdArray[index]?.status)) {
          try {
            localStorage.setItem('dairy_herd', JSON.stringify(normalizedHerd));
          } catch (error) {
            console.error('Could not save refreshed cow statuses:', error);
            setErrorMessage('Animal ages and statuses were refreshed on screen, but could not be saved to browser storage. Export a backup and free some storage.');
          }
        }
      }
    } catch (error) {
      console.error('Could not load stored herd records:', error);
      setErrorMessage('Saved herd data could not be loaded. Restore a recent backup or contact support.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddNewCow = (newCowData) => {
    const completeCowObject = normalizeLifecycleStatus({
      ...newCowData,
      id: Date.now() // Give it a fresh unique stamp
    });
    const updatedHerd = [completeCowObject, ...herd];
    try {
      localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
    } catch (error) {
      console.error('Could not save cow record:', error);
      setErrorMessage('Could not save this animal. Browser storage may be full; remove unused photos or export a backup before trying again.');
      return false;
    }

    setHerd(updatedHerd);
    setErrorMessage('');
    setSuccessMessage('New animal registered successfully offline!');
    setCurrentPage(1);
    setTimeout(() => setSuccessMessage(''), 3000); // clear banner after 3 seconds
    return true;
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const currentHerd = herd.map((cow) => normalizeLifecycleStatus(cow, today));
  const currentHerdSlice = currentHerd.slice(indexOfLastItem - itemsPerPage, indexOfLastItem);
  const totalPages = Math.ceil(currentHerd.length / itemsPerPage);

  return (
    <div className="cows-container">
      <div className="form-card">
        <h2>Register New Animal</h2>
        {errorMessage && <div className="error-banner" role="alert">{errorMessage}</div>}
        {successMessage && <div className="success-banner">{successMessage}</div>}
        {/* Call the reusable form module */}
        <CowForm onSave={handleAddNewCow} />
      </div>

      <div className="directory-card">
        <h2>Herd Directory ({herd.length})</h2>
        {loading ? <p className="status-text">Loading records...</p> : (
          <>
            <div className="mobile-list">
              {currentHerdSlice.map((cow) => (
                <div key={cow.id} className={`mobile-row-card status-${(cow.status || 'Calf').toLowerCase().split(' ')[0]}`} onClick={() => onSelectCow(cow.id)}>
                  <div className="row-main">
                    {cow.image ? <img src={cow.image} alt="Cow" className="row-image-avatar" /> : <span className="row-avatar e">🐄</span>}
                    <div>
                      <h3>{cow.name}</h3>
                      <p>Tag: <strong>{cow.tagNumber}</strong> • {cow.breed}</p>
                      <p>Age: {formatCowAge(cow.dob, today)}</p>
                    </div>
                  </div>
                  <div className="row-badge-area">
                    <span className="gender-sub">{cow.gender}</span>
                    <span className="state-badge">{cow.status || 'Calf'}</span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mobile-pagination">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>◀ Prev</button>
                <span className="page-indicator">Page <strong>{currentPage}</strong> of {totalPages}</span>
                <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next ▶</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Cows;
