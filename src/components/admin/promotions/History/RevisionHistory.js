import React, { useEffect, useState, useCallback } from 'react';
import { usePopup } from "@/context/PopupContext";

export default function RevisionHistory({ promotionId, onRollback }) {
  const { showConfirm } = usePopup();
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/promotions/${promotionId}/revisions`);
      const data = await res.json();
      if (res.ok) setRevisions(data);
    } catch (err) {
      console.error("Failed to fetch revisions:", err);
    } finally {
      setLoading(false);
    }
  }, [promotionId]);

  useEffect(() => {
    if (promotionId) {
      Promise.resolve().then(() => {
        fetchRevisions();
      });
    }
  }, [promotionId, fetchRevisions]);

  const handleRestore = async (version) => {
    if (!(await showConfirm(`Are you sure you want to rollback to Version ${version}? Current unsaved changes will be lost.`, "Restore revision", { confirmText: "Restore" }))) return;
    try {
        const res = await fetch(`/api/admin/promotions/${promotionId}/revisions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version })
        });
        if (res.ok) {
            const updated = await res.json();
            onRollback(updated);
            fetchRevisions();
        }
    } catch (err) {
        console.error("Rollback failed:", err);
    }
  };

  return (
    <section className="wp-postbox" aria-labelledby="promo-revisions-title">
      <div className="wp-postbox-head">
        <h2 id="promo-revisions-title">Revision history</h2>
        {!loading && revisions.length > 0 && (
          <span className="wp-postbox-aside">{revisions.length} revision{revisions.length === 1 ? '' : 's'}</span>
        )}
      </div>

      <div className="wp-inside overflow-y-auto" style={{ maxHeight: 420 }}>
        {loading ? (
          <p className="wp-muted" style={{ margin: 0 }}>Loading history…</p>
        ) : revisions.length === 0 ? (
          <p className="wp-empty" style={{ margin: 0 }}>No historical records found.</p>
        ) : (
          <ul className="flex flex-col gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {revisions.map((rev, idx) => (
              <li key={rev._id}>
                <div className={`wp-note-body ${idx === 0 ? 'is-customer' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="wp-strong flex-1">
                      {idx === 0 ? `Current version (v${rev.version})` : `Version ${rev.version}`}
                    </span>
                  </div>
                  {rev.changeSummary && (
                    <p style={{ margin: '4px 0 0', wordBreak: 'break-word' }}>{rev.changeSummary}</p>
                  )}
                </div>
                <div className="wp-note-meta">
                  <span>{new Date(rev.createdAt).toLocaleString()}</span>
                  <span>by {rev.createdBy || 'System'}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => handleRestore(rev.version)}
                    className="wp-link min-h-6 max-[782px]:min-h-10"
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    aria-label={`Restore version ${rev.version}`}
                  >
                    Restore this version
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
