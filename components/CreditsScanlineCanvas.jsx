"use client";

import { useEffect, useRef } from "react";

const SWEEP_SEC = 6.5;

function drawScanline(ctx, w, h, y) {
  ctx.clearRect(0, 0, w, h);

  const band = ctx.createLinearGradient(0, y - 28, 0, y + 28);
  band.addColorStop(0, "transparent");
  band.addColorStop(0.35, "rgba(94, 170, 255, 0.04)");
  band.addColorStop(0.5, "rgba(94, 170, 255, 0.16)");
  band.addColorStop(0.65, "rgba(94, 170, 255, 0.04)");
  band.addColorStop(1, "transparent");
  ctx.fillStyle = band;
  ctx.fillRect(0, y - 28, w, 56);

  ctx.fillStyle = "rgba(94, 170, 255, 0.82)";
  ctx.fillRect(0, y, w, 1);
}

export default function CreditsScanlineCanvas({ active = true }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
    if (active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const frame = (now) => {
      rafId = requestAnimationFrame(frame);
      if (!activeRef.current) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const phase = ((now - start) / 1000 / SWEEP_SEC) % 1;
      const y = phase * (h + 56) - 28;
      drawScanline(ctx, w, h, y);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="creditsScanlineCanvas"
      aria-hidden
    />
  );
}
