import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/TextInput';

const MIN_NICKNAME = 2;
const MAX_NICKNAME = 20;

export type LoginFormProps = {
  readonly onSubmit: (nickname: string) => void;
  readonly busy?: boolean;
  readonly error?: string | null;
};

export const LoginForm = ({ onSubmit, busy = false, error = null }: LoginFormProps) => {
  const [nickname, setNickname] = useState('');
  const trimmed = nickname.trim();
  const canSubmit = trimmed.length >= MIN_NICKNAME && !busy;

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit(trimmed);
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <TextInput label="Becenév" value={nickname} onChange={setNickname} maxLength={MAX_NICKNAME} />
      {error !== null && (
        <p className="login-form__error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!canSubmit}>
        Belépés
      </Button>
    </form>
  );
};
