import { Application, extend } from '@pixi/react';
import { Container, Graphics } from 'pixi.js';
import { useRef } from 'react';
import { Ball } from '../atoms/Ball';
import { BALL, PITCH } from '../../constants/game';

extend({ Container, Graphics });

export const GameCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="game-canvas">
      <Application resizeTo={containerRef} background={PITCH.background} antialias>
        <pixiContainer x={PITCH.padding} y={PITCH.padding}>
          <Ball radius={BALL.radius} color={BALL.color} x={100} y={100} />
        </pixiContainer>
      </Application>
    </div>
  );
};
