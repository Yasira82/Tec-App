'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import styles from '../privacy/legal.module.css';

const SECTIONS_EN = [
  { id: 'acceptance', title: '1. Acceptance of Terms', content: `By accessing or using any application within TEC Ecosystem ("TEC") ecosystem, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.\n\nIf you do not agree to these Terms, you must immediately cease all use of TEC services.` },
  { id: 'description', title: '2. Description of Services', content: 'TEC provides a suite of 24 sovereign digital applications built on the Pi Network blockchain.', items: [
    'Pi Network payment processing and TEC token conversion (1 Pi = 0.1 TEC)',
    'Digital asset management and portfolio tracking',
    'E-commerce, marketplace, and digital commerce platforms',
    'Real estate, travel, healthcare, and lifestyle services',
  ], footer: 'TEC operates as an independent developer application on Pi Network.' },
  { id: 'eligibility', title: '3. Eligibility', items: [
    'Be at least 18 years of age',
    'Have a valid Pi Network account in good standing',
    'Have the legal capacity to enter into binding agreements',
    'Not be located in a jurisdiction where use of our services is prohibited',
  ]},
  { id: 'payments', title: '4. Payments & Transactions', subsections: [
    { subtitle: '4.1 Pi Network Payments', text: 'All payments processed through TEC use Pi Network\'s payment infrastructure. By initiating a payment, you authorize TEC to submit the transaction to the Pi Network API.' },
    { subtitle: '4.2 TEC Token Conversion', text: 'Upon successful completion of a Pi payment, TEC credits your wallet with TEC tokens at the rate of 1 Pi = 0.1 TEC.' },
    { subtitle: '4.3 Transaction Finality', text: 'Blockchain transactions are irreversible by nature. Once confirmed on-chain, a transaction cannot be reversed.' },
  ]},
  { id: 'prohibited', title: '5. Prohibited Conduct', items: [
    'Violate any applicable law or third-party rights',
    'Engage in fraudulent or manipulative transactions',
    'Attempt to hack or compromise our systems',
    'Conduct money laundering or other financial crimes',
    'Circumvent any security or access control measures',
  ]},
  { id: 'disclaimer', title: '6. Disclaimer & Limitation of Liability', content: `TEC services are provided "as is" without warranties. We do not guarantee uninterrupted or error-free service. To the maximum extent permitted by law, TEC shall not be liable for any indirect, incidental, or consequential damages.` },
  { id: 'contact', title: '7. Contact', content: 'For questions regarding these Terms:', contact: { email: 'legal@tec.pi', entity: 'TEC Ecosystem', response: 'We aim to respond within 5 business days.' } },
];

const SECTIONS_AR = [
  { id: 'acceptance', title: '1. قبول الشروط', content: `بالوصول إلى أي تطبيق ضمن منظومة TEC Ecosystem ("TEC") أو استخدامه، فإنك تقر بأنك قرأت هذه الشروط وفهمتها وتوافق على الالتزام بها.\n\nإذا كنت لا توافق على هذه الشروط، يجب عليك التوقف فوراً عن استخدام خدمات TEC.` },
  { id: 'description', title: '2. وصف الخدمات', content: 'يوفر TEC مجموعة من 24 تطبيقاً رقمياً مستقلاً مبنياً على بلوكتشين Pi Network.', items: [
    'معالجة مدفوعات Pi Network وتحويل رموز TEC (1 Pi = 0.1 TEC)',
    'إدارة الأصول الرقمية وتتبع المحفظة',
    'منصات التجارة الإلكترونية والأسواق الرقمية',
    'خدمات العقارات والسفر والرعاية الصحية ونمط الحياة',
  ], footer: 'يعمل TEC كتطبيق مطور مستقل على Pi Network.' },
  { id: 'eligibility', title: '3. الأهلية', items: [
    'أن يكون عمرك 18 عاماً على الأقل',
    'امتلاك حساب Pi Network صالح',
    'الأهلية القانونية لإبرام اتفاقيات ملزمة',
    'عدم التواجد في ولاية قضائية تحظر استخدام خدماتنا',
  ]},
  { id: 'payments', title: '4. المدفوعات والمعاملات', subsections: [
    { subtitle: '4.1 مدفوعات Pi Network', text: 'تستخدم جميع المدفوعات المعالجة عبر TEC البنية التحتية لمدفوعات Pi Network. بإطلاق دفعة، فإنك تأذن لـ TEC بإرسال المعاملة إلى واجهة برمجة Pi Network.' },
    { subtitle: '4.2 تحويل رموز TEC', text: 'عند اكتمال دفعة Pi بنجاح، يضيف TEC رموز TEC إلى محفظتك بمعدل 1 Pi = 0.1 TEC.' },
    { subtitle: '4.3 نهائية المعاملات', text: 'معاملات البلوكتشين غير قابلة للعكس بطبيعتها. بمجرد التأكيد على السلسلة، لا يمكن عكس المعاملة.' },
  ]},
  { id: 'prohibited', title: '5. السلوك المحظور', items: [
    'انتهاك أي قانون معمول به أو حقوق طرف ثالث',
    'الانخراط في معاملات احتيالية أو تلاعبية',
    'محاولة اختراق أنظمتنا أو تعريضها للخطر',
    'غسيل الأموال أو الجرائم المالية الأخرى',
    'التحايل على أي تدابير أمنية أو ضوابط الوصول',
  ]},
  { id: 'disclaimer', title: '6. إخلاء المسؤولية وتحديد المسؤولية', content: `تُقدَّم خدمات TEC "كما هي" دون ضمانات. لا نضمن خدمة متواصلة أو خالية من الأخطاء. إلى أقصى حد يسمح به القانون، لن يكون TEC مسؤولاً عن أي أضرار غير مباشرة أو عرضية أو تبعية.` },
  { id: 'contact', title: '7. التواصل', content: 'للاستفسار عن هذه الشروط:', contact: { email: 'legal@tec.pi', entity: 'TEC Ecosystem', response: 'نهدف للرد خلال 5 أيام عمل.' } },
];

export default function TermsPage() {
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
        <div className={styles.badge}>{t.legal.terms.badge}</div>
        <h1 className={styles.title}>{t.legal.terms.title}</h1>
        <p className={styles.subtitle}>{t.legal.terms.subtitle}</p>
        <div className={styles.meta}>
          <span>{t.legal.effectiveDate}: {effectiveDate}</span>
          <span className={styles.metaDot}>·</span>
          <span>{t.legal.version} 1.0</span>
        </div>
        <p className={styles.intro}>{t.legal.terms.intro}</p>
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
          <Link href="/privacy" className={styles.footerLink}>{t.legal.privacy.title}</Link>
          <span className={styles.metaDot}>·</span>
          <Link href="/" className={styles.footerLink}>{t.legal.backHome}</Link>
        </div>
        <p className={styles.footerText}>© 2026 {t.common.brand} · Built on Pi Network</p>
      </footer>
    </main>
  );
}
