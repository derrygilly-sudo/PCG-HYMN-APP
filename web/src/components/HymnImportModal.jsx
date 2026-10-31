// src/components/HymnImportModal.jsx
import React, { useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import Swal from 'sweetalert2';
import {
  parseSpreadsheetFile,
  downloadHymnTemplate,
} from '../utils/excelParser';
import {
  UploadCloudIcon,
  DownloadCloudIcon,
  ExcelIcon,
  CloseIcon,
  SingleCheckIcon,
  SparkleIcon,
  AudioIcon,
  SolfaIcon,
  MusicIcon,
} from '../config/icons';

const HymnImportModal = ({ isOpen, onClose, onSuccess, categories = [], existingHymns = [] }) => {
  const [importRecords, setImportRecords] = useState([]);
  const [fileMeta, setFileMeta] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMode, setImportMode] = useState('upsert'); // 'upsert' | 'skip_existing'
  const [filterView, setFilterView] = useState('all'); // 'all' | 'valid' | 'existing' | 'errors'
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

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

  const handleReset = () => {
    setImportRecords([]);
    setFileMeta(null);
    setImportProgress(0);
  };

  const handleCommit = async () => {
    const validRecords = importRecords.filter((r) => r.isValid);
    if (validRecords.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Valid Records',
        text: 'None of the parsed records have the required fields (Hymn Number, English Title, English Lyrics).',
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
        text: 'All valid records already exist in the database and import mode is set to "Skip Existing".',
      });
      return;
    }

    const confirm = await Swal.fire({
      title: `Import ${recordsToImport.length} Hymns?`,
      html: `You are about to ${
        importMode === 'upsert' ? 'insert and update' : 'insert new'
      } <b>${recordsToImport.length}</b> hymn records into the database.<br/><br/>
      <small style="color: #64748b;">Media paths will be automatically linked to your Supabase Storage bucket.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Start Import',
      cancelButtonText: 'Review More',
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
          console.error('Batch error, trying row-by-row:', error);
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
              if (original?.isExisting) updateCount++;
              else insertCount++;

              // Save multi-track metadata locally
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
            if (item.isExisting) updateCount++;
            else insertCount++;

            // Save multi-track metadata locally
            if (item.tracks) {
              localStorage.setItem(`pcg_hymn_tracks_${item.hymn_number}`, JSON.stringify(item.tracks));
            }
          }
        }

        setImportProgress(Math.round(((b + 1) / totalBatches) * 100));
      }

      Swal.fire({
        icon: 'success',
        title: 'Import Completed!',
        html: `Successfully processed <b>${successCount}</b> hymns.<br/>
        <ul style="text-align: left; display: inline-block; margin-top: 8px; font-size: 13px;">
          <li><b>${insertCount}</b> newly created hymns</li>
          <li><b>${updateCount}</b> existing hymns updated</li>
          ${failCount > 0 ? `<li style="color: red;"><b>${failCount}</b> failed</li>` : ''}
        </ul>
        <div style="margin-top: 12px; font-size: 12px; color: #475569; background: #f1f5f9; padding: 8px; border-radius: 6px;">
          Reminder: The Super Admin can now upload the matching <code>.mp3</code> and <code>.pdf</code> files directly into the Supabase <b>audio</b> bucket.
        </div>`,
        confirmButtonColor: 'var(--pcg-blue, #18227c)',
      });

      if (onSuccess) onSuccess();
      handleReset();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire('Import Error', err.message || 'An unexpected error occurred during database import.', 'error');
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
    <div className="drawer-overlay" onClick={onClose} style={{ zIndex: 120 }}>
      <div
        className="drawer-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1040, width: '94%' }}
      >
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--pcg-blue-subtle, #f0f4ff)',
                color: 'var(--pcg-blue, #18227c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ExcelIcon size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
                Import Hymns from Excel / CSV
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Batch import hymns with automatic Audio, Tonic Sol-fa, and Staff Notation storage links
              </p>
            </div>
          </div>

          <button type="button" className="page-btn" onClick={onClose} style={{ border: 'none' }}>
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {importRecords.length === 0 ? (
            <>
              {/* How it works info banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--pcg-blue-subtle, #f0f4ff)',
                  border: '1px solid #c7d2fe',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 12.5,
                  color: 'var(--pcg-blue-dark)',
                }}
              >
                <SparkleIcon style={{ color: 'var(--pcg-blue)', flexShrink: 0 }} size={20} />
                <div>
                  <strong>Two-Step Bulk Media Workflow:</strong>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                    1) Enter filenames in the spreadsheet (e.g. <code>hymn_001.mp3</code>, <code>solfa_001.pdf</code>, <code>staff_001.pdf</code>) and import below.
                    2) The Super Admin uploads the actual files directly into the Supabase <b>audio</b> storage bucket.
                  </span>
                </div>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? '2.5px dashed var(--pcg-blue, #18227c)' : '2px dashed var(--border-color, #cbd5e1)',
                  background: isDragging ? 'var(--pcg-blue-subtle, #f0f4ff)' : '#fafcff',
                  borderRadius: 'var(--radius-lg, 12px)',
                  padding: '38px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'var(--pcg-blue-subtle, #eef2ff)',
                    color: 'var(--pcg-blue, #18227c)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UploadCloudIcon size={32} />
                </div>

                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
                    {parsing ? 'Parsing Spreadsheet Data...' : 'Choose or Drag & Drop Excel / CSV File'}
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Supports <b>.xlsx</b>, <b>.xls</b>, <b>.csv</b>, and <b>.json</b> datasets.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span className="badge badge-blue">Excel (.xlsx, .xls)</span>
                  <span className="badge badge-green">CSV Spreadsheet</span>
                  <span className="badge badge-gold">Auto Storage URL Linking</span>
                </div>
              </div>

              {/* Sample Templates Download Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: 'var(--bg-surface, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <SparkleIcon style={{ color: 'var(--pcg-gold, #c59b27)' }} size={20} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>
                      Download Pre-Formatted Template
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Includes pre-built columns for Audio, Sol-fa PDF, and Staff Notation PDF paths.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadHymnTemplate('xlsx', categories)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <DownloadCloudIcon size={14} /> Download Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadHymnTemplate('csv', categories)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <DownloadCloudIcon size={14} /> Download CSV (.csv)
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* File Summary & Import Options */}
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

                {/* Import Conflict Mode */}
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
                    onClick={handleReset}
                    disabled={importing}
                  >
                    Choose Another File
                  </button>
                </div>
              </div>

              {/* Stats & Filter Bar */}
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
                    Existing to Update ({existingCount})
                  </button>
                  {errorCount > 0 && (
                    <button
                      type="button"
                      className={`filter-pill ${filterView === 'errors' ? 'active' : ''}`}
                      onClick={() => setFilterView('errors')}
                      style={{ color: 'var(--danger, #dc2626)', borderColor: '#fecaca' }}
                    >
                      ⚠ Invalid ({errorCount})
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

              {/* Preview Table */}
              <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>English Title</th>
                      <th>Audio File / Path</th>
                      <th>Tonic Sol-fa PDF</th>
                      <th>Staff Notation PDF</th>
                      <th>Category</th>
                      <th>Status & Action</th>
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
                          <div style={{ fontWeight: 600 }}>{r.title_en || <span style={{ color: 'var(--danger)' }}>[Missing Title]</span>}</div>
                          {r.title_twi && (
                            <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic' }}>
                              {r.title_twi}
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
                              {r.tracks.length > 1 && (
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
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="drawer-footer">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {importRecords.length > 0 && `${validCount} of ${importRecords.length} records ready`}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={importing}>
              Cancel
            </button>
            {importRecords.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCommit}
                disabled={importing || validCount === 0}
              >
                <SingleCheckIcon />
                {importing ? `Importing (${importProgress}%)...` : `Import ${validCount} Hymns`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HymnImportModal;
