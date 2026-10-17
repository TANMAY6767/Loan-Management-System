
import { useState } from 'react';
import {
  ArrowRight,
  CircleHelp,
  CloudUpload,
  FileText,
} from 'lucide-react';

import { importAccounts } from '../services/accountService.js';

const MAX_FILE_SIZE_MB = 20;

const CSV_COLUMNS = [
  'loan_no, customer_name, mobile',
  'office, outstanding, product',
  'original_amount, portfolio, seller_bank',
  'email, city, state, language',
  'npa_date, last_payment_date, status',
];

const SUPPORTED_OFFICES = [
  'Jogeshwari',
  'Dadar',
  'Bangalore',
];

function PageHeading() {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">PORTFOLIO SETUP</div>
        <h1>Import account data</h1>
        <p>
          Add accounts to the recovery workspace from a CSV file.
        </p>
      </div>
    </div>
  );
}

function ImportPanelHeading() {
  return (
    <div className="panel-heading">
      <div>
        <h3>Upload a CSV</h3>
        <p>Import up to 100,000 account rows at a time.</p>
      </div>

      <div className="upload-file-icon">
        <FileText size={20} />
      </div>
    </div>
  );
}

function FileDropzone({
  file,
  setFile,
  dragging,
  setDragging,
}) {
  function handleDragOver(event) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    setFile(event.dataTransfer.files?.[0] || null);
  }

  function handleFileChange(event) {
    setFile(event.target.files?.[0] || null);
  }

  return (
    <label
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
      />

      <div className="upload-circle">
        <CloudUpload size={23} />
      </div>

      <strong>
        {file ? file.name : 'Drop your CSV here'}
      </strong>

      <span>
        {file ? (
          `${(file.size / 1024 / 1024).toFixed(2)} MB · ready to import`
        ) : (
          <>
            or <em>browse files</em> from your computer
          </>
        )}
      </span>

      <small>
        CSV files only · maximum size {MAX_FILE_SIZE_MB} MB
      </small>
    </label>
  );
}

function ImportActions({ file, busy }) {
  return (
    <div className="import-foot">
      <span>
        <CircleHelp size={15} />
        Existing loan numbers are skipped automatically.
      </span>

      <button
        className="primary-button"
        type="submit"
        disabled={!file || busy}
      >
        {busy ? 'Importing…' : 'Import accounts'}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

function CsvUploadPanel({
  file,
  setFile,
  dragging,
  setDragging,
  busy,
  onSubmit,
}) {
  return (
    <section className="panel import-panel">
      <ImportPanelHeading />

      <form onSubmit={onSubmit}>
        <FileDropzone
          file={file}
          setFile={setFile}
          dragging={dragging}
          setDragging={setDragging}
        />

        <ImportActions file={file} busy={busy} />
      </form>
    </section>
  );
}

function CsvFormatPanel() {
  return (
    <section className="panel format-panel">
      <div className="format-icon">
        <FileText size={17} />
      </div>

      <h3>CSV format</h3>

      <p>
        Your header row should use these column names.
        Dates should be in YYYY-MM-DD format.
      </p>

      <div className="code-preview">
        {CSV_COLUMNS.map((row) => (
          <div key={row}>{row}</div>
        ))}
      </div>

      <div className="supported-offices">
        <strong>Supported offices</strong>

        {SUPPORTED_OFFICES.map((office) => (
          <span key={office}>{office}</span>
        ))}
      </div>
    </section>
  );
}

export default function ImportPage({ onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file || busy) {
      return;
    }

    setBusy(true);

    try {
      const result = await importAccounts(file);

      onDone(
        `${result.imported.toLocaleString('en-IN')} accounts imported · ${result.skipped} skipped.`
      );
    } catch (error) {
      onDone(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading />

      <div className="import-layout">
        <CsvUploadPanel
          file={file}
          setFile={setFile}
          dragging={dragging}
          setDragging={setDragging}
          busy={busy}
          onSubmit={handleSubmit}
        />

        <CsvFormatPanel />
      </div>
    </>
  );
}

