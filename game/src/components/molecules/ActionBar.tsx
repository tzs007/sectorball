import { Button } from '../atoms/Button';

export type ActionBarProps = {
  readonly canDeclareShot: boolean;
  readonly keeperSetup: boolean;
  readonly onDeclareShot: () => void;
  readonly onConfirmKeeper: () => void;
};

export const ActionBar = ({ canDeclareShot, keeperSetup, onDeclareShot, onConfirmKeeper }: ActionBarProps) => (
  <div className="action-bar">
    <Button onClick={onDeclareShot} disabled={!canDeclareShot}>
      Kapu!
    </Button>
    {keeperSetup && (
      <Button variant="secondary" onClick={onConfirmKeeper}>
        Kapus kész
      </Button>
    )}
  </div>
);
