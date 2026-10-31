// src/utils/excelParser.js
/**
 * Utility for parsing and generating Excel (.xlsx, .xls) and CSV (.csv) files for PCG Hymns,
 * with automatic Supabase Storage path resolution for Audio, Tonic Sol-fa, and Staff Notation PDFs.
 */

// Supabase Storage Public Base URL for the audio/media bucket
export const SUPABASE_STORAGE_BASE_URL =
  process.env.REACT_APP_SUPABASE_STORAGE_URL ||
  'https://byynncyyhpyqqisacbft.supabase.co/storage/v1/object/public/audio';

/**
 * Automatically resolve short filenames or relative paths to their full Supabase Storage public URLs.
 * Example:
 * - "hymn_001.mp3" -> "https://byynncyyhpyqqisacbft.supabase.co/storage/v1/object/public/audio/hymn_001.mp3"
 * - "https://cdn.example.com/audio.mp3" -> remains "https://cdn.example.com/audio.mp3"
 */
export const resolveStorageUrl = (rawPath) => {
  if (!rawPath) return null;
  const trimmed = String(rawPath).trim();
  if (!trimmed) return null;

  // If already a full HTTP/HTTPS URL, return as-is
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Strip leading slashes and optional bucket name prefix
  let cleanPath = trimmed.replace(/^\/+/, '');
  if (cleanPath.toLowerCase().startsWith('audio/')) {
    cleanPath = cleanPath.slice(6);
  }

  return `${SUPABASE_STORAGE_BASE_URL}/${cleanPath}`;
};

/**
 * Extract clean filename from a path or URL
 */
export const extractFileName = (rawPath) => {
  if (!rawPath) return '';
  const trimmed = String(rawPath).trim();
  const clean = trimmed.split('?')[0]; // strip query string if any
  const parts = clean.split(/[/\\]/);
  return parts[parts.length - 1] || trimmed;
};

/**
 * Parse multi-track audio cell format:
 * Supports:
 * - Single file: "hymn_001.mp3"
 * - Multiple files (semicolon or pipe separated): "hymn_001_choir.mp3; hymn_001_organ.mp3"
 * - Named renditions: "Full Choir:001_choir.mp3 | Organ:001_organ.mp3"
 */
export const parseAudioTracksFromCell = (
  audioCellStr,
  solfaUrl,
  solfaName,
  staffUrl,
  staffName,
  hymnNumber
) => {
  const baseTrack = {
    id: `track_${hymnNumber || '1'}_1`,
    title: 'Primary Recording',
    audioUrl: '',
    audioFileName: '',
    solfaUrl: solfaUrl || '',
    solfaFileName: solfaName || '',
    staffUrl: staffUrl || '',
    staffFileName: staffName || '',
  };

  if (!audioCellStr) {
    return [baseTrack];
  }

  const rawEntries = audioCellStr
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (rawEntries.length === 0) {
    return [baseTrack];
  }

  return rawEntries.map((entry, index) => {
    let title = index === 0 ? 'Primary Recording' : `Audio Track ${index + 1}`;
    let path = entry;

    if (
      entry.includes(':') &&
      !entry.toLowerCase().startsWith('http:') &&
      !entry.toLowerCase().startsWith('https:')
    ) {
      const colonIdx = entry.indexOf(':');
      const candidateTitle = entry.slice(0, colonIdx).trim();
      const candidatePath = entry.slice(colonIdx + 1).trim();
      if (candidateTitle && candidatePath) {
        title = candidateTitle;
        path = candidatePath;
      }
    }

    const resolvedUrl = resolveStorageUrl(path);
    const fileName = extractFileName(path);

    return {
      id: `track_${hymnNumber || '1'}_${index + 1}`,
      title,
      audioUrl: resolvedUrl || '',
      audioFileName: fileName,
      solfaUrl: solfaUrl || '',
      solfaFileName: solfaName || '',
      staffUrl: staffUrl || '',
      staffFileName: staffName || '',
    };
  });
};

