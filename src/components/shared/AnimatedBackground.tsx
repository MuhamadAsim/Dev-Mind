'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Animated mesh gradient background used on the login page.
 * Pure CSS + Canvas — no external dependencies.
 */
export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const orbs = [
      { x: 0.2, y: 0.2, r: 0.35, color: '#6366f1', speed: 0.0003 },
      { x: 0.8, y: 0.3, r: 0.3,  color: '#8b5cf6', speed: 0.0004 },
      { x: 0.5, y: 0.8, r: 0.32, color: '#a78bfa', speed: 0.00025 },
      { x: 0.1, y: 0.7, r: 0.25, color: '#4f46e5', speed: 0.00035 },
    ];

    const draw = () => {
      t += 1;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#08080f';
      ctx.fillRect(0, 0, w, h);

      for (const orb of orbs) {
        const x = (orb.x + Math.sin(t * orb.speed * 1000) * 0.15) * w;
        const y = (orb.y + Math.cos(t * orb.speed * 800) * 0.1) * h;
        const r = orb.r * Math.min(w, h);

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, orb.color + '22');
        grad.addColorStop(0.5, orb.color + '0a');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      {/* Canvas animation layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.8 }}
        aria-hidden="true"
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, #08080f 100%)',
        }}
        aria-hidden="true"
      />

      {/* Noise texture overlay for depth */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
          opacity: 0.4,
        }}
        aria-hidden="true"
      />
    </>
  );
}
