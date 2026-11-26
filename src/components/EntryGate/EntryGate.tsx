import { useRef, useState, type FormEvent } from 'react';
import { verifyEntryPassword } from '../../services/auth';

interface EntryGateProps {
  hasResumeRecord: boolean;
  resumeSummaryLabel: string | null;
  onUnlockSuccess: () => void;
}

export function EntryGate({
  hasResumeRecord,
  resumeSummaryLabel,
  onUnlockSuccess,
}: EntryGateProps) {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (verifyEntryPassword(password.trim())) {
      setErrorMessage(null);
      onUnlockSuccess();
      return;
    }
    setErrorMessage('비밀번호가 일치하지 않습니다. 다시 입력해 주세요.');
    setPassword('');
    inputRef.current?.focus();
  };

  return (
    <main className="entry-gate">
      <div className="entry-card">
        <p className="entry-eyebrow">성경 읽기</p>
        <h1 className="entry-title">개역개정 · NIV</h1>
        <p className="entry-desc">
          운영자가 안내한 공용 비밀번호를 입력하면 바로 성경 본문을 읽을 수 있습니다.
        </p>

        {hasResumeRecord && resumeSummaryLabel ? (
          <div className="entry-resume-hint" aria-live="polite">
            이어 읽기 기록 있음: <strong>{resumeSummaryLabel}</strong>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="entry-form" noValidate>
          <label htmlFor="entry-password-input" className="entry-label">
            공용 비밀번호
          </label>
          <input
            ref={inputRef}
            id="entry-password-input"
            type="password"
            inputMode="text"
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="비밀번호 입력"
            className={`entry-input ${errorMessage ? 'entry-input-error' : ''}`}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'entry-error-msg' : undefined}
            autoFocus
          />

          {errorMessage ? (
            <p id="entry-error-msg" role="alert" className="entry-error">
              {errorMessage}
            </p>
          ) : null}

          <button type="submit" className="entry-submit-btn">
            성경 읽기 시작
          </button>
        </form>
      </div>
    </main>
  );
}