// Dynamically load SheetJS if not already present on window
export const loadSheetJS = () => {
  if (typeof window !== 'undefined' && window.XLSX) {
    return Promise.resolve(window.XLSX);
  }

  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Document not available'));
    }

    const existingScript = document.querySelector('script[src*="xlsx"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.XLSX));
      existingScript.addEventListener('error', () => reject(new Error('Failed to load SheetJS')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.async = true;
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX);
      } else {
        reject(new Error('SheetJS loaded but XLSX object not found.'));
      }
    };
    script.onerror = () => {
      reject(new Error('Failed to load Excel parsing engine from CDN.'));
    };
    document.head.appendChild(script);
  });
};

/**
 * Robust RFC 4180 CSV parser in pure JS.
 * Handles:
 * - Newlines inside quotes (crucial for hymn stanzas)
 * - Escaped double quotes ("")
 * - Commas within quoted values
 * - UTF-8 BOM
 */
export const parseCsvTextRobust = (csvText) => {
  let text = csvText.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((cell) => cell.length > 0));
};

/**
 * Map flexible column header aliases to canonical database field names
 */
const FIELD_ALIASES = {
  hymn_number: [
    'hymn_number',
    'hymn_no',
    'hymn #',
    'hymn#',
    'number',
    'no',
    'hymnnumber',
    'hymnno',
    'no.',
    'hymn no.',
  ],
  title_en: [
    'title_en',
    'title',
    'english_title',
    'title_english',
    'english title',
    'hymn_title',
    'hymn title',
    'name',
    'title (en)',
  ],
  title_twi: [
    'title_twi',
    'twi_title',
    'title_asante',
    'twi title',
    'akan title',
    'title (twi)',
    'asante title',
  ],
  lyrics_en: [
    'lyrics_en',
    'lyrics',
    'english_lyrics',
    'lyrics_english',
    'english lyrics',
    'verses_en',
    'words',
    'text_en',
    'lyrics (en)',
  ],
  lyrics_twi: [
    'lyrics_twi',
    'twi_lyrics',
    'lyrics_asante',
    'twi lyrics',
    'verses_twi',
    'text_twi',
    'lyrics (twi)',
  ],
  audio_url: [
    'audio_url',
    'audio',
    'audio_file',
    'audio_path',
    'audio file',
    'audio path',
    'audio file / path',
    'audio recording',
    'recording',
    'audio track',
    'audio files',
  ],
  solfa_pdf: [
    'solfa_pdf',
    'solfa_file',
    'solfa_path',
    'tonic_solfa_pdf',
    'sol-fa pdf',
    'solfa pdf',
    'tonic sol-fa pdf',
    'sol-fa pdf / path',
    'solfa pdf / path',
    'tonic sol-fa pdf / path',
    'solfa sheet',
    'solfa score',
    'solfa document',
  ],
  staff_pdf: [
    'staff_pdf',
    'staff_file',
    'staff_path',
    'staff_notation_pdf',
    'staff notation pdf',
    'staff pdf',
    'staff pdf / path',
    'staff notation pdf / path',
    'sheet_music_pdf',
    'sheet music',
    'sheet music pdf',
    'western score pdf',
  ],
  tonic_solfa: [
    'tonic_solfa',
    'solfa',
    'tonic solfa',
    'sol-fa',
    'tonic_sol_fa',
    'music_notes',
    'solfa notation',
  ],
  staff_notation: [
    'staff_notation',
    'staff',
    'sheet_music',
    'western_notation',
    'staff notation',
  ],
  composer: [
    'composer',
    'author',
    'writer',
    'composer / author',
    'composer/author',
    'tune_author',
  ],
  scripture_reference: [
    'scripture_reference',
    'scripture',
    'bible_reference',
    'bible reference',
    'passage',
    'bible text',
  ],
  meter: ['meter', 'hymn_meter', 'metre', 'tune_meter'],
  key_signature: ['key_signature', 'key', 'tune_key', 'musical_key', 'key signature'],
  category: ['category', 'category_name', 'category_id', 'theme', 'topic'],
  is_published: ['is_published', 'published', 'status', 'active'],
};

