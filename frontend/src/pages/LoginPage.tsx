import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

interface FieldErrors {
  email?: string;
  password?: string;
}

const RETICLE_ANGLES = Array.from({ length: 12 }, (_, idx) => idx * 30);

function OpticalReticleSeal({
  isActive,
  isVerifying,
}: {
  isActive: boolean;
  isVerifying: boolean;
}) {
  const outerRingMotion = isVerifying
    ? 'animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none'
    : isActive
      ? 'rotate-[16deg] scale-[1.03]'
      : 'rotate-0 scale-100';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <div
        aria-hidden="true"
        className={`absolute inset-2 rounded-full bg-[var(--accent-gold)]/20 blur-xl transition-opacity duration-500 motion-reduce:transition-none ${
          isActive || isVerifying ? 'opacity-100' : 'opacity-55'
        }`}
      />

      <svg
        viewBox="0 0 96 96"
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full pointer-events-none transition-transform duration-500 ease-out motion-reduce:transition-none ${outerRingMotion}`}
      >
        <circle
          cx="48"
          cy="48"
          r="45"
          fill="none"
          stroke="var(--accent-gold-border)"
          strokeWidth="1.2"
          strokeDasharray="18 8 4 8"
        />
        {RETICLE_ANGLES.map((deg) => {
          const isCardinal = deg % 90 === 0;
          return (
            <line
              key={deg}
              x1="48"
              y1={isCardinal ? '3' : '5'}
              x2="48"
              y2={isCardinal ? '9' : '7.5'}
              stroke={isCardinal ? 'var(--accent-gold-text)' : 'var(--border-medium)'}
              strokeWidth={isCardinal ? '1.3' : '0.9'}
              strokeLinecap="round"
              transform={`rotate(${deg} 48 48)`}
            />
          );
        })}
      </svg>

      <span className="relative z-10 w-14 h-14 rounded-full bg-[#181614] dark:bg-transparent border border-[var(--accent-gold-border)] dark:border-transparent flex items-center justify-center shadow-xs dark:shadow-none">
        <img
          src="/brand/trinetra-logo.svg"
          alt="Lambang TRINETRA"
          width={40}
          height={40}
          fetchPriority="high"
          className="w-10 h-10 object-contain"
        />
      </span>
    </div>
  );
}

export function LoginPage() {
  const { login, sessionNotice, clearSessionNotice } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormFocused, setIsFormFocused] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Akses Terbatas | TRINETRA';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Format email tidak valid.';
    }

    if (!password) {
      errors.password = 'Kata sandi wajib diisi.';
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateForm();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setFormError('Periksa kembali email dan kata sandi Anda.');
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password,
        remember,
      });
    } catch (err: unknown) {
      const e = err as {
        response?: {
          status?: number;
          data?: { message?: string; errors?: { email?: string[]; password?: string[] } };
        };
      };
      const status = e?.response?.status;
      const data = e?.response?.data;

      if (status === 422) {
        const emailMsg = data?.errors?.email?.[0];
        const passwordMsg = data?.errors?.password?.[0];
        setFieldErrors({ email: emailMsg, password: passwordMsg });
        setFormError(emailMsg || passwordMsg || data?.message || 'Kredensial ditolak.');
      } else if (status === 429) {
        setFormError(data?.message || 'Terlalu banyak percobaan gagal. Tunggu sebentar.');
      } else {
        setFormError(data?.message || 'Server autentikasi tidak dapat dijangkau.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSealActive = isFormFocused || email.length > 0 || password.length > 0;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)] font-sans-ui flex items-center justify-center px-4 pt-20 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-8">
      {/* Subtle Top-Right Theme Switcher */}
      <div className="fixed top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          className="min-h-11 px-3.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 transition-colors"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-[var(--accent-gold-text)]" aria-hidden="true" />
              <span>Mode Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-[var(--text-primary)]" aria-hidden="true" />
              <span>Mode Gelap</span>
            </>
          )}
        </button>
      </div>

      {/* Main Architectural Access Card */}
      <section
        aria-label="Otorisasi Akses TRINETRA"
        onFocusCapture={() => setIsFormFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsFormFocused(false);
          }
        }}
        className="animate-vault-enter relative z-10 w-full max-w-[420px] surface-card overflow-hidden shadow-[var(--shadow-elevated)]"
      >
        {/* Top Sovereign Gold Hairline */}
        <div
          aria-hidden="true"
          className="h-0.5 w-full bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent"
        />

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-3.5">
            <OpticalReticleSeal isActive={isSealActive} isVerifying={isSubmitting} />
            <div className="space-y-1.5">
              <div className="text-xs font-bold tracking-[0.14em] text-[var(--accent-gold-text)]">
                TRINETRA
              </div>
              <h1 className="font-editorial text-2xl sm:text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
                Akses Konsol Intelijen
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Masuk dengan akun operator terotorisasi untuk membuka workspace.
              </p>
            </div>
          </div>

          {sessionNotice && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)] px-4 py-3 text-xs text-[var(--text-primary)]"
            >
              <p className="leading-relaxed pt-0.5">{sessionNotice}</p>
              <button
                type="button"
                onClick={clearSessionNotice}
                aria-label="Tutup pemberitahuan sesi"
                className="min-w-9 min-h-9 -mr-1.5 -mt-1 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 rounded-xl border border-[var(--sentiment-neg-border)] bg-[var(--sentiment-neg-subtle)] px-4 py-3 text-xs text-[var(--sentiment-neg)] font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-semibold text-[var(--text-primary)]">
                Email Operator
              </label>
              <div className="group relative">
                <Mail
                  className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent-gold-text)] transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  placeholder="nama@domain.com"
                  className={`input-field w-full min-h-11 py-2.5 pl-10 pr-4 text-base sm:text-sm ${
                    fieldErrors.email ? '!border-[var(--sentiment-neg)]' : ''
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" className="text-xs text-[var(--sentiment-neg)] font-medium">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold text-[var(--text-primary)]">
                Kata Sandi
              </label>
              <div className="group relative">
                <Lock
                  className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent-gold-text)] transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  placeholder="Masukkan kata sandi"
                  className={`input-field w-full min-h-11 py-2.5 pl-10 pr-12 text-base sm:text-sm ${
                    fieldErrors.password ? '!border-[var(--sentiment-neg)]' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={showPassword}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="text-xs text-[var(--sentiment-neg)] font-medium">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <label
              htmlFor="login-remember"
              className={`min-h-11 flex items-center gap-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] select-none py-1 transition-colors ${
                isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <input
                id="login-remember"
                name="remember"
                type="checkbox"
                checked={remember}
                disabled={isSubmitting}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-input)] accent-[var(--accent-gold)]"
              />
              <span>Pertahankan sesi selama 30 hari</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-gold w-full min-h-12 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <span>Masuk ke Konsol</span>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
