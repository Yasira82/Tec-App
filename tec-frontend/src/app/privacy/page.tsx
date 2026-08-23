'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import styles from './legal.module.css';

const SECTIONS_EN = [
  { id: 'overview', title: '1. Overview', content: `TEC Ecosystem ("TEC", "we", "our", or "us") operates a suite of 24 sovereign applications built on the Pi Network blockchain. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use any TEC application.\n\nBy accessing or using any TEC application, you agree to the terms of this Privacy Policy.` },
  { id: 'information-collected', title: '2. Information We Collect', subsections: [
    { subtitle: '2.1 Pi Network Identity Data', text: `When you authenticate via Pi Network, we receive your Pi Network User ID (UID), Pi username, and access tokens. We do not receive or store your Pi Network password or private keys.` },
    { subtitle: '2.2 Transaction Data', text: `We record payment records including transaction identifiers, amounts, timestamps, payment status, and blockchain transaction IDs (txid).` },
    { subtitle: '2.3 Usage Data', text: `We automatically collect technical information including IP addresses, browser type, device information, and pages visited.` },
  ]},
  { id: 'use-of-information', title: '3. How We Use Your Information', items: [
    'To authenticate your identity and provide secure access to TEC services',
    'To process Pi Network payments and maintain accurate transaction records',
    'To credit TEC tokens to your wallet following successful Pi payments',
    'To detect, investigate, and prevent fraudulent transactions',
    'To comply with applicable legal obligations',
  ]},
  { id: 'security', title: '4. Security', content: `We implement industry-standard security measures including TLS/SSL encryption, JWT-based authentication with secure token rotation, and rate limiting on all payment endpoints.` },
  { id: 'blockchain', title: '5. Blockchain & Pi Network', content: `Transactions on the Pi Network blockchain are immutable and publicly visible. TEC is an independent developer application built on Pi Network and is not affiliated with Pi Network or Minepi, Inc.` },
  { id: 'your-rights', title: '6. Your Rights', items: [
    'Access: Request a copy of the personal data we hold about you',
    'Rectification: Request correction of inaccurate data',
    'Erasure: Request deletion of your personal data',
    'Portability: Request transfer of your data',
  ], footer: 'To exercise any of these rights, contact us at privacy@tec.pi.' },
  { id: 'contact', title: '7. Contact', content: 'For privacy-related inquiries:', contact: { email: 'privacy@tec.pi', entity: 'TEC Ecosystem', response: 'We aim to respond within 5 business days.' } },
];

const SECTIONS_AR = [
  { id: 'overview', title: '1. نظرة عامة', content: `يشغّل TEC Ecosystem ("TEC") مجموعة من 24 تطبيقاً مبنياً على بلوكتشين Pi Network. توضح سياسة الخصوصية هذه كيفية جمع معلوماتك واستخدامها والكشف عنها وحمايتها.\n\nباستخدام أي تطبيق TEC، فإنك توافق على شروط سياسة الخصوصية هذه.` },
  { id: 'information-collected', title: '2. المعلومات التي نجمعها', subsections: [
    { subtitle: '2.1 بيانات هوية Pi Network', text: `عند المصادقة عبر Pi Network، نتلقى معرف المستخدم (UID) واسم المستخدم ورموز الوصول. لا نتلقى أو نخزن كلمة مرور Pi Network أو المفاتيح الخاصة.` },
    { subtitle: '2.2 بيانات المعاملات', text: `نسجل سجلات الدفع بما في ذلك معرفات المعاملات والمبالغ والطوابع الزمنية وحالة الدفع ومعرفات معاملات البلوكتشين.` },
    { subtitle: '2.3 بيانات الاستخدام', text: `نجمع تلقائياً معلومات تقنية تشمل عناوين IP ونوع المتصفح ومعلومات الجهاز والصفحات التي تمت زيارتها.` },
  ]},
  { id: 'use-of-information', title: '3. كيف نستخدم معلوماتك', items: [
    'للتحقق من هويتك وتوفير وصول آمن إلى خدمات TEC',
    'لمعالجة مدفوعات Pi Network والحفاظ على سجلات دقيقة',
    'لإضافة رموز TEC إلى محفظتك بعد نجاح مدفوعات Pi',
    'لاكتشاف المعاملات الاحتيالية والتحقيق فيها ومنعها',
    'للامتثال للالتزامات القانونية المعمول بها',
  ]},
  { id: 'security', title: '4. الأمان', content: `نطبق تدابير أمنية بمعايير الصناعة تشمل تشفير TLS/SSL، والمصادقة المستندة إلى JWT مع تدوير آمن للرموز، وتحديد معدل الطلبات على جميع نقاط نهاية الدفع.` },
  { id: 'blockchain', title: '5. البلوكتشين وPi Network', content: `معاملات بلوكتشين Pi Network غير قابلة للتغيير ومرئية للعموم. TEC تطبيق مطور مستقل مبني على Pi Network وغير تابع لـ Pi Network أو Minepi, Inc.` },
  { id: 'your-rights', title: '6. حقوقك', items: [
    'الوصول: طلب نسخة من بياناتك الشخصية',
    'التصحيح: طلب تصحيح البيانات غير الدقيقة',
    'الحذف: طلب حذف بياناتك الشخصية',
    'قابلية النقل: طلب نقل بياناتك',
  ], footer: 'لممارسة أي من هذه الحقوق، تواصل معنا على privacy@tec.pi.' },
  { id: 'contact', title: '7. التواصل', content: 'للاستفسارات المتعلقة بالخصوصية:', contact: { email: 'privacy@tec.pi', entity: 'TEC Ecosystem', response: 'نهدف للرد خلال 5 أيام عمل.' } },
];

