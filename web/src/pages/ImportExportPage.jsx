// src/pages/ImportExportPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import Swal from 'sweetalert2';
import {
  parseSpreadsheetFile,
  downloadHymnTemplate,
  loadSheetJS,
} from '../utils/excelParser';
import {
  UploadCloudIcon,
  DownloadCloudIcon,
  ExcelIcon,
  JsonIcon,
  SparkleIcon,
  SingleCheckIcon,
  CloseIcon,
  RefreshIcon,
  AudioIcon,
  SolfaIcon,
  MusicIcon,
} from '../config/icons';

const ImportExportPage = () => {
  const [categories, setCategories] = useState([]);
  const [existingHymns, setExistingHymns] = useState([]);
  const [importRecords, setImportRecords] = useState([]);
  const [fileMeta, setFileMeta] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importMode, setImportMode] = useState('upsert'); // 'upsert' | 'skip_existing'
  const [filterView, setFilterView] = useState('all'); // 'all' | 'valid' | 'existing' | 'errors'
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDatabaseContext();
  }, []);

  const loadDatabaseContext = async () => {
    try {
      const [hRes, cRes] = await Promise.all([
        supabase.from('hymns').select('*').order('hymn_number', { ascending: true }),
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      ]);
      if (!hRes.error) setExistingHymns(hRes.data || []);
      if (!cRes.error) setCategories(cRes.data || []);
    } catch (err) {
      console.error('Failed to load database context:', err);
    }
  };

  // 1. EXPORT FULL JSON BACKUP
  const handleExportJson = async () => {
    setExporting(true);
    try {
      const [hymnsRes, catsRes] = await Promise.all([
        supabase.from('hymns').select('*').order('hymn_number', { ascending: true }),
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      ]);

      const backupObj = {
        database: 'Presbyterian Church of Ghana Hymnal',
        exportedAt: new Date().toISOString(),
        totalHymns: hymnsRes.data?.length || 0,
        totalCategories: catsRes.data?.length || 0,
        categories: catsRes.data || [],
        hymns: hymnsRes.data || [],
      };

      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PCG_Hymnal_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      Swal.fire({
        title: 'JSON Backup Downloaded!',
        text: `Exported ${backupObj.totalHymns} hymns and ${backupObj.totalCategories} categories.`,
        icon: 'success',
      });
    } catch (err) {
      Swal.fire('Export Failed', err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // 2. EXPORT EXCEL CATALOG (.xlsx)
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await loadSheetJS();
      const { data: hymns, error } = await supabase
        .from('hymns')
        .select('*')
        .order('hymn_number', { ascending: true });

      if (error) throw error;

      const catMap = {};
      categories.forEach((c) => {
        catMap[c.id] = c.name_en;
      });

      const formattedRows = hymns.map((h) => ({
        'Hymn Number': h.hymn_number,
        'English Title': h.title_en || '',
        'Twi Title': h.title_twi || '',
        'Category': catMap[h.category_id] || '',
        'Audio File / Path': h.audio_url || '',
        'Tonic Sol-fa PDF / Path': h.tonic_solfa || '',
        'Staff Notation PDF / Path': h.staff_notation || '',
        'Composer': h.composer || '',
        'Scripture Reference': h.scripture_reference || '',
        'Meter': h.meter || '',
        'Key Signature': h.key_signature || '',
        'English Lyrics': h.lyrics_en || '',
        'Twi Lyrics': h.lyrics_twi || '',
        'Is Published': h.is_published ? 'TRUE' : 'FALSE',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(formattedRows);

      ws['!cols'] = [
        { wch: 14 },
        { wch: 32 },
        { wch: 32 },
        { wch: 24 },
        { wch: 36 },
        { wch: 32 },
        { wch: 32 },
        { wch: 25 },
        { wch: 22 },
        { wch: 16 },
        { wch: 15 },
        { wch: 55 },
        { wch: 55 },
        { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'PCG_Hymns_Catalog');

      // Add Categories reference sheet
      if (categories.length > 0) {
        const catRows = categories.map((c, i) => ({
          '#': i + 1,
          'Category Name (English)': c.name_en,
          'Category Name (Twi)': c.name_twi || '',
          'Category ID': c.id,
        }));
        const catWs = XLSX.utils.json_to_sheet(catRows);
        catWs['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 38 }];
        XLSX.utils.book_append_sheet(wb, catWs, 'Categories');
      }

      XLSX.writeFile(wb, `PCG_Hymns_Catalog_${new Date().toISOString().slice(0, 10)}.xlsx`);

      Swal.fire({
        title: 'Excel Spreadsheet Exported!',
        text: `Exported ${hymns.length} hymn records into Excel (.xlsx).`,
        icon: 'success',
      });
    } catch (err) {
      console.error(err);
      Swal.fire('Export Failed', err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // 3. EXPORT CSV SPREADSHEET (.csv)
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { data: hymns, error } = await supabase
        .from('hymns')
        .select('*')
        .order('hymn_number', { ascending: true });

      if (error) throw error;

      const catMap = {};
      categories.forEach((c) => {
        catMap[c.id] = c.name_en;
      });

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

      const csvRows = [headers.map((h) => `"${h}"`).join(',')];

      hymns.forEach((h) => {
        const values = [
          h.hymn_number,
          h.title_en || '',
          h.title_twi || '',
          catMap[h.category_id] || '',
          h.audio_url || '',
          h.tonic_solfa || '',
          h.staff_notation || '',
          h.composer || '',
          h.scripture_reference || '',
          h.meter || '',
          h.key_signature || '',
          h.lyrics_en || '',
          h.lyrics_twi || '',
          h.is_published ? 'TRUE' : 'FALSE',
        ].map((val) => {
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        });
        csvRows.push(values.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PCG_Hymns_Catalog_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      Swal.fire('CSV Exported!', `Exported ${hymns.length} hymn records into CSV spreadsheet.`, 'success');
    } catch (err) {
      Swal.fire('Export Failed', err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // 4. PARSE EXCEL / CSV / JSON FILE
  const handleProcessFile = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      const result = await parseSpreadsheetFile(file, categories, existingHymns);
      setImportRecords(result.records);
      setFileMeta({
        name: result.fileName,
        size: result.fileSize,
        format: result.format,
        sheetName: result.sheetName,
      });
      setFilterView('all');
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Parsing Failed',
        text: err.message || 'Could not parse spreadsheet file.',
        confirmButtonColor: 'var(--pcg-blue, #18227c)',
      });
    } finally {
      setParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  // 5. COMMIT IMPORT TO DATABASE
  const handleCommitImport = async () => {
    const validRecords = importRecords.filter((r) => r.isValid);
    if (validRecords.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Valid Records',
        text: 'None of the parsed records have required fields (Hymn Number, English Title, English Lyrics).',
      });
      return;
    }

    const recordsToImport =
      importMode === 'skip_existing'
        ? validRecords.filter((r) => !r.isExisting)
        : validRecords;

    if (recordsToImport.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Nothing to Import',
        text: 'All valid records already exist in the database and conflict mode is set to "Skip Existing".',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: `Import ${recordsToImport.length} Hymns?`,
      html: `You are about to commit <b>${recordsToImport.length}</b> hymn records into the database.<br/><br/>
      <small style="color: #64748b;">Mode: <b>${
        importMode === 'upsert' ? 'Update Existing & Add New' : 'Insert New Only (Skip Existing)'
      }</b></small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Commit Records',
      cancelButtonText: 'Cancel',
      confirmButtonColor: 'var(--pcg-blue, #18227c)',
    });

    if (!confirm.isConfirmed) return;

    setImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let updateCount = 0;
    let insertCount = 0;
    let failCount = 0;

    const BATCH_SIZE = 25;
    const totalBatches = Math.ceil(recordsToImport.length / BATCH_SIZE);

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batch = recordsToImport.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const payloads = batch.map((r) => ({
          hymn_number: r.hymn_number,
          title_en: r.title_en.trim(),
          title_twi: r.title_twi ? r.title_twi.trim() : null,
          lyrics_en: r.lyrics_en.trim(),
          lyrics_twi: r.lyrics_twi ? r.lyrics_twi.trim() : null,
          composer: r.composer ? r.composer.trim() : null,
          scripture_reference: r.scripture_reference ? r.scripture_reference.trim() : null,
          meter: r.meter ? r.meter.trim() : null,
          key_signature: r.key_signature ? r.key_signature.trim() : null,
          tonic_solfa: r.tonic_solfa ? r.tonic_solfa.trim() : null,
          staff_notation: r.staff_notation ? r.staff_notation.trim() : null,
          audio_url: r.audio_url || null,
          category_id: r.category_id || null,
          is_published: r.is_published,
          updated_at: new Date().toISOString(),
        }));

        let { error } = await supabase
          .from('hymns')
          .upsert(payloads, { onConflict: 'hymn_number' });

        // If staff_notation column is missing in schema, retry without it
        if (error && (error.code === '42703' || String(error.message).includes('staff_notation'))) {
          const fallbackPayloads = payloads.map((p) => {
            const { staff_notation, ...rest } = p;
            return rest;
          });
          const retryRes = await supabase
            .from('hymns')
            .upsert(fallbackPayloads, { onConflict: 'hymn_number' });
          error = retryRes.error;
        }

        if (error) {
          console.error('Batch upsert error, attempting row-by-row:', error);
          for (const row of payloads) {
            let rowPayload = { ...row };
            let { error: singleErr } = await supabase
              .from('hymns')
              .upsert(rowPayload, { onConflict: 'hymn_number' });

            if (singleErr && (singleErr.code === '42703' || String(singleErr.message).includes('staff_notation'))) {
              delete rowPayload.staff_notation;
              const res2 = await supabase
                .from('hymns')
                .upsert(rowPayload, { onConflict: 'hymn_number' });
              singleErr = res2.error;
            }

            if (!singleErr) {
              successCount++;
              const original = batch.find((r) => r.hymn_number === row.hymn_number);
              if (original?.isExisting) {
                updateCount++;
              } else {
                insertCount++;
              }

              if (original?.tracks) {
                localStorage.setItem(`pcg_hymn_tracks_${original.hymn_number}`, JSON.stringify(original.tracks));
              }
            } else {
              failCount++;
            }
          }
        } else {
          successCount += batch.length;
          for (const item of batch) {
            if (item.isExisting) {
              updateCount++;
            } else {
              insertCount++;
            }

            if (item.tracks) {
              localStorage.setItem(`pcg_hymn_tracks_${item.hymn_number}`, JSON.stringify(item.tracks));
            }
          }
        }

        setImportProgress(Math.round(((b + 1) / totalBatches) * 100));
      }

      Swal.fire({
        icon: 'success',
        title: 'Import Successful!',
        html: `Processed <b>${successCount}</b> hymns into the database.<br/>
        <ul style="text-align: left; display: inline-block; margin-top: 8px; font-size: 13px;">
          <li><b>${insertCount}</b> new hymns created</li>
          <li><b>${updateCount}</b> existing hymns updated</li>
          ${failCount > 0 ? `<li style="color: red;"><b>${failCount}</b> failed</li>` : ''}
        </ul>
        <div style="margin-top: 12px; font-size: 12px; color: #475569; background: #f1f5f9; padding: 8px; border-radius: 6px;">
          Reminder: The Super Admin can now upload the matching <code>.mp3</code> and <code>.pdf</code> files directly into the Supabase <b>audio</b> bucket.
        </div>`,
        confirmButtonColor: 'var(--pcg-blue, #18227c)',
      });

      setImportRecords([]);
      setFileMeta(null);
      loadDatabaseContext();
    } catch (err) {
      console.error(err);
      Swal.fire('Import Error', err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const validCount = importRecords.filter((r) => r.isValid).length;
  const existingCount = importRecords.filter((r) => r.isExisting).length;
  const newCount = importRecords.filter((r) => r.isValid && !r.isExisting).length;
  const errorCount = importRecords.filter((r) => !r.isValid).length;

  const filteredRecords = importRecords.filter((r) => {
    if (filterView === 'valid') return r.isValid;
    if (filterView === 'existing') return r.isExisting;
    if (filterView === 'errors') return !r.isValid;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Database Backup & Bulk Import / Export</h1>
          <p>Import and export the Presbyterian hymnal catalog in Excel (.xlsx), CSV, and JSON formats</p>
        </div>

        <button className="btn btn-secondary" onClick={loadDatabaseContext}>
          <RefreshIcon /> Refresh Catalog
        </button>
      </div>

      {/* Export & Templates Grid */}
      <div className="dashboard-stats-grid" style={{ marginBottom: 28 }}>
        {/* Excel Export Tile */}
        <div className="stat-card-modern stat-card-green">
          <div className="stat-icon-wrapper stat-icon-green">
            <ExcelIcon />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
              Excel Spreadsheet (.xlsx)
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Formatted workbook containing all {existingHymns.length} hymns and category sheets.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportExcel}
                disabled={exporting}
              >
                <DownloadCloudIcon /> Export Excel Catalog
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => downloadHymnTemplate('xlsx', categories)}
              >
                <SparkleIcon /> Excel Template
              </button>
            </div>
          </div>
        </div>

        {/* CSV Export Tile */}
        <div className="stat-card-modern stat-card-gold">
          <div className="stat-icon-wrapper stat-icon-gold">
            <UploadCloudIcon />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
              CSV Spreadsheet (.csv)
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Standard comma-separated format compatible with Google Sheets & Numbers.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportCsv}
                disabled={exporting}
              >
                <DownloadCloudIcon /> Export CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => downloadHymnTemplate('csv', categories)}
              >
                <SparkleIcon /> CSV Template
              </button>
            </div>
          </div>
        </div>

        {/* JSON Full Database Backup */}
        <div className="stat-card-modern stat-card-blue">
          <div className="stat-icon-wrapper stat-icon-blue">
            <JsonIcon />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
              Full JSON Database Archive
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Full database snapshot of hymns, categories, and lyrics for backup or migration.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={handleExportJson}
              disabled={exporting}
            >
              <DownloadCloudIcon /> Export JSON Backup
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Importer Section */}
      <div className="card-container">
        <div className="card-header-row">
          <div>
            <h3>Excel (.xlsx, .xls) & CSV Hymn Importer</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
              Automatic column detection, media path resolution, category resolution, multi-line lyrics parsing, and safety conflict handling
            </p>
          </div>
          <span className="badge badge-blue">Auto-Mapping Enabled</span>
        </div>

        {importRecords.length === 0 ? (
          <div
            className="dropzone-container"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              borderColor: isDragging ? 'var(--pcg-blue, #18227c)' : undefined,
              background: isDragging ? 'var(--pcg-blue-subtle, #f0f4ff)' : undefined,
              cursor: 'pointer',
              padding: '44px 20px',
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <UploadCloudIcon size={48} style={{ color: 'var(--pcg-blue)', marginBottom: 10 }} />
            <h4 style={{ fontSize: 17, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
              {parsing ? 'Reading & Validating Spreadsheet...' : 'Choose or Drag & Drop Excel or CSV File to Import'}
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 540 }}>
              Upload Microsoft Excel workbooks (<b>.xlsx</b>, <b>.xls</b>), CSV files (<b>.csv</b>), or JSON archives.
              Multi-line stanzas and Akan Twi characters are automatically supported.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <span className="badge badge-blue">Excel (.xlsx, .xls)</span>
              <span className="badge badge-green">CSV Spreadsheets</span>
              <span className="badge badge-gold">Auto Category Lookup</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* File Info & Options Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'var(--pcg-blue-subtle, #f0f4ff)',
                border: '1px solid #c7d2fe',
                borderRadius: 'var(--radius-md, 8px)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--pcg-blue-dark)' }}>
                    {fileMeta?.name}
                  </span>
                  <span className="badge badge-blue">{fileMeta?.format}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({fileMeta?.size})</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Parsed <b>{importRecords.length}</b> total rows • <b>{validCount}</b> ready to import
                </div>
              </div>

              {/* Conflict Options & Discard */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Conflict Mode:
                  </label>
                  <select
                    className="filter-select"
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value)}
                    style={{ minWidth: 180, fontSize: 12.5 }}
                  >
                    <option value="upsert">Update Existing & Add New</option>
                    <option value="skip_existing">Skip Existing Hymns</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setImportRecords([]);
                    setFileMeta(null);
                  }}
                  disabled={importing}
                >
                  <CloseIcon size={14} /> Discard & Choose Another
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleCommitImport}
                  disabled={importing || validCount === 0}
                >
                  <SingleCheckIcon />
                  {importing ? `Importing (${importProgress}%)...` : `Commit ${validCount} Hymns`}
                </button>
              </div>
            </div>

            {/* Stats Pills & Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`filter-pill ${filterView === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterView('all')}
                >
                  All ({importRecords.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterView === 'valid' ? 'active' : ''}`}
                  onClick={() => setFilterView('valid')}
                >
                  ✓ Valid ({validCount})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterView === 'existing' ? 'active' : ''}`}
                  onClick={() => setFilterView('existing')}
                >
                  ↺ Existing Updates ({existingCount})
                </button>
                {errorCount > 0 && (
                  <button
                    type="button"
                    className={`filter-pill ${filterView === 'errors' ? 'active' : ''}`}
                    onClick={() => setFilterView('errors')}
                    style={{ color: 'var(--danger, #dc2626)', borderColor: '#fecaca' }}
                  >
                    ⚠ Errors ({errorCount})
                  </button>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {newCount} new hymns to insert • {existingCount} existing hymns to update
              </div>
            </div>

            {/* Progress Bar (During commit) */}
            {importing && (
              <div style={{ width: '100%', background: '#e2e8f0', borderRadius: 6, overflow: 'hidden', height: 10 }}>
                <div
                  style={{
                    width: `${importProgress}%`,
                    background: 'var(--pcg-blue, #18227c)',
                    height: '100%',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}

            {/* Import Preview Table */}
            <div className="table-container" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th style={{ width: 75 }}>#</th>
                    <th>English Title</th>
                    <th>Audio File / Path</th>
                    <th>Tonic Sol-fa PDF</th>
                    <th>Staff Notation PDF</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, idx) => (
                    <tr key={idx} style={{ opacity: r.isValid ? 1 : 0.65 }}>
                      <td>
                        {r.hymn_number ? (
                          <span className="hymn-number-badge">#{r.hymn_number}</span>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {r.title_en || <span style={{ color: 'var(--danger)' }}>[Missing Title]</span>}
                        </div>
                        {r.title_twi && (
                          <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic' }}>
                            {r.title_twi}
                          </div>
                        )}
                        {r.lyrics_en && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {r.lyrics_en.slice(0, 50)}...
                          </div>
                        )}
                      </td>
                      <td>
                        {r.audio_filename ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                            <AudioIcon size={14} style={{ color: 'var(--pcg-blue)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }} title={r.audio_url}>
                              {r.audio_filename}
                            </span>
                            {r.tracks?.length > 1 && (
                              <span className="badge badge-gray" style={{ fontSize: 10 }}>
                                +{r.tracks.length - 1} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        {r.solfa_pdf_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                            <SolfaIcon size={14} style={{ color: 'var(--pcg-blue)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }} title={r.solfa_pdf_url}>
                              {r.solfa_pdf_name}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        {r.staff_pdf_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                            <MusicIcon size={14} style={{ color: 'var(--pcg-blue)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }} title={r.staff_pdf_url}>
                              {r.staff_pdf_name}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        {r.category_name ? (
                          <span className="badge badge-blue">{r.category_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>Default</span>
                        )}
                      </td>
                      <td>
                        {r.isValid ? (
                          r.isExisting ? (
                            <span className="badge badge-gold" title="Hymn exists in database and will be updated">
                              ↺ Update #{r.hymn_number}
                            </span>
                          ) : (
                            <span className="badge badge-green" title="New hymn to insert">
                              + New Hymn
                            </span>
                          )
                        ) : (
                          <span className="badge badge-gray" style={{ color: 'var(--danger)', borderColor: '#fecaca' }}>
                            ⚠ {r.errors[0] || 'Invalid'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExportPage;
