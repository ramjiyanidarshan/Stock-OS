import React from 'react';
import { Boxes } from 'lucide-react';

export default function ModulesPage() {
    return (
        <div className="page-body">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Boxes size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Modules Management
                    </h1>
                    <p className="page-subtitle">Manage system modules and access control</p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Available Modules</h2>
                </div>
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>Module management interface - To be implemented</p>
                </div>
            </div>
        </div>
    );
}
