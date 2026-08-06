import React, { useState, useEffect } from 'react';
import CowForm from '../../components/CowForm';
import './Cows.css';

function Cows({ onSelectCow }) {
  const [herd, setHerd] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    const savedHerd = localStorage.getItem('dairy_herd');
    if (savedHerd) {
      setHerd(JSON.parse(savedHerd));
    }
    setLoading(false);
  }, []);

  const handleAddNewCow = (newCowData) => {
    const completeCowObject = {
      ...newCowData,
      id: Date.now() // Give it a fresh unique stamp
    };
    const updatedHerd = [completeCowObject, ...herd];
    setHerd(updatedHerd);
    localStorage.setItem('dairy_herd', JSON.stringify(updatedHerd));
    
    setSuccessMessage('🎉 New animal registered successfully offline!');
    setCurrentPage(1);
    setTimeout(() => setSuccessMessage(''), 3000); // clear banner after 3 seconds
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const currentHerdSlice = herd.slice(indexOfLastItem - itemsPerPage, indexOfLastItem);
  const totalPages = Math.ceil(herd.length / itemsPerPage);

  return (
    <div className="cows-container">
      <div className="form-card">
        <h2>Register New Animal</h2>
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
                <div key={cow.id} className={`mobile-row-card status-${cow.status.toLowerCase().split(' ')[0]}`} onClick={() => onSelectCow(cow.id)}>
                  <div className="row-main">
                    {cow.image ? <img src={cow.image} alt="Cow" className="row-image-avatar" /> : <span className="row-avatar">🐄</span>}
                    <div>
                      <h3>{cow.name}</h3>
                      <p>Tag: <strong>{cow.tagNumber}</strong> • {cow.breed}</p>
                    </div>
                  </div>
                  <div className="row-badge-area">
                    <span className="gender-sub">{cow.gender}</span>
                    <span className="state-badge">{cow.status}</span>
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
