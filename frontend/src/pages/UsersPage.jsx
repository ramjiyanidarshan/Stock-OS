import React from 'react';
import { User } from 'lucide-react';

export default function UsersPage() {
    return (
        <div className="page-body">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <User size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Users Management
                    </h1>
                    <p className="page-subtitle">Manage system users and their roles</p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Users</h2>
                </div>
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>Users management interface - To be implemented</p>
                </div>
            </div>
        </div>
    );
}