/**
 * Match a header string to a canonical field name
 */
export const matchHeaderToField = (rawHeader) => {
  if (!rawHeader) return null;
  const clean = rawHeader.toLowerCase().trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  const cleanUnderscore = rawHeader.toLowerCase().trim().replace(/[\s-]+/g, '_');

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (field === cleanUnderscore) return field;
    for (const alias of aliases) {
      const aliasClean = alias.replace(/[-_]+/g, ' ');
      const aliasUnderscore = alias.replace(/[\s-]+/g, '_');
      if (clean === aliasClean || cleanUnderscore === aliasUnderscore) {
        return field;
      }
    }
  }
  return null;
};

/**
 * Normalize a single imported row into a valid hymn object
 */
export const normalizeHymnRecord = (rawObj, categories = [], existingHymns = []) => {
  const record = {
    hymn_number: null,
    title_en: '',
    title_twi: null,
    lyrics_en: '',
    lyrics_twi: null,
    composer: null,
    scripture_reference: null,
    meter: null,
    key_signature: null,
    tonic_solfa: null,
    staff_notation: null,
    category_id: null,
    category_name: null,
    is_published: true,

    // Media paths & URLs
    audio_path_raw: '',
    audio_url: null,
    audio_filename: '',
    solfa_pdf_raw: '',
    solfa_pdf_url: null,
    solfa_pdf_name: '',
    staff_pdf_raw: '',
    staff_pdf_url: null,
    staff_pdf_name: '',
    tracks: [],

    isValid: false,
    errors: [],
    warnings: [],
    isExisting: false,
    matchedId: null,
  };

  // Populate from rawObj keys using aliases
  for (const [rawKey, rawVal] of Object.entries(rawObj)) {
    if (rawVal === undefined || rawVal === null) continue;
    const strVal = String(rawVal).trim();
    if (!strVal) continue;

    const matchedField = matchHeaderToField(rawKey);
    if (!matchedField) continue;

    switch (matchedField) {
      case 'hymn_number': {
        const num = parseInt(strVal.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > 0) {
          record.hymn_number = num;
        }
        break;
      }
      case 'title_en':
        record.title_en = strVal;
        break;
      case 'title_twi':
        record.title_twi = strVal || null;
        break;
      case 'lyrics_en':
        record.lyrics_en = strVal;
        break;
      case 'lyrics_twi':
        record.lyrics_twi = strVal || null;
        break;
      case 'audio_url':
        record.audio_path_raw = strVal;
        break;
      case 'solfa_pdf':
        record.solfa_pdf_raw = strVal;
        break;
      case 'staff_pdf':
        record.staff_pdf_raw = strVal;
        break;
      case 'composer':
        record.composer = strVal || null;
        break;
      case 'scripture_reference':
        record.scripture_reference = strVal || null;
        break;
      case 'meter':
        record.meter = strVal || null;
        break;
      case 'key_signature':
        record.key_signature = strVal || null;
        break;
      case 'tonic_solfa':
        record.tonic_solfa = strVal || null;
        break;
      case 'staff_notation':
        record.staff_notation = strVal || null;
        break;
      case 'category':
        record.category_name = strVal;
        break;
      case 'is_published':
        record.is_published = !['false', '0', 'draft', 'unpublished', 'no'].includes(
          strVal.toLowerCase()
        );
        break;
      default:
        break;
    }
  }

  // Resolve Category name to category_id
  if (record.category_name && categories && categories.length > 0) {
    const catQuery = record.category_name.toLowerCase().trim();
    const matchedCategory = categories.find(
      (c) =>
        c.id === record.category_name ||
        c.name_en?.toLowerCase().trim() === catQuery ||
        c.name_twi?.toLowerCase().trim() === catQuery
    );
    if (matchedCategory) {
      record.category_id = matchedCategory.id;
      record.category_name = matchedCategory.name_en;
    }
  }

  // Resolve Sol-fa PDF URL
  if (record.solfa_pdf_raw) {
    record.solfa_pdf_url = resolveStorageUrl(record.solfa_pdf_raw);
    record.solfa_pdf_name = extractFileName(record.solfa_pdf_raw);
    if (!record.tonic_solfa) {
      record.tonic_solfa = record.solfa_pdf_url;
    }
  }

  // Resolve Staff Notation PDF URL
  if (record.staff_pdf_raw) {
    record.staff_pdf_url = resolveStorageUrl(record.staff_pdf_raw);
    record.staff_pdf_name = extractFileName(record.staff_pdf_raw);
    if (!record.staff_notation) {
      record.staff_notation = record.staff_pdf_url;
    }
  }

  // Resolve Multi-track Audio and Primary Audio URL
  record.tracks = parseAudioTracksFromCell(
    record.audio_path_raw,
    record.solfa_pdf_url,
    record.solfa_pdf_name,
    record.staff_pdf_url,
    record.staff_pdf_name,
    record.hymn_number
  );

  record.audio_url =
    record.tracks[0]?.audioUrl ||
    (record.audio_path_raw ? resolveStorageUrl(record.audio_path_raw) : null);
  record.audio_filename = record.tracks[0]?.audioFileName || extractFileName(record.audio_path_raw);

  // Check if matches an existing hymn in the database
  if (record.hymn_number && existingHymns && existingHymns.length > 0) {
    const found = existingHymns.find((h) => h.hymn_number === record.hymn_number);
    if (found) {
      record.isExisting = true;
      record.matchedId = found.id;
    }
  }

  // Validations
  if (!record.hymn_number) {
    record.errors.push('Missing or invalid Hymn Number');
  }
  if (!record.title_en) {
    record.errors.push('Missing English Title');
  }
  if (!record.lyrics_en) {
    record.errors.push('Missing English Lyrics');
  }

  // Warnings
  if (!record.title_twi && !record.lyrics_twi) {
    record.warnings.push('No Twi translation provided');
  }
  if (!record.category_id && record.category_name) {
    record.warnings.push(`Category "${record.category_name}" not found in database`);
  }

  record.isValid = record.errors.length === 0;

  return record;
};

