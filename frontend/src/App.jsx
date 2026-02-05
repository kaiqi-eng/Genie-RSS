import { useState } from 'react';
import UrlInput from './components/UrlInput';
import FeedDisplay from './components/FeedDisplay';
import { fetchRssFeed } from './services/api';
import './App.css';

function App() {
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedSource, setFeedSource] = useState(null);
  const [rssXml, setRssXml] = useState(null);

  const handleFetchFeed = async (url) => {
    setLoading(true);
    setError(null);
    setFeed(null);
    setRssXml(null);

    try {
      const result = await fetchRssFeed(url);
      setFeed(result.feed);
      setFeedSource(result.source);
      if (result.rssXml) {
        setRssXml(result.rssXml);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="logo">
            <span className="logo-icon">📡</span>
            Genie RSS
          </h1>
          <p className="tagline">Retrieve or generate RSS feeds from any website</p>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <UrlInput onSubmit={handleFetchFeed} loading={loading} />

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Fetching feed...</p>
            </div>
          )}

          {feed && (
            <FeedDisplay 
              feed={feed} 
              source={feedSource} 
              rssXml={rssXml}
            />
          )}
        </div>
      </main>

      <footer className="footer">
        <p>Genie RSS - Auto-discover or generate RSS feeds</p>
      </footer>
    </div>
  );
}

export default App;
