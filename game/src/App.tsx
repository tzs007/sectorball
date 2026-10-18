import { useState } from 'react';
import { useMatchRoute } from './hooks/useMatchRoute';
import { useSession } from './hooks/useSession';
import { LobbyPage } from './pages/LobbyPage';
import { LoginPage } from './pages/LoginPage';
import { MatchPage } from './pages/MatchPage';
import { createApiClient } from './services/apiClient';

const api = createApiClient();

export const App = () => {
  const { session, status, login, logout, error } = useSession(api);
  const { matchId, enter, leave } = useMatchRoute();
  const [loggingIn, setLoggingIn] = useState(false);

  if (status === 'checking') return null;

  if (session === null) {
    const handleLogin = (nickname: string) => {
      setLoggingIn(true);
      void login(nickname).finally(() => {
        setLoggingIn(false);
      });
    };
    return <LoginPage onLogin={handleLogin} busy={loggingIn} error={error} />;
  }

  if (matchId === null) {
    return <LobbyPage session={session} api={api} onEnterMatch={enter} onLogout={logout} />;
  }

  return <MatchPage key={matchId} session={session} matchId={matchId} onLeave={leave} />;
};
