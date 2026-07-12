export default function Header({ language, onLanguageChange, onNewChat }) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">🚗</span>
        <div>
          <div className="header-title">KeretaAI</div>
          <div className="header-tagline">Buy & sell second-hand cars, Malaysia-wide</div>
        </div>
      </div>
      <div className="header-actions">
        <select
          className="lang-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          aria-label="Language"
        >
          <option value="en">EN</option>
          <option value="ms">BM</option>
          <option value="zh">中文</option>
        </select>
        <button className="btn-secondary" onClick={onNewChat}>+ New chat</button>
      </div>
    </header>
  );
}
