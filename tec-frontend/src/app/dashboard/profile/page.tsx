'use client';

import { useState } from 'react';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import styles from './profile.module.css';

export default function ProfilePage() {
  const { user } = usePiAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [formData,  setFormData]  = useState({
    username: user?.piUsername || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    // TODO: Save to backend
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      console.log('Delete account');
    }
  };

  const copyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.subtitle}>Manage your account information</p>
      </header>

      {/* ── Avatar Card ── */}
      <section className={`${styles.section} fade-up`}>
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            <span className={styles.avatarText}>{user?.piUsername?.[0]?.toUpperCase()}</span>
          </div>
          <div className={styles.profileInfo}>
            <h2 className={styles.profileName}>@{user?.piUsername}</h2>
            <p className={styles.profileId}>Pi ID: {user?.piId?.substring(0, 16)}...</p>
            <div className={styles.badges}>
              <span className={styles.roleBadge}>{user?.role ?? 'user'}</span>
              <span className={styles.planBadge}>{user?.subscriptionPlan || 'Free'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Account Info ── */}
      <section className={`${styles.section} fade-up-1`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Account Information</h2>
          {!isEditing && (
            <button className={styles.editBtn} onClick={() => setIsEditing(true)}>Edit</button>
          )}
        </div>

        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              className={styles.input}
              value={formData.username}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Pi UID</label>
            <input
              type="text"
              className={styles.input}
              value={user?.piId || 'N/A'}
              disabled
            />
          </div>

          {/* ── TEC User ID + Copy ── */}
          <div className={styles.formGroup}>
            <label className={styles.label}>TEC User ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className={styles.input}
                value={user?.id || 'N/A'}
                disabled
                style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              />
              <button
                onClick={copyId}
                style={{
                  padding:      '0 16px',
                  background:   copied ? 'rgba(46,204,113,0.15)' : 'var(--dark)',
                  border:       `1px solid ${copied ? 'rgba(46,204,113,0.4)' : 'var(--border)'}`,
                  borderRadius: 8,
                  color:        copied ? '#2ecc71' : 'var(--white)',
                  fontSize:     13,
                  fontWeight:   600,
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                  transition:   'all 0.2s',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Member Since</label>
            <input
              type="text"
              className={styles.input}
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              disabled
            />
          </div>

          {isEditing && (
            <div className={styles.formActions}>
              <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
              <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          )}
        </div>
      </section>

      {/* ── KYC Status ── */}
      <section className={`${styles.section} fade-up-2`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Verification</h2>
          <a href="/dashboard/kyc"
            style={{ padding: '8px 16px', background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--white)', fontSize: 14, textDecoration: 'none' }}>
            Go to KYC →
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <span style={{ fontSize: 24 }}>🪪</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: 'var(--white)', marginBottom: 2 }}>KYC Verification</div>
            <div style={{ fontSize: 13, color: '#f0c040' }}>Pending — complete to unlock all features</div>
          </div>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f0c040', display: 'inline-block' }} />
        </div>
      </section>

      {/* ── Connected Apps ── */}
      <section className={`${styles.section} fade-up-2`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Connected Apps</h2>
        </div>
        <div className={styles.appsList}>
          <div className={styles.appItem}>
            <div className={styles.appIcon}>🔷</div>
            <div className={styles.appInfo}>
              <div className={styles.appName}>TEC Platform</div>
              <div className={styles.appStatus}>Connected</div>
            </div>
            <div className={styles.appDate}>Pi Network</div>
          </div>
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section className={`${styles.section} fade-up-3`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: '💎', label: 'Assets',       sub: 'View your assets',   href: '/dashboard/assets'        },
            { icon: '💳', label: 'Wallet',        sub: 'Pi balance',         href: '/dashboard/wallet'        },
            { icon: '🔒', label: 'Security',      sub: 'Account security',   href: '/dashboard/security'      },
            { icon: '🔔', label: 'Notifications', sub: 'View notifications', href: '/dashboard/notifications' },
          ].map(a => (
            <a key={a.href} href={a.href}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', transition: 'border-color 0.2s' }}>
              <span style={{ fontSize: 24 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: 14, color: 'var(--white)', fontWeight: 500 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.sub}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Danger Zone ── */}
      <section className={`${styles.dangerZone} fade-up-3`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Danger Zone</h2>
        </div>
        <div className={styles.dangerContent}>
          <div>
            <h3 className={styles.dangerTitle}>Delete Account</h3>
            <p className={styles.dangerDescription}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <button className={styles.deleteBtn} onClick={handleDelete}>Delete Account</button>
        </div>
      </section>
    </div>
  );
          }