/**
 * Parse an Excel (.xlsx, .xls) or CSV (.csv) File object
 */
export const parseSpreadsheetFile = async (file, categories = [], existingHymns = []) => {
  const fileName = file.name.toLowerCase();
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  const isCsv = fileName.endsWith('.csv');
  const isJson = fileName.endsWith('.json');

  if (!isExcel && !isCsv && !isJson) {
    throw new Error('Unsupported format. Please upload an Excel (.xlsx, .xls), CSV (.csv), or JSON (.json) file.');
  }

  // Handle JSON
  if (isJson) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const rawList = Array.isArray(parsed) ? parsed : parsed.hymns || [];
          const normalized = rawList.map((row) => normalizeHymnRecord(row, categories, existingHymns));
          resolve({
            records: normalized,
            fileName: file.name,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            format: 'JSON',
          });
        } catch (err) {
          reject(new Error('Invalid JSON format: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Handle Excel (.xlsx, .xls)
  if (isExcel) {
    const XLSX = await loadSheetJS();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No sheets found in this Excel workbook.');
          }

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!jsonRows || jsonRows.length === 0) {
            throw new Error('The Excel sheet contains no data rows.');
          }

          const normalized = jsonRows.map((row) => normalizeHymnRecord(row, categories, existingHymns));
          resolve({
            records: normalized,
            sheetName: firstSheetName,
            fileName: file.name,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            format: 'Excel',
          });
        } catch (err) {
          reject(new Error('Excel Parsing Error: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Handle CSV (.csv)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = parseCsvTextRobust(text);

        if (rows.length < 2) {
          throw new Error('CSV must contain a header row and at least one data row.');
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        const rawObjects = dataRows.map((row) => {
          const obj = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] || '';
          });
          return obj;
        });

        const normalized = rawObjects.map((row) => normalizeHymnRecord(row, categories, existingHymns));
        resolve({
          records: normalized,
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          format: 'CSV',
        });
      } catch (err) {
        reject(new Error('CSV Parsing Error: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read CSV file'));
    reader.readAsText(file);
  });
};

