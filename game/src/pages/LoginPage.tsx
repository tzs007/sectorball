import { LoginForm } from '../components/molecules/LoginForm';
import { MainLayout } from '../components/templates/MainLayout';

const errorText = (code: string | null): string | null => {
  if (code === null) return null;
  return code === 'invalidNickname' ? 'A becenév 2–20 karakter legyen' : 'Hiba történt, próbáld újra';
};

export type LoginPageProps = {
  readonly onLogin: (nickname: string) => void;
  readonly busy: boolean;
  readonly error: string | null;
};

export const LoginPage = ({ onLogin, busy, error }: LoginPageProps) => (
  <MainLayout title="Sectorball">
    <LoginForm onSubmit={onLogin} busy={busy} error={errorText(error)} />
  </MainLayout>
);
