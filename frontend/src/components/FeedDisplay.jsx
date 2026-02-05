import { useState } from 'react';
import './FeedDisplay.css';

function FeedDisplay({ feed, source, rssXml }) {
  const [showXml, setShowXml] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="feed-display">
      <div className="feed-header">
        <div className="feed-info">
          <h2 className="feed-title">{feed.title}</h2>
          {feed.description && (
            <p className="feed-description">{feed.description}</p>
          )}
          <div className="feed-meta">
            <span className={`source-badge ${source}`}>
              {source === 'discovered' ? '✓ RSS Found' : '⚡ Generated'}
            </span>
            {feed.link && (
              <a 
                href={feed.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="feed-link"
              >
                {feed.link}
              </a>
            )}
          </div>
        </div>
        {rssXml && (
          <button 
            className="xml-toggle"
            onClick={() => setShowXml(!showXml)}
          >
            {showXml ? 'Hide XML' : 'View XML'}
          </button>
        )}
      </div>

      {showXml && rssXml && (
        <div className="xml-preview">
          <div className="xml-header">
            <span>RSS XML Output</span>
            <button 
              className="copy-button"
              onClick={() => {
                navigator.clipboard.writeText(rssXml);
              }}
            >
              Copy
            </button>
          </div>
          <pre className="xml-content">{rssXml}</pre>
        </div>
      )}

      <div className="feed-items">
        <h3 className="items-header">
          Feed Items ({feed.items?.length || 0})
        </h3>
        
        {feed.items && feed.items.length > 0 ? (
          <ul className="items-list">
            {feed.items.map((item, index) => (
              <li key={item.guid || index} className="feed-item">
                <div className="item-content">
                  {item.thumbnail && (
                    <img 
                      src={item.thumbnail} 
                      alt="" 
                      className="item-thumbnail"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <div className="item-details">
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="item-title"
                    >
                      {item.title}
                    </a>
                    {item.contentSnippet && (
                      <p className="item-snippet">{item.contentSnippet}</p>
                    )}
                    <div className="item-meta">
                      {item.pubDate && (
                        <span className="item-date">{formatDate(item.pubDate)}</span>
                      )}
                      {item.creator && (
                        <span className="item-author">by {item.creator}</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-items">No items found in the feed.</p>
        )}
      </div>
    </div>
  );
}

export default FeedDisplay;
