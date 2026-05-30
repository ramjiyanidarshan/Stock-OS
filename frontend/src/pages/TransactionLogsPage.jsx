import React, { useEffect, useState } from 'react';
import { getLogs } from '../services/api';
import { Activity, Filter, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_COLOR = {
    'USER:CREATE': '#3fb950',
    'USER:UPDATE': '#388bfd',
    'USER:DELETE': '#f85149',
    'INVENTORY:IN': '#3fb950',
    'INVENTORY:OUT': '#f85149',
    'INVENTORY:ADJUST': '#d29922',
    'INVENTORY:TRANSFER': '#39d3f2',
};

export default function TransactionLogsPage() {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [eventFilter, setEventFilter] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await getLogs();
            const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            setLogs(data);
            filterLogs(data, eventFilter, userFilter);
            toast.success('Logs loaded successfully');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load logs');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filterLogs = (data, event, user) => {
        let filtered = data;
        if (event) {
            filtered = filtered.filter(log => log.event?.includes(event));
        }
        if (user) {
            filtered = filtered.filter(log => log.user_name?.toLowerCase().includes(user.toLowerCase()));
        }
        setFilteredLogs(filtered);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleEventFilterChange = (e) => {
        const value = e.target.value;
        setEventFilter(value);
        filterLogs(logs, value, userFilter);
    };

    const handleUserFilterChange = (e) => {
        const value = e.target.value;
        setUserFilter(value);
        filterLogs(logs, eventFilter, value);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString();
        } catch {
            return dateStr;
        }
    };

    const parseJSON = (str) => {
        if (!str) return null;
        try {
            return typeof str === 'string' ? JSON.parse(str) : str;
        } catch {
            return null;
        }
    };

    const toPrettyJSON = (value) => {
        if (value === undefined || value === null) return '';
        try {
            return typeof value === 'string' ? JSON.stringify(JSON.parse(value), null, 2) : JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    };

    const createLineDiff = (beforeText, afterText) => {
        const beforeLines = beforeText.split(/\r?\n/);
        const afterLines = afterText.split(/\r?\n/);
        const n = beforeLines.length;
        const m = afterLines.length;
        const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

        for (let i = n - 1; i >= 0; i -= 1) {
            for (let j = m - 1; j >= 0; j -= 1) {
                if (beforeLines[i] === afterLines[j]) {
                    dp[i][j] = dp[i + 1][j + 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }

        const diff = [];
        let i = 0;
        let j = 0;

        while (i < n || j < m) {
            if (i < n && j < m && beforeLines[i] === afterLines[j]) {
                diff.push({ type: 'equal', text: beforeLines[i] });
                i += 1;
                j += 1;
            } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
                diff.push({ type: 'added', text: afterLines[j] });
                j += 1;
            } else if (i < n) {
                diff.push({ type: 'removed', text: beforeLines[i] });
                i += 1;
            }
        }

        return diff;
    };

    const generateDiff = (before, after) => {
        const beforeObj = parseJSON(before);
        const afterObj = parseJSON(after);
        const beforeText = beforeObj ? JSON.stringify(beforeObj, null, 2) : '';
        const afterText = afterObj ? JSON.stringify(afterObj, null, 2) : '';

        if (!beforeText && !afterText) return [];
        if (!beforeText) {
            return afterText.split(/\r?\n/).map(line => ({ type: 'added', text: line }));
        }
        if (!afterText) {
            return beforeText.split(/\r?\n/).map(line => ({ type: 'removed', text: line }));
        }

        return createLineDiff(beforeText, afterText);
    };

    const downloadLogs = () => {
        const csv = [
            ['Timestamp', 'User', 'Event', 'Request ID', 'Session ID'],
            ...filteredLogs.map(log => [
                formatDate(log.created_at) || '',
                log.user_name || '',
                log.event || '',
                log.request_id || '',
                log.session_id || '',
            ]),
        ]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transaction-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Logs downloaded');
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <div className="page-title">
                        <Activity size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Transaction Logs
                    </div>
                    <div className="page-subtitle">View all system transactions and audit trail</div>
                </div>
                <button className="btn btn-primary" onClick={downloadLogs} disabled={filteredLogs.length === 0}>
                    <Download size={15} /> Export
                </button>
            </div>

            <div className="page-body">
                {/* Filters */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 6 }}>
                            <Filter size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            Filter by Event
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g., USER:CREATE, INVENTORY:OUT"
                            value={eventFilter}
                            onChange={handleEventFilterChange}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 6 }}>
                            Filter by User
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search by user name"
                            value={userFilter}
                            onChange={handleUserFilterChange}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                        <button className="btn btn-ghost" onClick={() => { setEventFilter(''); setUserFilter(''); filterLogs(logs, '', ''); }}>
                            Clear Filters
                        </button>
                        <button className="btn btn-primary" onClick={fetchLogs} disabled={loading}>
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="card">
                    <div className="table-wrapper">
                        {filteredLogs.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Activity size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                                <p>{loading ? 'Loading logs...' : 'No transaction logs found'}</p>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '20%' }}>Timestamp</th>
                                        <th style={{ width: '15%' }}>User</th>
                                        <th style={{ width: '15%' }}>Event</th>
                                        <th style={{ width: '15%' }}>Request ID</th>
                                        <th style={{ width: '15%' }}>Session ID</th>
                                        <th style={{ width: '20%' }}>Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                {formatDate(log.created_at)}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{log.user_name || 'System'}</div>
                                            </td>
                                            <td>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: EVENT_COLOR[log.event] ? `${EVENT_COLOR[log.event]}20` : 'var(--bg-elevated)',
                                                        color: EVENT_COLOR[log.event] || 'var(--text-secondary)',
                                                        fontSize: 11,
                                                        fontFamily: "'Space Mono', monospace",
                                                    }}
                                                >
                                                    {log.event}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--text-muted)' }}>
                                                {log.request_id ? log.request_id.substring(0, 8) + '...' : '—'}
                                            </td>
                                            <td style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: 'var(--text-muted)' }}>
                                                {log.session_id ? log.session_id.substring(0, 8) + '...' : '—'}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => setSelectedLog(log)}
                                                    style={{ color: 'var(--accent-blue)' }}
                                                >
                                                    View Diff
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Summary */}
                <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                    <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Logs</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-blue)' }}>{logs.length}</div>
                    </div>
                    <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Displayed</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-cyan)' }}>{filteredLogs.length}</div>
                    </div>
                    <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Unique Users</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>
                            {new Set(logs.map(l => l.user_name)).size}
                        </div>
                    </div>
                </div>
            </div>

            {selectedLog && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 760, width: '100%', maxHeight: '85vh' }}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">Transaction Diff</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {selectedLog.event} by {selectedLog.user_name || 'System'} on {formatDate(selectedLog.created_at)}
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedLog(null)}><span style={{ fontSize: 18 }}>×</span></button>
                        </div>
                        <div className="modal-body" style={{ padding: 20 }}>
                            <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Request ID: {selectedLog.request_id || '—'}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Session ID: {selectedLog.session_id || '—'}</div>
                            </div>
                            {generateDiff(selectedLog.data_before, selectedLog.data_after).length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>No changes to display.</div>
                            ) : (
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '60vh', overflowY: 'auto', padding: '12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                                        --- before
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                                        +++ after
                                    </div>
                                    {generateDiff(selectedLog.data_before, selectedLog.data_after).map((line, i) => {
                                        const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
                                        const color = line.type === 'added'
                                            ? 'var(--accent-green)'
                                            : line.type === 'removed'
                                                ? 'var(--accent-red)'
                                                : 'var(--text-primary)';
                                        const background = line.type === 'added'
                                            ? 'rgba(63, 185, 80, 0.08)'
                                            : line.type === 'removed'
                                                ? 'rgba(248, 81, 73, 0.08)'
                                                : 'transparent';
                                        return (
                                            <div key={i} style={{ color, background, padding: '0 4px' }}>
                                                {prefix}{line.text}
                                            </div>
                                        );
                                    })}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
