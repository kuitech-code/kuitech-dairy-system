// backupUtils.js
// Handles encrypted farm backup creation and restoration.

export const BACKUP_VERSION = 1;

export const DAIRY_DATA_KEYS = [
  'dairy_herd',
  'dairy_milk_logs',
  'dairy_feed_receipts',
  'dairy_feed_catalog',
  'dairy_health_logs',
  'dairy_breeding_events',
  'dairy_pregnancies',
  'dairy_manual_incomes',
  'dairy_manual_expenses',
  'dairy_global_milk_price',
];

// ============================================================
// FARM IDENTITY
// ============================================================

export function getFarmName() {
  return localStorage.getItem('dairy_farm_name') || '';
}

// ============================================================
// COLLECT FARM DATA
// ============================================================

export function collectFarmData() {
  const farmName = getFarmName();

  const data = {};

  DAIRY_DATA_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);

    try {
      data[key] = value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Could not read backup key: ${key}`, error);
      data[key] = null;
    }
  });

  return {
    backupVersion: BACKUP_VERSION,
    farmName,
    createdAt: new Date().toISOString(),
    data,
  };
}

// ============================================================
// ENCODING HELPERS
// ============================================================

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

// ============================================================
// CREATE ENCRYPTION KEY
// ============================================================

async function createEncryptionKey() {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// ============================================================
// ENCRYPT BACKUP
// ============================================================

export async function createEncryptedBackup() {
  const backupData = collectFarmData();

  const encryptionKey = await createEncryptionKey();

  const rawKey = await crypto.subtle.exportKey('raw', encryptionKey);

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encodedData = new TextEncoder().encode(
    JSON.stringify(backupData)
  );

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    encodedData
  );

  return {
    backupType: 'Kuitech Dairy Encrypted Backup',
    backupVersion: BACKUP_VERSION,
    farmName: backupData.farmName,
    createdAt: backupData.createdAt,

    encryption: {
      algorithm: 'AES-GCM',
      key: arrayBufferToBase64(rawKey),
      iv: arrayBufferToBase64(iv),
    },

    payload: arrayBufferToBase64(encryptedData),
  };
}

// ============================================================
// DECRYPT BACKUP
// ============================================================

export async function decryptBackupFile(backupPackage) {
  if (
    !backupPackage ||
    backupPackage.backupType !== 'Kuitech Dairy Encrypted Backup'
  ) {
    throw new Error('This is not a valid Kuitech Dairy backup file.');
  }

  if (backupPackage.backupVersion !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version: ${backupPackage.backupVersion}`
    );
  }

  if (!backupPackage.encryption || !backupPackage.payload) {
    throw new Error('Backup encryption data is missing.');
  }

  const rawKey = base64ToArrayBuffer(
    backupPackage.encryption.key
  );

  const iv = new Uint8Array(
    base64ToArrayBuffer(backupPackage.encryption.iv)
  );

  const encryptedData = base64ToArrayBuffer(
    backupPackage.payload
  );

  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
    },
    false,
    ['decrypt']
  );

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    encryptedData
  );

  const decodedText = new TextDecoder().decode(decryptedData);

  const parsedBackup = JSON.parse(decodedText);

  validateBackupData(parsedBackup);

  return parsedBackup;
}

// ============================================================
// VALIDATE BACKUP
// ============================================================

export function validateBackupData(backupData) {
  if (!backupData) {
    throw new Error('Backup data is empty.');
  }

  if (backupData.backupVersion !== BACKUP_VERSION) {
    throw new Error('This backup version is not supported.');
  }

  if (
    typeof backupData.farmName !== 'string' ||
    backupData.farmName.trim() === ''
  ) {
    throw new Error('Backup does not contain a valid farm name.');
  }

  if (!backupData.data || typeof backupData.data !== 'object') {
    throw new Error('Backup does not contain farm records.');
  }

  return true;
}

// ============================================================
// VERIFY FARM IDENTITY
// ============================================================

export function verifyFarmIdentity(backupData) {
  const currentFarmName = getFarmName();

  if (!currentFarmName) {
    throw new Error('Current device has no registered farm name.');
  }

  if (
    backupData.farmName.trim().toLowerCase() !==
    currentFarmName.trim().toLowerCase()
  ) {
    throw new Error(
      `This backup belongs to "${backupData.farmName}", not "${currentFarmName}".`
    );
  }

  return true;
}

// ============================================================
// RESTORE FARM DATA
// ============================================================

export function restoreFarmData(backupData) {
  validateBackupData(backupData);
  verifyFarmIdentity(backupData);

  // IMPORTANT:
  // Never touch the license.
  // Never touch the farm name.
  // Never touch the current user session.

  DAIRY_DATA_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });

  DAIRY_DATA_KEYS.forEach((key) => {
    const value = backupData.data[key];

    if (value !== null && value !== undefined) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });

  return true;
}

// ============================================================
// DOWNLOAD BACKUP FILE
// ============================================================

export async function downloadFarmBackup() {
  const backupPackage = await createEncryptedBackup();

  const farmName = getFarmName() || 'Dairy_Farm';

  const safeFarmName = farmName
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_');

  const dateStamp = new Date()
    .toISOString()
    .split('T')[0];

  const fileName =
    `${safeFarmName}_Dairy_Backup_${dateStamp}.json`;

  const fileContents = JSON.stringify(
    backupPackage,
    null,
    2
  );

  const blob = new Blob(
    [fileContents],
    {
      type: 'application/json',
    }
  );

  const url = URL.createObjectURL(blob);

  const downloadAnchor = document.createElement('a');

  downloadAnchor.href = url;
  downloadAnchor.download = fileName;

  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  URL.revokeObjectURL(url);
}

// ============================================================
// TEST FUNCTION
// ============================================================

// export function testBackupCollection() {
//   const backup = collectFarmData();

//   console.log('BACKUP TEST:', backup);

//   return backup;
// }