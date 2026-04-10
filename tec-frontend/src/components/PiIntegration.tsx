'use client';

import { usePiAuth }      from '@/lib-client/hooks/usePiAuth';
import { usePiPayment }   from '@/lib-client/hooks/usePiPayment';
import { useTranslation } from '@/lib/i18n';
import { useState }       from 'react';
import styles             from './PiIntegration.module.css';

type PaymentState =
  | 'idle' | 'processing' | 'approving' | 'completing'
  | 'success' | 'error' | 'cancelled';

export default function PiIntegration() {
  const {
    user, isAuthenticated, isLoading,
    error: authError, errorType: authErrorType, login,
  } = usePiAuth();

  const {
    isProcessing, lastPayment,
    error: paymentError, errorType: paymentErrorType,
    testSDK, payDemoPi,
  } = usePiPayment();

  const { t }                                       = useTranslation();
  const [paymentState, setPaymentState]             = useState<PaymentState>('idle');
  const [errorMessage, setErrorMessage]             = useState<string>('');

  const handleConnect = async () => {
    if (!isAuthenticated) {
      try {
        await login();
      } catch {
        // Error is already set in usePiAuth state
      }
    }
  };

  const handleTestSdk = () => {
    testSDK();
  };

  const handlePayDemo = async () => {
    try {
      setPaymentState('processing');
      setErrorMessage('');

      const result = await payDemoPi();

      if (!result) {
        setPaymentState('idle');
        return;
      }

      if (result.success && result.status === 'completed') {
        setPaymentState('success');
      } else if (result.status === 'cancelled') {
        setPaymentState('cancelled');
      } else {
        setPaymentState('error');
        setErrorMessage(result.message || 'فشلت الدفعة / Payment failed');
      }
    } catch (e) {
      setPaymentState('error');
      const message =
        paymentError ||
        (e instanceof Error ? e.message : 'حدث خطأ غير متوقع / Unexpected error occurred');
      setErrorMessage(message);
    }
  };

  const handleRetry = () => {
    setPaymentState('idle');
    setErrorMessage('');
  };

  const getPaymentStatusMessage = () => {
    switch (paymentState) {
      case 'processing':  return 'جاري معالجة الدفعة... / Processing payment...';
      case 'approving':   return 'جاري الموافقة... / Approving...';
      case 'completing':  return 'جاري الإكمال... / Completing...';
      case 'success':     return lastPayment?.message || 'تمت الدفعة بنجاح! 🎉 / Payment successful! 🎉';
      case 'cancelled':   return 'ألغيت الدفعة / Payment cancelled';
      case 'error':       return errorMessage;
      default:            return '';
    }
  };

  const getErrorMessageWithInstructions = () => {
    if (paymentState === 'error' && paymentErrorType) {
      switch (paymentErrorType) {
        case 'not_pi_browser':
          return (<><div>❌ {errorMessage}</div><div style={{ marginTop: '8px', fontSize: '0.9em' }}>📱 يرجى فتح التطبيق داخل متصفح Pi Network<br />📱 Please open the app inside Pi Browser</div></>);
        case 'timeout':
          return (<><div>⏱️ {errorMessage}</div><div style={{ marginTop: '8px', fontSize: '0.9em' }}>🔄 يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى<br />🔄 Please check your internet connection and try again</div></>);
        case 'approval_failed':
          return (<><div>❌ {errorMessage}</div><div style={{ marginTop: '8px', fontSize: '0.9em' }}>⚠️ فشلت الموافقة على الدفع من الخادم<br />⚠️ Server approval failed - payment may be incomplete</div></>);
        default:
          return <div>❌ {errorMessage}</div>;
      }
    }

    if (authError && authErrorType) {
      switch (authErrorType) {
        case 'not_pi_browser':
          return (<><div>❌ {authError}</div><div style={{ marginTop: '8px', fontSize: '0.9em' }}>📱 افتح تطبيق Pi Network → التطبيقات → TEC App<br />📱 Open Pi Network app → Apps → TEC App</div></>);
        case 'timeout':
          return (<><div>⏱️ {authError}</div><div style={{ marginTop: '8px', fontSize: '0.9em' }}>🔄 يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى<br />🔄 Please check your internet connection and try again</div></>);
        case 'storage':
          return (<><div>❌ {authError}</div><div style={{ marginTop: '8px', fontSize: '0.9em' }}>🔒 يرجى تعطيل وضع التصفح الخاص<br />🔒 Please disable private browsing mode</div></>);
        default:
          return <div>❌ {authError}</div>;
      }
    }

    return <div>❌ {errorMessage}</div>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h3 className={styles.title}>🌐 {t.dashboard.piIntegration.title}</h3>

        {authError && (
          <div className={styles.error}>
            <div className={styles.errorMessage}>{getErrorMessageWithInstructions()}</div>
            <button className={`${styles.btn} ${styles.btnRetry}`} onClick={handleConnect} disabled={isLoading}>
              {isLoading ? '⏳ جاري التحميل... / Loading...' : '🔄 إعادة المحاولة / Retry'}
            </button>
          </div>
        )}

        {!isAuthenticated && !authError && (
          <button className={`${styles.btn} ${styles.btnConnect}`} onClick={handleConnect} disabled={isLoading}>
            {isLoading ? '⏳ جاري التحميل... / Loading...' : t.dashboard.piIntegration.connectBtn}
          </button>
        )}

        {isAuthenticated && (
          <div className={styles.authenticated}>
            <span className={styles.checkmark}>✅</span>
            <span>{t.dashboard.piIntegration.authenticated} <strong>@{user?.piUsername}</strong></span>
          </div>
        )}

        <div className={styles.mainnetIndicator}>
          🌐{' '}
          {process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'
            ? 'Sandbox Mode: Demo payments'
            : 'Mainnet Mode: Real Pi payments'}
        </div>

        <div className={styles.buttonGroup}>
          <button className={`${styles.btn} ${styles.btnTest}`} onClick={handleTestSdk}>
            🖊️ {t.dashboard.piIntegration.testSdk}
          </button>

          <button
            className={`${styles.btn} ${styles.btnPay}`}
            onClick={handlePayDemo}
            disabled={!isAuthenticated || isProcessing || paymentState === 'processing'}
          >
            {!isAuthenticated ? (
              <span>🔒 سجّل الدخول أولاً / Login first</span>
            ) : isProcessing || paymentState === 'processing' ? (
              <span>⏳ {t.dashboard.piIntegration.processing}</span>
            ) : (
              <span>💎 {t.dashboard.piIntegration.payDemo}</span>
            )}
          </button>
        </div>

        {paymentState === 'success' && lastPayment && (
          <div className={styles.success}>
            <div className={styles.successMessage}>✅ {getPaymentStatusMessage()}</div>
            {lastPayment.txid && (
              <div className={styles.txidInfo}><small>txid: <code>{lastPayment.txid}</code></small></div>
            )}
            {lastPayment.paymentId && (
              <div className={styles.paymentIdInfo}><small>Payment ID: <code>{lastPayment.paymentId}</code></small></div>
            )}
          </div>
        )}

        {paymentState === 'cancelled' && (
          <div className={styles.warning}>⚠️ {getPaymentStatusMessage()}</div>
        )}

        {paymentState === 'error' && (
          <div className={styles.error}>
            <div className={styles.errorMessage}>{getErrorMessageWithInstructions()}</div>
            <button className={`${styles.btn} ${styles.btnRetry}`} onClick={handleRetry}>
              🔄 إعادة المحاولة / Retry
            </button>
          </div>
        )}

        {(paymentState === 'processing' || paymentState === 'approving' || paymentState === 'completing') && (
          <div className={styles.processing}>
            <div className={styles.spinner}></div>
            <div>{getPaymentStatusMessage()}</div>
          </div>
        )}
      </div>
    </div>
  );
            }
