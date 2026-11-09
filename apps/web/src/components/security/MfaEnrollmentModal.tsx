import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Key,
  Copy,
  Printer,
  Check,
  AlertTriangle,
  X,
  Fingerprint,
} from 'lucide-react';
import {
  generateTotpSecret,
  generateTotpUri,
  generateRecoveryCodes,
  verifyTotpCode,
  generateQrCodeSvg,
  type UserMfaRecord,
} from '@church/domain';
import { useAuth } from '../../context/AuthContext.js';
import { useModalEscape } from '../../utils/useModalEscape.js';

interface MfaEnrollmentModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onEnrolled?: (record: UserMfaRecord) => void;
}

export const MfaEnrollmentModal: React.FC<MfaEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onEnrolled,
}) => {
  const { currentUser, enrollUserMfa } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState<'TOTP' | 'PASSKEY'>('TOTP');

  // TOTP setup state
  const secretBase32 = useMemo(() => generateTotpSecret(20), [isOpen]);
  const totpUri = useMemo(() => {
    return generateTotpUri({
      issuer: 'Calvary Crystal Church',
      accountName: currentUser.email || `${currentUser.id}@calvarycrystal.org`,
      secret: secretBase32,
    });
  }, [currentUser, secretBase32]);

  const qrSvgMarkup = useMemo(() => {
    return generateQrCodeSvg(totpUri, { size: 180, margin: 2 });
  }, [totpUri]);

  // Recovery codes
  const recoveryBundle = useMemo(() => generateRecoveryCodes(10), [isOpen]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Verification code input
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secretBase32);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(recoveryBundle.plainCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handlePrintCodes = () => {
    window.print();
  };

  const handleVerifyCode = () => {
    setVerifyError(null);
    const cleaned = verifyToken.trim();
    if (cleaned.length !== 6) {
      setVerifyError('Enter the 6-digit code shown in your authenticator app.');
      return;
    }

    // Accept valid TOTP or demo bypass code '123456'
    const isValid = cleaned === '123456' || verifyTotpCode({ token: cleaned, secretBase32 });
    if (!isValid) {
      setVerifyError('Invalid verification code. Check the time on your phone and try again.');
      return;
    }

    // Advance to Step 3 (Recovery codes)
    setStep(3);
  };

  const handleFinishEnrollment = () => {
    const record: UserMfaRecord = {
      userId: currentUser.id,
      isEnrolled: true,
      factorType: method,
      secretBase32: method === 'TOTP' ? secretBase32 : null,
      enrolledAt: new Date().toISOString(),
      recoveryCodesHashed: recoveryBundle.hashedCodes,
      recoveryCodesRemaining: recoveryBundle.plainCodes.length,
    };

    enrollUserMfa(currentUser.id, record);
    onEnrolled?.(record);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-[var(--radius)] shadow-xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[var(--accent)] border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 id="mfa-modal-title" className="text-base font-bold text-[var(--text-primary)]">
                Set up two-step verification
              </h2>
              <p className="text-[12px] text-[var(--text-muted)]">
                Calvary Crystal Church · Protected officer account ({currentUser.role})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-5 py-2.5 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] flex items-center justify-between text-[12px] font-sans tabular-nums">
          <span className={step === 1 ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
            1. Authenticator app
          </span>
          <span className="text-[var(--text-muted)]">→</span>
          <span className={step === 2 ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
            2. Verify code
          </span>
          <span className="text-[var(--text-muted)]">→</span>
          <span className={step === 3 ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
            3. Recovery codes
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-[13px]">
          {/* Step 1: Scan QR or Register Passkey */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Method Toggle: TOTP App vs Passkey */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--surface-subtle)] rounded-[var(--radius-sm)] border border-[var(--surface-border)]">
                <button
                  type="button"
                  onClick={() => setMethod('TOTP')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[var(--radius-sm)] font-medium text-[12px] ${
                    method === 'TOTP'
                      ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Authenticator app</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('PASSKEY')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[var(--radius-sm)] font-medium text-[12px] ${
                    method === 'PASSKEY'
                      ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>Security key / Passkey</span>
                </button>
              </div>

              {method === 'TOTP' ? (
                <>
                  <p className="text-[var(--text-muted)]">
                    Scan this QR code with Google Authenticator, Microsoft Authenticator, or 1Password on your phone.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                    <div
                      className="p-2 bg-white rounded border border-slate-200 shrink-0"
                      dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                    />
                    <div className="space-y-2 w-full text-[12px]">
                      <div className="font-semibold text-[var(--text-primary)]">
                        Can't scan? Enter this key manually:
                      </div>
                      <div className="p-2 rounded bg-[var(--surface-card)] border border-[var(--surface-border)] font-mono text-[13px] tracking-wider text-[var(--text-primary)] break-all select-all">
                        {secretBase32}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey ? 'Copied' : 'Copy key'}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-3">
                  <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                    <Fingerprint className="w-5 h-5 text-[var(--accent)]" />
                    <span>FIDO2 / WebAuthn Security Key or Biometrics</span>
                  </div>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    Use Windows Hello, Touch ID, or a hardware security key (YubiKey) as your two-step verification method.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
                  >
                    Register device security key
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Verification Input */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[var(--text-muted)]">
                Enter the 6-digit confirmation code generated by your authenticator app for <span className="font-semibold text-[var(--text-primary)]">Calvary Crystal Church</span>.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="verify-totp-input" className="block text-[12px] font-semibold text-[var(--text-muted)]">
                  6-digit verification code
                </label>
                <input
                  id="verify-totp-input"
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={verifyToken}
                  onChange={(e) => {
                    setVerifyToken(e.target.value.replace(/\D/g, ''));
                    setVerifyError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyCode();
                  }}
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono py-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-[var(--text-muted)] text-center">
                  Testing tip: You can enter current app code or default test code <span className="font-mono text-[var(--accent)]">123456</span>
                </p>
                {verifyError && (
                  <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium">{verifyError}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Single-Use Recovery Codes */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-[12px] text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Save these one-time recovery codes.</span> Each code can only be used once if you lose access to your authenticator app. They will not be shown again.
                </div>
              </div>

              <div className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                <div className="grid grid-cols-2 gap-2 font-mono text-[13px] font-semibold text-[var(--text-primary)] text-center">
                  {recoveryBundle.plainCodes.map((code, idx) => (
                    <div key={idx} className="p-1 rounded bg-[var(--surface-card)] border border-[var(--surface-border)]">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCodes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                >
                  {copiedCodes ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCodes ? 'Copied to clipboard' : 'Copy all codes'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintCodes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-card)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print codes</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--surface-border)] flex items-center justify-between bg-[var(--surface-subtle)]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
              className="text-[13px] text-[var(--text-muted)] hover:underline"
            >
              Back
            </button>
          ) : (
            <button type="button" onClick={onClose} className="text-[13px] text-[var(--text-muted)] hover:underline">
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2">
            {step === 1 && method === 'TOTP' && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
              >
                Next: Verify code
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={handleVerifyCode}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90"
              >
                Verify and activate
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={handleFinishEnrollment}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-emerald-700 text-white text-[13px] font-semibold hover:bg-emerald-800"
              >
                Done: Finish activation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
