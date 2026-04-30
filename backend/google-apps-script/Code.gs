/**
 * SISTEM ADMIN GYM - Google Apps Script Backend
 *
 * Versi ini dibuat tanpa PIN, tanpa no HP, tanpa jenis kunjungan, dan tanpa catatan.
 * Frontend GitHub Pages mengirim data ke backend ini, lalu backend menyimpan ke Google Sheet.
 */

const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const MAX_KEY_NUMBER = 100;

const SHEET_LOG = 'LOG_GYM';
const SHEET_KEYS = 'DATA_KUNCI';
const SHEET_MEMBERS = 'MEMBER_LIFETIME';

const LOG_HEADERS = [
  'ID',
  'Timestamp',
  'Tanggal',
  'Jam',
  'Nama Pelanggan',
  'No Kunci',
  'Status',
  'Admin'
];

const KEY_HEADERS = [
  'No Kunci',
  'Status',
  'Dipakai Oleh',
  'Jam Masuk',
  'Update Terakhir'
];

const MEMBER_HEADERS = [
  'ID Member',
  'Nama Member',
  'Tanggal Daftar',
  'Status',
  'Diinput Oleh',
  'Update Terakhir'
];

function setupGymSheets() {
  const ss = getSpreadsheet_();
  const logSheet = getOrCreateSheet_(ss, SHEET_LOG);
  const keySheet = getOrCreateSheet_(ss, SHEET_KEYS);
  const memberSheet = getOrCreateSheet_(ss, SHEET_MEMBERS);

  setupHeader_(logSheet, LOG_HEADERS);
  setupHeader_(keySheet, KEY_HEADERS);
  setupHeader_(memberSheet, MEMBER_HEADERS);
  seedKeys_(keySheet, MAX_KEY_NUMBER);

  logSheet.setFrozenRows(1);
  keySheet.setFrozenRows(1);
  memberSheet.setFrozenRows(1);
  logSheet.autoResizeColumns(1, LOG_HEADERS.length);
  keySheet.autoResizeColumns(1, KEY_HEADERS.length);
  memberSheet.autoResizeColumns(1, MEMBER_HEADERS.length);
}

function doGet(e) {
  try {
    ensureReady_();
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || 'ping').toLowerCase();

    if (action === 'keys') {
      return respondJson_(params.callback, {
        ok: true,
        message: 'Data kunci berhasil diambil.',
        data: getKeys_()
      });
    }

    if (action === 'members') {
      return respondJson_(params.callback, {
        ok: true,
        message: 'Data member lifetime berhasil diambil.',
        data: getMembers_()
      });
    }

    return respondJson_(params.callback, {
      ok: true,
      message: 'Backend Sistem Admin Gym aktif.',
      data: {
        app: 'Sistem Admin Gym',
        serverTime: formatDateTime_(new Date())
      }
    });
  } catch (error) {
    const params = e && e.parameter ? e.parameter : {};
    return respondJson_(params.callback, {
      ok: false,
      message: error.message || String(error)
    });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(10000);
    locked = true;

    ensureReady_();

    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || '').trim();
    if (action !== 'saveLog') {
      throw new Error('Action tidak dikenal.');
    }

    const payload = normalizePayload_(params);
    const ss = getSpreadsheet_();
    const logSheet = getOrCreateSheet_(ss, SHEET_LOG);
    const keySheet = getOrCreateSheet_(ss, SHEET_KEYS);

    setupHeader_(logSheet, LOG_HEADERS);
    setupHeader_(keySheet, KEY_HEADERS);

    const currentKey = getKeyRecord_(keySheet, payload.keyNumber);
    if (payload.status === 'Masuk' && currentKey.status === 'Dipakai') {
      throw new Error(`Kunci ${payload.keyNumber} sedang dipakai oleh ${currentKey.customerName || 'pelanggan lain'}.`);
    }

    appendLog_(logSheet, payload);
    updateKey_(keySheet, payload);

    return respondPostMessage_({
      ok: true,
      message: `Data ${payload.status.toLowerCase()} berhasil disimpan untuk kunci ${payload.keyNumber}.`
    });
  } catch (error) {
    return respondPostMessage_({
      ok: false,
      message: error.message || String(error)
    });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function ensureReady_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    throw new Error('SPREADSHEET_ID belum diisi di Code.gs.');
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function setupHeader_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeader = current.every(value => String(value || '').trim() === '');
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#eef3ff');
  }
}

function seedKeys_(sheet, maxKey) {
  const existingKeys = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    values.forEach(row => {
      const key = normalizeKeyNumber_(row[0]);
      if (key) existingKeys.add(key);
    });
  }

  const rows = [];
  for (let i = 1; i <= maxKey; i += 1) {
    const key = String(i).padStart(2, '0');
    if (!existingKeys.has(key)) {
      rows.push([key, 'Kosong', '', '', '']);
    }
  }

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, KEY_HEADERS.length).setValues(rows);
  }
}

function normalizePayload_(params) {
  const customerName = cleanText_(params.customerName);
  const keyNumber = normalizeKeyNumber_(params.keyNumber);
  const status = normalizeStatus_(params.status);
  const admin = cleanText_(params.admin);

  if (!admin) throw new Error('Nama admin/pegawai wajib diisi.');
  if (!customerName) throw new Error('Nama pelanggan wajib diisi.');
  if (!keyNumber) throw new Error('Nomor kunci wajib diisi.');
  if (!status) throw new Error('Status tidak valid.');

  return {
    customerName,
    keyNumber,
    status,
    admin,
    timestamp: new Date()
  };
}

