import { useState } from 'react';
import SourceImportView from '../components/SourceImportView';
import FilePickButton from '../components/FilePickButton';
import { getPendingImport, setPendingImport } from '../lib/fileSource';

export default function ImportFileScreen() {
  // Picked on the search screen; gone after a reload, when the user is asked
  // to choose again.
  const [files, setFiles] = useState(() => getPendingImport());

  const choose = picked => {
    setPendingImport(picked);
    setFiles(picked);
  };

  if (!files) {
    return (
      <div className="empty-state">
        <p>Choose a PDF, or photos or screenshots of a document, to import.</p>
        <FilePickButton label="Choose file" className="btn btn-primary" style={{ marginTop: 12 }} onFiles={choose} />
      </div>
    );
  }

  return (
    <div>
      <div className="interpret-bar">
        <p className="interpret-text">Importing a file</p>
        <FilePickButton label="Choose a different file" className="btn btn-ghost" onFiles={choose} />
      </div>
      {/* Keyed so a new choice starts a fresh import rather than reusing state. */}
      <SourceImportView key={files.map(f => `${f.name}:${f.size}:${f.lastModified}`).join('|')} files={files} />
    </div>
  );
}
