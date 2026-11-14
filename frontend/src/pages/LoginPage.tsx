import { useEffect, useState, type FormEvent, type PointerEvent } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface FieldErrors {
  email?: string;
  password?: string;
}

const RETICLE_ANGLES = Array.from({ length: 12 }, (_, idx) => idx * 30);

const INPUT_BASE_CLASS =
  'w-full min-h-11 rounded-lg bg-[#06080c]/90 border py-2.5 text-sm text-[#f4f5f8] placeholder:text-[#848b99] shadow-[inset_0_2px_6px_rgba(0,0,0,0.65)] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none focus:border-[#d4af37] focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.65),0_0_0_1px_rgba(212,175,55,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37] disabled:opacity-60';

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
      ? 'rotate-[18deg] scale-[1.03]'
      : 'rotate-0 scale-100';

  const innerRingMotion = isVerifying
    ? 'rotate-45 scale-105'
    : isActive
      ? '-rotate-[14deg] scale-100'
      : 'rotate-0 scale-100';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <div
        aria-hidden="true"
        className={`absolute inset-2 rounded-full bg-[#d4af37]/18 blur-xl transition-opacity duration-500 motion-reduce:transition-none ${
          isActive || isVerifying ? 'opacity-100' : 'opacity-65'
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
          stroke="rgba(212, 175, 55, 0.36)"
          strokeWidth="1"
          strokeDasharray="18 8 4 8"
        />
        {RETICLE_ANGLES.map((deg) => {
          const isCardinal = deg % 90 === 0;
          return (
            <line
              key={deg}
              x1="48"
              y1={isCardinal ? '2.5' : '4.5'}
              x2="48"
              y2={isCardinal ? '8.5' : '7.5'}
              stroke={isCardinal ? 'rgba(212, 175, 55, 0.85)' : 'rgba(157, 163, 174, 0.45)'}
              strokeWidth={isCardinal ? '1.25' : '0.9'}
              strokeLinecap="round"
              transform={`rotate(${deg} 48 48)`}
            />
          );
        })}
      </svg>

      <svg
        viewBox="0 0 96 96"
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full pointer-events-none transition-transform duration-500 ease-out motion-reduce:transition-none ${innerRingMotion}`}
      >
        <circle
          cx="48"
          cy="48"
          r="34"
          fill="none"
          stroke="rgba(244, 245, 248, 0.22)"
          strokeWidth="0.9"
          strokeDasharray="2 6"
        />
      </svg>

      <img
        src="/brand/trinetra-logo.svg"
        alt="TRINETRA"
        width={44}
        height={44}
        fetchPriority="high"
        className="relative z-10 w-11 h-11 object-contain"
      />
    </div>
  );
}

