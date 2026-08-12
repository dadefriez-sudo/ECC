import { useNavigate } from 'react-router-dom';
import { Brand } from './Logo.jsx';

// Shared shell for the two legal pages (Privacy Policy, Terms of Service).
// Deliberately outside the Settings accordion — a store reviewer or a
// curious user needs to land here directly, not hunt through a collapsed
// card, so it's a real top-level route with its own back button.
export default function LegalPage({ title, updated, children }) {
  const navigate = useNavigate();
  return (
    <div className="page legal-page">
      <header className="page-head">
        <div className="page-head-row">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ‹ Back
          </button>
          <Brand>{title}</Brand>
        </div>
      </header>
      <p className="legal-updated">Last updated {updated}</p>
      <div className="legal-body">{children}</div>
    </div>
  );
}
