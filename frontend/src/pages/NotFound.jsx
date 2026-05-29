import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="notfound-shell">
      <div className="notfound-card">
        <div className="notfound-hero">
          <AlertTriangle size={56} />
        </div>
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-copy">
          The page you are looking for doesn’t exist or may have been moved.
          Let’s get you back to the home and keep your workflow running.
        </p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