/**
 * Generate Sample Template (Excel or CSV) with Audio, Sol-fa, and Staff Notation path columns
 */
export const downloadHymnTemplate = async (format = 'xlsx', categories = []) => {
  const headers = [
    'Hymn Number',
    'English Title',
    'Twi Title',
    'Category',
    'Audio File / Path',
    'Tonic Sol-fa PDF / Path',
    'Staff Notation PDF / Path',
    'Composer',
    'Scripture Reference',
    'Meter',
    'Key Signature',
    'English Lyrics',
    'Twi Lyrics',
    'Is Published',
  ];

  const sampleData = [
    {
      'Hymn Number': 1,
      'English Title': 'Praise to the Lord, the Almighty',
      'Twi Title': 'Kamfo Awurade, Otumfoɔ',
      'Category': categories[0]?.name_en || 'Praise and Adoration',
      'Audio File / Path': 'hymn_001.mp3',
      'Tonic Sol-fa PDF / Path': 'solfa_001.pdf',
      'Staff Notation PDF / Path': 'staff_001.pdf',
      'Composer': 'Joachim Neander (1680)',
      'Scripture Reference': 'Psalm 103:1-6',
      'Meter': '14. 14. 4. 7. 8',
      'Key Signature': 'G Major',
      'English Lyrics':
        '1. Praise to the Lord, the Almighty, the King of creation!\nO my soul, praise Him, for He is thy health and salvation!\nAll ye who hear, now to His temple draw near;\nJoin me in glad adoration.\n\n2. Praise to the Lord, who o\'er all things so wondrously reigneth,\nShieldeth thee under His wings, yea, so gently sustaineth!\nHast thou not seen how thy desires e\'er have been\nGranted in what He ordaineth?',
      'Twi Lyrics':
        '1. Kamfo Awurade, Otumfoɔ, abɔdeɛ Hene no!\nMe kra, kamfo No, na Ɔno ne w\'apɔmuden ne nkwagyeɛ!\nMo a moteɛ, mommra Ne tenabea ha,\nNa yɛne mo nka nkabom nkamfo No.\n\n2. Kamfo Awurade, Ɔno a ɔhwɛ nneɛma nyinaa so,\nƆde Ne ntaban kata wo so, kura wo mu bɔkɔɔ;\nWoanhunu sɛ, nea w\'ani da so nyinaa,\nƆma no ba mu sɛdeɛ Ɔpɛ no?',
      'Is Published': 'TRUE',
    },
    {
      'Hymn Number': 2,
      'English Title': 'Holy, Holy, Holy! Lord God Almighty',
      'Twi Title': 'Kronkron, Kronkron, Kronkron! Otumfoɔ Nyame',
      'Category': categories[0]?.name_en || 'Praise and Adoration',
      'Audio File / Path': 'Choir:hymn_002_choir.mp3 | Organ:hymn_002_organ.mp3',
      'Tonic Sol-fa PDF / Path': 'solfa_002.pdf',
      'Staff Notation PDF / Path': 'staff_002.pdf',
      'Composer': 'Reginald Heber (1826)',
      'Scripture Reference': 'Revelation 4:8-11',
      'Meter': '11. 12. 12. 10',
      'Key Signature': 'E Major',
      'English Lyrics':
        '1. Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy, merciful and mighty!\nGod in three Persons, blessed Trinity!\n\n2. Holy, holy, holy! All the saints adore Thee,\nCasting down their golden crowns around the glassy sea;\nCherubim and seraphim falling down before Thee,\nWhich wert, and art, and evermore shalt be.',
      'Twi Lyrics':
        '1. Kronkron, kronkron, kronkron! Otumfoɔ Nyame!\nAnɔpahema yɛbɛto dwom ayi Wo ayɛ;\nKronkron, kronkron, kronkron, mmɔborɔhunufoɔ ne Tumfoɔ!\nNyame Mmiɛnsa-Koro, nhyira nka Wo!\n\n2. Kronkron, kronkron, kronkron! Ahotefoɔ nyinaa som Wo,\nWɔtoto wɔn sika ahyɛnkyɛ gu po a ɛte sɛ ahwehwɛ no ho;\nKerubim ne Serafim koto Wo anim,\nWo a Wote hɔ, na Wobɛtena hɔ daa.',
      'Is Published': 'TRUE',
    },
  ];

  if (format === 'xlsx') {
    const XLSX = await loadSheetJS();
    const wb = XLSX.utils.book_new();

    // Sheet 1: Hymn Template
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    ws['!cols'] = [
      { wch: 14 }, // Hymn Number
      { wch: 32 }, // English Title
      { wch: 32 }, // Twi Title
      { wch: 24 }, // Category
      { wch: 35 }, // Audio File / Path
      { wch: 25 }, // Solfa PDF
      { wch: 25 }, // Staff PDF
      { wch: 24 }, // Composer
      { wch: 22 }, // Scripture Reference
      { wch: 16 }, // Meter
      { wch: 15 }, // Key Signature
      { wch: 55 }, // English Lyrics
      { wch: 55 }, // Twi Lyrics
      { wch: 14 }, // Is Published
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'PCG_Hymns_Template');

    // Sheet 2: Available Categories Reference
    if (categories && categories.length > 0) {
      const catData = categories.map((c, i) => ({
        '#': i + 1,
        'Category Name (English)': c.name_en,
        'Category Name (Twi)': c.name_twi || '',
        'Category ID': c.id,
      }));
      const catWs = XLSX.utils.json_to_sheet(catData);
      catWs['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 38 }];
      XLSX.utils.book_append_sheet(wb, catWs, 'Categories_Reference');
    }

    // Sheet 3: Upload Instructions
    const instructions = [
      {
        'Step': '1. Fill in Data',
        'Details': 'Enter hymn lyrics and metadata. In the Audio, Sol-fa, and Staff columns, enter just the filenames (e.g. hymn_001.mp3, solfa_001.pdf, staff_001.pdf) or full URLs.',
      },
      {
        'Step': '2. Multiple Audios',
        'Details': 'For hymns with multiple recordings, separate with a pipe or semicolon (e.g. "Full Choir:001_choir.mp3 | Organ:001_organ.mp3").',
      },
      {
        'Step': '3. Import Spreadsheet',
        'Details': 'In the Admin Portal, go to Hymns Library -> "Import Excel / CSV" and upload this file.',
      },
      {
        'Step': '4. Super Admin Upload',
        'Details': 'Open the Supabase Dashboard -> Storage -> "audio" bucket and drag & drop the actual .mp3 and .pdf files directly!',
      },
    ];
    const instrWs = XLSX.utils.json_to_sheet(instructions);
    instrWs['!cols'] = [{ wch: 22 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'How_To_Upload');

    XLSX.writeFile(wb, 'PCG_Hymns_Import_Template.xlsx');
  } else {
    // CSV format
    const csvRows = [headers.map((h) => `"${h}"`).join(',')];
    sampleData.forEach((row) => {
      const vals = headers.map((h) => {
        const val = row[h] !== undefined ? String(row[h]).replace(/"/g, '""') : '';
        return `"${val}"`;
      });
      csvRows.push(vals.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PCG_Hymns_Import_Template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