export default function PrivacyPage() {
  const { t, dir, locale } = useTranslation();
  const SECTIONS = locale === 'ar' ? SECTIONS_AR : SECTIONS_EN;
  const effectiveDate = locale === 'ar' ? '14 مارس 2026' : 'March 14, 2026';

  return (
    <main className={styles.main} dir={dir}>
      <div className={styles.bg} aria-hidden>
        <div className={styles.bgOrb} />
        <div className={styles.bgGrid} />
      </div>

      <div className={styles.header}>
        <Link href="/" className={styles.backLink}>
          {dir === 'rtl' ? 'العودة ←' : '← ' + t.legal.backHome}
        </Link>
        <div className={styles.badge}>{t.legal.privacy.badge}</div>
        <h1 className={styles.title}>{t.legal.privacy.title}</h1>
        <p className={styles.subtitle}>{t.legal.privacy.subtitle}</p>
        <div className={styles.meta}>
          <span>{t.legal.effectiveDate}: {effectiveDate}</span>
          <span className={styles.metaDot}>·</span>
          <span>{t.legal.version} 1.0</span>
        </div>
        <p className={styles.intro}>{t.legal.privacy.intro}</p>
      </div>

      <nav className={styles.toc}>
        <p className={styles.tocTitle}>{t.legal.contents}</p>
        <ul className={styles.tocList}>
          {SECTIONS.map(s => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={styles.tocLink}>{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <article className={styles.article}>
        {SECTIONS.map(s => (
          <section key={s.id} id={s.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>{s.title}</h2>
            {s.content && <p className={styles.text}>{s.content}</p>}
            {s.subsections && s.subsections.map(sub => (
              <div key={sub.subtitle} className={styles.subsection}>
                <h3 className={styles.subsectionTitle}>{sub.subtitle}</h3>
                <p className={styles.text}>{sub.text}</p>
              </div>
            ))}
            {s.items && (
              <ul className={styles.list}>
                {s.items.map((item, i) => (
                  <li key={i} className={styles.listItem}>
                    <span className={styles.listDot}>—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.footer && <p className={styles.textMuted}>{s.footer}</p>}
            {s.contact && (
              <div className={styles.contactBox}>
                <p className={styles.contactItem}>
                  <span className={styles.contactLabel}>Email</span>
                  <a href={`mailto:${s.contact.email}`} className={styles.contactLink}>{s.contact.email}</a>
                </p>
                <p className={styles.contactItem}>
                  <span className={styles.contactLabel}>{locale === 'ar' ? 'الجهة' : 'Entity'}</span>
                  <span>{s.contact.entity}</span>
                </p>
                <p className={styles.contactItem}>
                  <span className={styles.contactLabel}>{locale === 'ar' ? 'وقت الرد' : 'Response'}</span>
                  <span>{s.contact.response}</span>
                </p>
              </div>
            )}
          </section>
        ))}
      </article>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link href="/terms" className={styles.footerLink}>{t.legal.terms.title}</Link>
          <span className={styles.metaDot}>·</span>
          <Link href="/" className={styles.footerLink}>{t.legal.backHome}</Link>
        </div>
        <p className={styles.footerText}>© 2026 {t.common.brand} · Built on Pi Network</p>
      </footer>
    </main>
  );
}
