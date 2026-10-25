export function triggerConfetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.getElementById("fx");
  if (!c) return;
  const x = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  c.width = W * dpr;
  c.height = H * dpr;
  x.scale(dpr, dpr);

  const cols = ["#2F3CFF", "#FF6B1A", "#FF5C9A", "#5FE3B2", "#0B1040", "#fff"];
  const ps = [];
  for (let i = 0; i < 110; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const sp = 9 + Math.random() * 13;
    ps.push({
      x: W / 2,
      y: H * 0.62,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      w: 6 + Math.random() * 7,
      h: 4 + Math.random() * 6,
      r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      c: cols[i % cols.length],
    });
  }

  const t0 = performance.now();
  function f(now) {
    const el = now - t0;
    x.clearRect(0, 0, W, H);
    ps.forEach((p) => {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.r);
      x.fillStyle = p.c;
      x.strokeStyle = "#0B1040";
      x.lineWidth = 1.5;
      x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.restore();
    });
    if (el < 2600) {
      requestAnimationFrame(f);
    } else {
      x.clearRect(0, 0, W, H);
    }
  }
  requestAnimationFrame(f);
}