function cleanText_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeKeyNumber_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const number = Number(raw);
  if (!Number.isFinite(number) || number <= 0) return '';
  return String(Math.floor(number)).padStart(2, '0');
}

function normalizeStatus_(value) {
  const allowed = ['Masuk', 'Keluar'];
  const found = allowed.find(item => item.toLowerCase() === String(value || '').trim().toLowerCase());
  return found || '';
}

function appendLog_(sheet, payload) {
  const timestamp = payload.timestamp || new Date();
  const id = createId_(timestamp);

  sheet.appendRow([
    id,
    timestamp,
    formatDate_(timestamp),
    formatTime_(timestamp),
    payload.customerName,
    payload.keyNumber,
    payload.status,
    payload.admin
  ]);
}

function updateKey_(sheet, payload) {
  const record = getKeyRecord_(sheet, payload.keyNumber);
  const rowIndex = record.rowIndex || appendKeyRow_(sheet, payload.keyNumber);
  const nowText = formatDateTime_(new Date());

  if (payload.status === 'Masuk') {
    sheet.getRange(rowIndex, 1, 1, KEY_HEADERS.length).setValues([[
      payload.keyNumber,
      'Dipakai',
      payload.customerName,
      formatDateTime_(payload.timestamp || new Date()),
      nowText
    ]]);
  } else {
    sheet.getRange(rowIndex, 1, 1, KEY_HEADERS.length).setValues([[
      payload.keyNumber,
      'Kosong',
      '',
      '',
      nowText
    ]]);
  }
}

function appendKeyRow_(sheet, keyNumber) {
  const rowIndex = sheet.getLastRow() + 1;
  sheet.getRange(rowIndex, 1, 1, KEY_HEADERS.length).setValues([[
    keyNumber,
    'Kosong',
    '',
    '',
    ''
  ]]);
  return rowIndex;
}

function getKeyRecord_(sheet, keyNumber) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { rowIndex: null, keyNumber, status: 'Kosong', customerName: '', checkInTime: '', updatedAt: '' };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, KEY_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i += 1) {
    const row = values[i];
    const rowKey = normalizeKeyNumber_(row[0]);
    if (rowKey === keyNumber) {
      return {
        rowIndex: i + 2,
        keyNumber: rowKey,
        status: cleanText_(row[1]) || 'Kosong',
        customerName: cleanText_(row[2]),
        checkInTime: stringifyCell_(row[3]),
        updatedAt: stringifyCell_(row[4])
      };
    }
  }

  return { rowIndex: null, keyNumber, status: 'Kosong', customerName: '', checkInTime: '', updatedAt: '' };
}

function getKeys_() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, SHEET_KEYS);
  setupHeader_(sheet, KEY_HEADERS);
  seedKeys_(sheet, MAX_KEY_NUMBER);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, KEY_HEADERS.length).getValues();
  return values
    .filter(row => cleanText_(row[0]))
    .map(row => ({
      keyNumber: normalizeKeyNumber_(row[0]),
      status: cleanText_(row[1]) || 'Kosong',
      customerName: cleanText_(row[2]),
      checkInTime: stringifyCell_(row[3]),
      updatedAt: stringifyCell_(row[4])
    }));
}

function getMembers_() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, SHEET_MEMBERS);
  setupHeader_(sheet, MEMBER_HEADERS);

  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), MEMBER_HEADERS.length);
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(cleanHeader_);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const idx = {
    memberId: findHeaderIndex_(headers, ['id member', 'id', 'no member', 'nomor member', 'kode member']),
    memberName: findHeaderIndex_(headers, ['nama member', 'nama', 'name', 'member']),
    registeredAt: findHeaderIndex_(headers, ['tanggal daftar', 'tanggal', 'join date', 'mulai member', 'tanggal mulai']),
    status: findHeaderIndex_(headers, ['status', 'status member', 'tipe member']),
    createdBy: findHeaderIndex_(headers, ['diinput oleh', 'admin', 'input oleh', 'pegawai']),
    updatedAt: findHeaderIndex_(headers, ['update terakhir', 'updated at', 'last update', 'terakhir update'])
  };

  return values
    .map((row, index) => {
      const fallbackId = index + 1;
      const memberId = getRowValue_(row, idx.memberId) || String(fallbackId).padStart(3, '0');
      const memberName = getRowValue_(row, idx.memberName);
      return {
        memberId,
        memberName,
        registeredAt: stringifyCell_(getRawRowValue_(row, idx.registeredAt)),
        status: getRowValue_(row, idx.status) || 'Lifetime',
        createdBy: getRowValue_(row, idx.createdBy),
        updatedAt: stringifyCell_(getRawRowValue_(row, idx.updatedAt))
      };
    })
    .filter(item => item.memberName || item.memberId);
}

function cleanHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeaderIndex_(headers, aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
}

function getRawRowValue_(row, index) {
  return index >= 0 ? row[index] : '';
}

function getRowValue_(row, index) {
  return cleanText_(getRawRowValue_(row, index));
}

function createId_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss-SSS');
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function formatTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm:ss');
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

function stringifyCell_(value) {
  if (value instanceof Date) return formatDateTime_(value);
  return cleanText_(value);
}

function respondJson_(callback, payload) {
  const json = JSON.stringify(payload);
  if (callback) {
    const safeCallback = String(callback).replace(/[^a-zA-Z0-9_.$]/g, '');
    return ContentService
      .createTextOutput(`${safeCallback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function respondPostMessage_(payload) {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const html = `
    <!doctype html>
    <html>
      <body>
        <script>
          window.parent.postMessage({
            source: 'sistem-gym-backend',
            payload: ${safeJson}
          }, '*');
        </script>
      </body>
    </html>
  `;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
