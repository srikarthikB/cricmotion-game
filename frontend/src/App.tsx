import { useGameStore } from './stores/useGameStore';
import { Layout } from './components/Layout';
import { SplashScreen } from './pages/SplashScreen';
import { AuthScreen } from './pages/AuthScreen';
import { Dashboard } from './pages/Dashboard';
import { MatchSettingsScreen } from './pages/MatchSettingsScreen';
import { CalibrationScreen } from './pages/CalibrationScreen';
import { GameplayScreen } from './pages/GameplayScreen';
import { PauseMenu } from './components/PauseMenu';
import { MatchSummaryScreen } from './pages/MatchSummaryScreen';
import { StatsScreen } from './pages/StatsScreen';
import { TournamentScreen } from './pages/TournamentScreen';
import { SettingsScreen } from './pages/SettingsScreen';

export default function App() {
  const currentState = useGameStore((state) => state.currentState);

  const renderScreen = () => {
    switch (currentState) {
      case 'SPLASH':
        return <SplashScreen />;
      case 'AUTH':
        return <AuthScreen />;
      case 'DASHBOARD':
        return <Dashboard />;
      case 'MATCH_SETTINGS':
        return <MatchSettingsScreen />;
      case 'CALIBRATION':
        return <CalibrationScreen />;
      case 'PLAY':
      case 'PAUSE':
        return (
          <>
            <GameplayScreen />
            {currentState === 'PAUSE' && <PauseMenu />}
          </>
        );
      case 'SUMMARY':
        return <MatchSummaryScreen />;
      case 'STATS':
        return <StatsScreen />;
      case 'TOURNAMENT':
        return <TournamentScreen />;
      case 'SETTINGS':
        return <SettingsScreen />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout>
      {renderScreen()}
    </Layout>
  );
}
