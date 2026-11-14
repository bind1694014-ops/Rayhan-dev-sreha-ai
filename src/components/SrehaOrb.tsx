import React, { useEffect, useRef } from 'react';
import { EmotionType } from '../types/sreha';
import { EMOTION_META } from '../utils/emotion';

interface SrehaOrbProps {
  emotion: EmotionType;
  isCryingEffect?: boolean;
  isSpeaking?: boolean;
  isListening?: boolean;
  audioLevel?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const SrehaOrb: React.FC<SrehaOrbProps> = ({
  emotion,
  isCryingEffect = false,
  isSpeaking = false,
  isListening = false,
  audioLevel = 0,
  size = 'lg',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meta = EMOTION_META[emotion] || EMOTION_META.Calm;

  const pixelSize = size === 'sm' ? 68 : size === 'md' ? 140 : 204;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = pixelSize * dpr;
    canvas.height = pixelSize * dpr;
    ctx.scale(dpr, dpr);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, pixelSize, pixelSize);
      const cx = pixelSize / 2;
      const cy = pixelSize / 2;
      const baseRadius = pixelSize * 0.31;

      const dynamicBoost =
        (isSpeaking ? 0.16 : isListening ? 0.09 : 0) + Math.min(audioLevel, 1) * 0.22;
      const pulse = prefersReducedMotion
        ? 0
        : Math.sin(phase * meta.pulseSpeed) * 3.5 * meta.waveAmplitude;
      const r = baseRadius * (1 + dynamicBoost) + pulse;

      // Soft outer aura
      const aura = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.55);
      aura.addColorStop(0, meta.glowRgba);
      aura.addColorStop(0.65, meta.glowRgba.replace(/[\d.]+\)$/, '0.12)'));
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // Organic fluid orb core
      ctx.save();
      ctx.beginPath();
      const points = 64;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = prefersReducedMotion
          ? 0
          : Math.sin(angle * 3 + phase * 1.8) * 2.2 * meta.waveAmplitude +
            Math.cos(angle * 5 - phase * 1.2) * (1.2 + audioLevel * 6);
        const px = cx + Math.cos(angle) * (r + wobble);
        const py = cy + Math.sin(angle) * (r + wobble);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const coreGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      coreGrad.addColorStop(0, meta.primaryColor);
      coreGrad.addColorStop(1, meta.secondaryColor);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Specular inner rim
      const highlight = ctx.createRadialGradient(
        cx - r * 0.32,
        cy - r * 0.35,
        2,
        cx,
        cy,
        r
      );
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      highlight.addColorStop(0.45, 'rgba(255, 255, 255, 0.12)');
      highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlight;
      ctx.fill();
      ctx.restore();

      // Gentle expressive eyes / shimmer inside the orb
      if (size !== 'sm') {
        const eyeY = cy - r * 0.06;
        const eyeOffsetX = r * 0.28;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';

        if (emotion === 'Happy' || emotion === 'Playful') {
          ctx.lineWidth = 2.6;
          ctx.strokeStyle = 'rgba(255,255,255,0.92)';
          ctx.lineCap = 'round';
          [-1, 1].forEach((dir) => {
            ctx.beginPath();
            ctx.arc(cx + dir * eyeOffsetX, eyeY + 2, 5.5, Math.PI, 0, false);
            ctx.stroke();
          });
        } else {
          [-1, 1].forEach((dir) => {
            ctx.beginPath();
            const ry = emotion === 'Sad' || emotion === 'Worried' ? 3.5 : 5;
            ctx.ellipse(cx + dir * eyeOffsetX, eyeY, 3.8, ry, 0, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Presentation-only crying shimmer droplets
        if (isCryingEffect) {
          const dropOffset = prefersReducedMotion ? 8 : (phase * 14) % 16;
          ctx.fillStyle = 'rgba(186, 230, 253, 0.88)';
          [-1, 1].forEach((dir) => {
            ctx.beginPath();
            ctx.arc(cx + dir * eyeOffsetX, eyeY + 9 + dropOffset, 2.3, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      if (!prefersReducedMotion) {
        phase += 0.032;
        rafId = requestAnimationFrame(render);
      }
    };

    render();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [emotion, isCryingEffect, isSpeaking, isListening, audioLevel, pixelSize, meta, size]);

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center select-none"
      data-testid="sreha-orb"
      data-emotion={emotion}
    >
      <canvas
        ref={canvasRef}
        style={{ width: pixelSize, height: pixelSize }}
        aria-label={`SREHA AI Orb showing ${emotion} expression`}
      />
    </div>
  );
};
