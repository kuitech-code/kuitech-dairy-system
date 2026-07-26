import React, { useState, useEffect } from 'react';
import './CowForm.css';

function CowForm({ initialData = null, onSave, onCancel = null }) {
  // Core Selection Dropdowns
  const statusOptions = ['Calf', 'Heifer', 'Pregnant', 'Milking', 'Dry'];
  const breedOptions = ['Friesian', 'Ayrshire', 'Jersey', 'Guernsey', 'Crossbreed'];

  // Form States - Pre-filled instantly if initialData exists (Edit Mode)
  const [tagNumber, setTagNumber] = useState(initialData?.tagNumber || '');
  const [name, setName] = useState(initialData?.name || '');
  const [breed, setBreed] = useState(initialData?.breed || 'Friesian');
  const [dob, setDob] = useState(initialData?.dob || '');
  const [gender, setGender] = useState(initialData?.gender || 'Female');
  const [status, setStatus] = useState(initialData?.status || 'Calf');
  const [calvingDate, setCalvingDate] = useState(initialData?.calvingDate || '');
  const [sireTag, setSireTag] = useState(initialData?.sireTag === 'Unknown' ? '' : initialData?.sireTag || '');
  const [damTag, setDamTag] = useState(initialData?.damTag === 'Unknown' ? '' : initialData?.damTag || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [imagePreview, setImagePreview] = useState(initialData?.image || null);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle local picture uploads
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    // 🔒 GUARD 1: Prevent Duplicate Tag IDs (Skip check if we are in Edit Mode)
    const savedHerd = localStorage.getItem('dairy_herd') || '[]';
    const currentHerd = JSON.parse(savedHerd);
    
    if (!initialData) {
      const tagExists = currentHerd.some(animal => animal.tagNumber.trim().toUpperCase() === tagNumber.trim().toUpperCase());
      if (tagExists) {
        setErrorMessage(`❌ Identity Conflict: An animal with Tag ID "${tagNumber.toUpperCase()}" is already registered!`);
        return;
      }
    }

    // Strict Validations
    if (!name.trim()) return setErrorMessage('❌ Cow Name is required!');
    if (!dob) return setErrorMessage('❌ Date of Birth is required!');
    
    // 🔒 GUARD 2: Prevent Future Dates of Birth
    if (new Date(dob) > new Date()) {
      setErrorMessage('❌ Date Error: Date of Birth cannot be in the future!');
      return;
    }

    if (status === 'Pregnant' && !calvingDate) return setErrorMessage('❌ Please select an expected calving date.');

    const finalAnimalData = {
      tagNumber: tagNumber.trim().toUpperCase(),
      name: name.trim(),
      breed,
      dob,
      gender,
      status,
      calvingDate: status === 'Pregnant' ? calvingDate : '',
      sireTag: sireTag.trim() === '' ? 'Unknown' : sireTag,
      damTag: damTag.trim() === '' ? 'Unknown' : damTag,
      notes,
      image: imagePreview
    };

    onSave(finalAnimalData);

    // 🔒 GUARD 3: Complete form wipe out on successful new save
    if (!initialData) {
      setTagNumber('');
      setName('');
      setBreed('Friesian');
      setDob('');
      setGender('Female');
      setStatus('Calf');
      setCalvingDate('');
      setSireTag('');
      setDamTag('');
      setImagePreview(null);
    }
  };


  return (
    <div className="cow-form-component">
      {errorMessage && <div className="form-error-banner">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        {/* Photo Picker */}
        <div className="image-upload-section">
          <label className="image-picker-box">
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="preview-thumbnail" />
            ) : (
              <div className="picker-placeholder"><span>📸</span><p>Add photo</p></div>
            )}
          </label>
        </div>

        <div className="input-row">
          <div className="input-field">
            <label>Tag ID *</label>
            {/* If editing, freeze the Tag ID box so they can't change identity numbers accidentally */}
            <input type="text" value={tagNumber} onChange={(e) => setTagNumber(e.target.value)} required disabled={!!initialData} placeholder="e.g. MS-103" />
          </div>
          <div className="input-field">
            <label>Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Daisy" />
          </div>
        </div>

        <div className="input-row">
          <div className="input-field">
            <label>Breed *</label>
            <select value={breed} onChange={(e) => setBreed(e.target.value)} required>
              {breedOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="input-field">
            <label>Date of Birth *</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
          </div>
        </div>

        <div className="input-row">
          <div className="input-field">
            <label>Gender *</label>
            <select value={gender} disabled={!!initialData} onChange={(e) => {
              setGender(e.target.value);
              if (e.target.value === 'Male') setStatus('Calf');
            }} required>
              <option value="Female">Female (Cow/Heifer)</option>
              <option value="Male">Male (Bull/Steer)</option>
            </select>
          </div>
          
          <div className="input-field">
            <label>Status *</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={gender === 'Male'} required>
              {gender === 'Male' ? (
                <option value="Calf">Calf</option>
              ) : (
                statusOptions.map((s) => <option key={s} value={s}>{s}</option>)
              )}
            </select>
          </div>
        </div>

        {status === 'Pregnant' && (
          <div className="input-field dynamic-field">
            <label>Expected Calving Due Date *</label>
            <input type="date" value={calvingDate} onChange={(e) => setCalvingDate(e.target.value)} />
          </div>
        )}

        <div className="input-row">
          <div className="input-field">
            <label>Sire (Father) Tag</label>
            <input type="text" value={sireTag} onChange={(e) => setSireTag(e.target.value)} placeholder="Optional" />
          </div>
          <div className="input-field">
            <label>Dam (Mother) Tag</label>
            <input type="text" value={damTag} onChange={(e) => setDamTag(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="input-field">
          <label>Notes / Markings / Sale Reasons</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any details..." />
        </div>

        <div className="form-action-buttons">
          <button type="submit" className="form-save-btn">Save Record Updates</button>
          {onCancel && <button type="button" className="form-cancel-btn" onClick={onCancel}>Cancel</button>}
        </div>
      </form>
    </div>
  );
}

export default CowForm;
