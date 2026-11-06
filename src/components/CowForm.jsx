import React, { useState, useEffect } from 'react';
import { getCowAgeInMonths } from '../utils/cowAge';
import './CowForm.css';

const getAutoStatus = (gender, dob, currentStatus = 'Calf') => {
  if (!dob) return currentStatus || 'Calf';

  const ageInMonths = getCowAgeInMonths(dob);

  if (gender === 'Male') {
    return ageInMonths < 6 ? 'Calf' : 'Bull';
  }

  if (ageInMonths < 6) return 'Calf';

  if (['Dry', 'AI_PENDING', 'Eligible'].includes(currentStatus)) return 'Milking';
  if (['Pregnant', 'Milking'].includes(currentStatus)) return currentStatus;

  return 'Heifer';
};

const getAllowedStatusOptions = (gender, dob) => {
  if (gender === 'Male') return ['Calf', 'Bull'];

  const ageInMonths = getCowAgeInMonths(dob);
  if (ageInMonths < 6) return ['Calf'];
  if (ageInMonths < 13) return ['Calf', 'Heifer'];
  return ['Calf', 'Heifer', 'Pregnant', 'Milking'];
};

function CowForm({ initialData = null, onSave, onCancel = null }) {
  const breedOptions = ['Friesian', 'Ayrshire', 'Jersey', 'Guernsey', 'Crossbreed'];

  // Form States - Pre-filled instantly if initialData exists (Edit Mode)
  const [tagNumber, setTagNumber] = useState(initialData?.tagNumber || '');
  const [name, setName] = useState(initialData?.name || '');
  const [breed, setBreed] = useState(initialData?.breed || 'Friesian');
  const [dob, setDob] = useState(initialData?.dob || '');
  const [gender, setGender] = useState(initialData?.gender || 'Female');
  const [status, setStatus] = useState(() => getAutoStatus(initialData?.gender || 'Female', initialData?.dob || '', initialData?.status || 'Calf'));
  const [calvingDate, setCalvingDate] = useState(initialData?.calvingDate || '');
  const [sireTag, setSireTag] = useState(initialData?.sireTag === 'Unknown' ? '' : initialData?.sireTag || '');
  const [damTag, setDamTag] = useState(initialData?.damTag === 'Unknown' ? '' : initialData?.damTag || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [heartGirth, setHeartGirth] = useState(initialData?.heartGirth || '');
  const [bodyWidth, setBodyWidth] = useState(initialData?.bodyWidth || '');
  const [castrationDate, setCastrationDate] = useState(initialData?.castrationDate || '');
  const [imagePreview, setImagePreview] = useState(initialData?.image || null);
  const [errorMessage, setErrorMessage] = useState('');
  const parentageLocked = Boolean(initialData?.parentageLocked || (initialData?.damTag && initialData.damTag !== 'Unknown'));

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage('');
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Choose an image file to upload.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage('Choose an image smaller than 12 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setErrorMessage('The selected photo could not be read. Try another image.');
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => setErrorMessage('The selected photo could not be opened. Try a JPEG or PNG image.');
      image.onload = () => {
        try {
          const maxDimension = 900;
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas rendering is unavailable.');

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const compressedImage = canvas.toDataURL('image/jpeg', 0.72);
          if (!compressedImage || compressedImage === 'data:,') {
            throw new Error('The photo could not be compressed.');
          }

          setImagePreview(compressedImage);
        } catch (error) {
          console.error('Could not prepare uploaded cow photo:', error);
          setErrorMessage('The photo could not be prepared for storage. Try another image.');
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const nextStatus = getAutoStatus(gender, dob, status);
    if (nextStatus !== status) {
      setStatus(nextStatus);
    }
  }, [dob, gender]);

  const allowedStatusOptions = getAllowedStatusOptions(gender, dob);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    // 🔒 GUARD 1: Prevent Duplicate Tag IDs (Skip check if we are in Edit Mode)
    let currentHerd;
    try {
      const savedHerd = localStorage.getItem('dairy_herd') || '[]';
      currentHerd = JSON.parse(savedHerd);
      if (!Array.isArray(currentHerd)) throw new Error('Stored herd data is not a list.');
    } catch (error) {
      console.error('Could not read stored herd before saving:', error);
      setErrorMessage('Saved herd data could not be read. Restore a recent backup before making changes.');
      return;
    }
    
    if (!initialData) {
      const tagExists = currentHerd.some(animal => animal.tagNumber.trim().toUpperCase() === tagNumber.trim().toUpperCase());
      if (tagExists) {
        setErrorMessage(`Identity Conflict: An animal with Tag ID "${tagNumber.toUpperCase()}" is already registered!`);
        return;
      }
    }

    // Strict Validations
    if (!name.trim()) return setErrorMessage('Cow Name is required!');
    if (!dob) return setErrorMessage('Date of Birth is required!');
    
    // 🔒 GUARD 2: Prevent Future Dates of Birth
    if (new Date(dob) > new Date()) {
      setErrorMessage('Date Error: Date of Birth cannot be in the future!');
      return;
    }

    if (gender === 'Male' && castrationDate && new Date(castrationDate) < new Date(dob)) {
      return setErrorMessage('Castration date cannot be earlier than the animal\'s date of birth.');
    }

    const computedStatus = getAutoStatus(gender, dob, status);
    if (!allowedStatusOptions.includes(computedStatus)) {
      return setErrorMessage('This animal age group cannot be assigned a pregnant or milking status.');
    }

    if (computedStatus === 'Pregnant' && !calvingDate) return setErrorMessage('Please select an expected calving date.');

    const finalAnimalData = {
      tagNumber: tagNumber.trim().toUpperCase(),
      name: name.trim(),
      breed,
      dob,
      gender,
      status: computedStatus,
      calvingDate: computedStatus === 'Pregnant' ? calvingDate : '',
      castrationDate: gender === 'Male' ? castrationDate : '',
      heartGirth: heartGirth ? parseFloat(heartGirth) : '',
      bodyWidth: bodyWidth ? parseFloat(bodyWidth) : '',
      sireTag: sireTag.trim() === '' ? 'Unknown' : sireTag,
      damTag: damTag.trim() === '' ? 'Unknown' : damTag,
      notes,
      image: imagePreview
    };

    if (onSave(finalAnimalData) === false) return;

    // 🔒 GUARD 3: Complete form wipe out on successful new save
    if (!initialData) {
      setTagNumber('');
      setName('');
      setBreed('Friesian');
      setDob('');
      setGender('Female');
      setStatus('Calf');
      setCalvingDate('');
      setCastrationDate('');
      setHeartGirth('');
      setBodyWidth('');
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
              <div className="picker-placeholder"><span className='e'>📸</span><p>Add photo</p></div>
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
              const nextGender = e.target.value;
              setGender(nextGender);
              setStatus(getAutoStatus(nextGender, dob, status));
            }} required>
              <option value="Female">Female (Cow/Heifer)</option>
              <option value="Male">Male (Bull/Steer)</option>
            </select>
          </div>
          
          <div className="input-field">
            <label>Status *</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} required>
              {allowedStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {status === 'Pregnant' && (
          <div className="input-field dynamic-field">
            <label>Expected Calving Due Date *</label>
            <input type="date" value={calvingDate} onChange={(e) => setCalvingDate(e.target.value)} />
          </div>
        )}

        {gender === 'Male' && (
          <div className="input-field dynamic-field">
            <label>Castration Date (Optional)</label>
            <input
              type="date"
              value={castrationDate}
              onChange={(e) => setCastrationDate(e.target.value)}
              min={dob || undefined}
              placeholder="Leave blank if not castrated"
            />
          </div>
        )}

        <div className="input-row">
          <div className="input-field">
            <label>Heart Girth (cm - Optional)</label>
            <input type="number" value={heartGirth} onChange={(e) => setHeartGirth(e.target.value)} placeholder="e.g. 165" step="0.1" />
          </div>
          <div className="input-field">
            <label>Body Width (cm - Optional)</label>
            <input type="number" value={bodyWidth} onChange={(e) => setBodyWidth(e.target.value)} placeholder="e.g. 45" step="0.1" />
          </div>
        </div>

        <div className="input-row">
          <div className="input-field">
            <label>Sire (Father) Tag</label>
            <input type="text" value={sireTag} onChange={(e) => setSireTag(e.target.value)} placeholder="Optional" disabled={parentageLocked} />
          </div>
          <div className="input-field">
            <label>Dam (Mother) Tag</label>
            <input type="text" value={damTag} onChange={(e) => setDamTag(e.target.value)} placeholder="Optional" disabled={parentageLocked} />
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
