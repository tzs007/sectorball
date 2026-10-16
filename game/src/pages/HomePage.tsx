import { MainLayout } from '../components/templates/MainLayout';
import { GameCanvas } from '../components/organisms/GameCanvas';

export const HomePage = () => (
  <MainLayout title="Sectorball">
    <GameCanvas />
  </MainLayout>
);