export function LoginPage() {
  const { login, sessionNotice, clearSessionNotice } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isFormFocused, setIsFormFocused] = useState(false);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Akses Terbatas | TRINETRA';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const handleCardPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointerPos({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

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
      setFormError('Periksa kembali email dan kata sandi.');
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
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 422) {
        const emailMsg = data?.errors?.email?.[0];
        const passwordMsg = data?.errors?.password?.[0];
        setFieldErrors({
          email: emailMsg,
          password: passwordMsg,
        });
        setFormError(emailMsg || passwordMsg || data?.message || 'Kredensial ditolak.');
      } else if (status === 429) {
        setFormError(
          data?.message || 'Terlalu banyak percobaan gagal. Tunggu sebentar.'
        );
      } else {
        setFormError(
          data?.message || 'Server autentikasi tidak dapat dijangkau.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSealActive = isCardHovered || isFormFocused || email.length > 0 || password.length > 0;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#08090d] text-[#f4f5f8] font-sans-ui selection:bg-[#d4af37]/25 selection:text-[#f4f5f8] flex items-center justify-center px-4 py-8 sm:px-6">
      <img
        src="/brand/ambient-backdrop.jpg"
        alt=""
        aria-hidden="true"
        width={1600}
        height={900}
        fetchPriority="high"
        className="fixed inset-0 w-full h-full object-cover object-center opacity-35 sm:opacity-45 pointer-events-none select-none"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(8,9,13,0.28)_0%,rgba(8,9,13,0.78)_58%,rgba(8,9,13,0.97)_100%)]"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#08090d]/85 via-transparent to-[#08090d]/95"
      />

      <section
        aria-label="Otorisasi Akses"
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setIsCardHovered(true);
        }}
        onPointerMove={handleCardPointerMove}
        onPointerLeave={() => {
          setIsCardHovered(false);
          setPointerPos(null);
        }}
        onFocusCapture={() => setIsFormFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsFormFocused(false);
          }
        }}
        className="animate-vault-enter relative z-10 w-full max-w-[400px] bg-[#0a0d14]/82 backdrop-blur-xl border border-white/[0.12] rounded-xl overflow-hidden shadow-[0_32px_90px_-18px_rgba(0,0,0,0.92)]"
      >
        {/* Cursor-tracked subtle gold sheen (desktop pointer only, disabled on reduced motion) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:hidden"
          style={{
            opacity: pointerPos ? 1 : 0,
            background: pointerPos
              ? `radial-gradient(340px circle at ${pointerPos.x}px ${pointerPos.y}px, rgba(212, 175, 55, 0.14), transparent 62%)`
              : undefined,
          }}
        />

        {/* Tactical corner brackets & top seal rule */}
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-3.5 h-3.5 border-t border-l border-[#d4af37]/60 rounded-tl-xl" />
        <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-3.5 h-3.5 border-t border-r border-[#d4af37]/60 rounded-tr-xl" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-3.5 h-3.5 border-b border-l border-[#d4af37]/45 rounded-bl-xl" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-3.5 h-3.5 border-b border-r border-[#d4af37]/45 rounded-br-xl" />
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#d4af37]/75 to-transparent" />

        <div className="relative z-10 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-3.5">
            <OpticalReticleSeal isActive={isSealActive} isVerifying={isSubmitting} />
            <div className="space-y-2.5 flex flex-col items-center">
              <h1 className="font-crest text-[1.4rem] sm:text-[1.55rem] font-semibold tracking-[0.08em] text-balance text-[#f4f5f8]">
                Akses Terbatas
              </h1>
              <div
                aria-hidden="true"
                className="w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37]/55 to-transparent"
              />
            </div>
          </div>

          {sessionNotice && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start justify-between gap-3 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-3 text-xs text-[#f4f5f8]"
            >
              <p className="leading-relaxed pt-0.5 text-pretty">{sessionNotice}</p>
              <button
                type="button"
                onClick={clearSessionNotice}
                aria-label="Tutup pemberitahuan sesi"
                className="min-w-11 min-h-11 -mr-2 -mt-2 flex items-center justify-center rounded-lg text-[#9da3ae] hover:text-[#f4f5f8] hover:bg-white/10 active:bg-white/15 transition-colors duration-150 motion-reduce:transition-none"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 rounded-lg border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-xs text-[#fda4af]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#fda4af]" aria-hidden="true" />
              <p className="leading-relaxed text-pretty">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-[#f4f5f8]"
              >
                Email
              </label>
              <div className="group relative">
                <Mail
                  className="w-4 h-4 text-[#8d95a3] group-focus-within:text-[#d4af37] transition-colors duration-150 motion-reduce:transition-none absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                  className={`${INPUT_BASE_CLASS} pl-10 pr-4 ${
                    fieldErrors.email
                      ? 'border-rose-400 focus:border-rose-400'
                      : 'border-[#5c6475]'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-error" className="text-xs text-[#fda4af]">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#f4f5f8]"
              >
                Kata Sandi
              </label>
              <div className="group relative">
                <Lock
                  className="w-4 h-4 text-[#8d95a3] group-focus-within:text-[#d4af37] transition-colors duration-150 motion-reduce:transition-none absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                  className={`${INPUT_BASE_CLASS} pl-10 pr-12 ${
                    fieldErrors.password
                      ? 'border-rose-400 focus:border-rose-400'
                      : 'border-[#5c6475]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-pressed={showPassword}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[#9da3ae] hover:text-[#f4f5f8] active:bg-white/10 transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="text-xs text-[#fda4af]">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <label
              htmlFor="login-remember"
              className={`min-h-11 flex items-center gap-3 text-xs text-[#9da3ae] hover:text-[#f4f5f8] select-none py-1 transition-colors duration-150 motion-reduce:transition-none ${
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
                className="w-4 h-4 rounded border-[#5c6475] bg-[#06080c] accent-[#d4af37]"
              />
              <span>Ingat sesi 30 hari</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative overflow-hidden w-full min-h-12 rounded-lg bg-gradient-to-b from-[#e3c258] via-[#d4af37] to-[#b58e24] text-[#08090d] font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_12px_28px_-10px_rgba(212,175,55,0.42)] enabled:hover:brightness-105 enabled:active:scale-[0.99] transition-[filter,transform] duration-150 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-60"
            >
              {!isSubmitting && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
                />
              )}
              {isSubmitting ? (
                <>
                  <Loader2 className="relative z-10 w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span className="relative z-10">Memverifikasi...</span>
                </>
              ) : (
                <span className="relative z-10">Masuk</span>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
