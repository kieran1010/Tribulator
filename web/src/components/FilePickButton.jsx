import { useRef, useState } from 'react';
import { ACCEPTED_FILE_TYPES, checkFileSelection } from '../lib/fileSource';

// A button that opens the device's file picker for a PDF or images, and only
// hands on a selection the import can actually use.
export default function FilePickButton({ label, className = 'btn btn-outline', style, onFiles }) {
  const input = useRef(null);
  const [error, setError] = useState(null);

  const handleChange = e => {
    const files = [...(e.target.files || [])];
    // Cleared so picking the same file again still fires a change.
    e.target.value = '';
    if (files.length === 0) return;
    const problem = checkFileSelection(files);
    setError(problem);
    if (!problem) onFiles(files);
  };

  return (
    <>
      <button type="button" className={className} style={style} onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        hidden
        onChange={handleChange}
      />
      {error && <p className="error-text" style={{ marginTop: 6 }}>{error}</p>}
    </>
  );
}
