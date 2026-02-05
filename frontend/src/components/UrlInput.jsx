import { useState } from 'react';
import './UrlInput.css';

function UrlInput({ onSubmit, loading }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      // Add https:// if no protocol specified
      let processedUrl = url.trim();
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        processedUrl = 'https://' + processedUrl;
      }
      onSubmit(processedUrl);
    }
  };

  return (
    <form className="url-input-form" onSubmit={handleSubmit}>
      <div className="input-wrapper">
        <span className="input-icon">🔗</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter website URL (e.g., techcrunch.com)"
          className="url-input"
          disabled={loading}
        />
      </div>
      <button 
        type="submit" 
        className="submit-button"
        disabled={loading || !url.trim()}
      >
        {loading ? 'Fetching...' : 'Get RSS Feed'}
      </button>
    </form>
  );
}

export default UrlInput;
