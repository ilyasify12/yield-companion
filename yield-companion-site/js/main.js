// ── Footer year ────────────────────────────────────────────────────
document.getElementById('year').textContent = new Date().getFullYear();

// ── Download tracking ──────────────────────────────────────────────
let downloadCount = 0;
document.querySelectorAll('[id^="downloadBtn"]').forEach(btn => {
  btn.addEventListener('click', () => {
    downloadCount++;
    console.log(`Download initiated (${downloadCount} total)`);
  });
});

// ── Scroll progress bar ─────────────────────────────────────────────
const progressBar = document.getElementById('progressBar');
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = `scaleX(${window.scrollY / h})`;
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

// ── Cursor glow follower ────────────────────────────────────────────
const glow = document.getElementById('cursorGlow');
if (glow) {
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let cx = mx, cy = my;
  let animId = null;

  function tickGlow() {
    cx += (mx - cx) * 0.08;
    cy += (my - cy) * 0.08;
    glow.style.left = cx + 'px';
    glow.style.top = cy + 'px';
    animId = null;
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    if (!animId) animId = requestAnimationFrame(tickGlow);
  });
}

// ── Magnetic button ─────────────────────────────────────────────────
document.querySelectorAll('.btn-primary').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const dist = Math.sqrt(x * x + y * y);
    const maxDist = 150;
    const strength = Math.min(1, (maxDist - Math.min(dist, maxDist)) / maxDist);
    btn.style.setProperty('--mx', `${(e.clientX - rect.left) / rect.width * 100}%`);
    btn.style.setProperty('--my', `${(e.clientY - rect.top) / rect.height * 100}%`);
    btn.style.transform =
      `translate(${x * 0.12 * strength}px, ${y * 0.12 * strength}px) translateY(-3px) scale(1.03)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
  });
});

// ── Nav scroll effect ───────────────────────────────────────────────
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
}, { passive: true });

// ── 3D Tilt on feature cards ────────────────────────────────────────
document.querySelectorAll('.feature-card').forEach(card => {
  let isHovering = false;
  card.addEventListener('mouseenter', () => { isHovering = true; });
  card.addEventListener('mousemove', e => {
    if (!isHovering) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    card.style.transform =
      `perspective(800px) rotateX(${((y - centerY) / centerY) * -6}deg) rotateY(${((x - centerX) / centerX) * 6}deg) translateY(-8px) scale(1.015)`;
  });
  card.addEventListener('mouseleave', () => {
    isHovering = false;
    card.style.transform = '';
  });
});

// ── Hero parallax orbs ──────────────────────────────────────────────
const orbs = document.querySelectorAll('.hero-orb');
window.addEventListener('scroll', () => {
  const sy = window.scrollY;
  const max = 300;
  const pct = Math.min(1, sy / max);
  orbs.forEach((orb, i) => {
    const dir = i === 0 ? -1 : 1;
    const yOff = pct * 60 * dir;
    // Use marginTop to avoid overwriting CSS animation transform
    orb.style.marginTop = `${yOff}px`;
  });
}, { passive: true });

// ── Particle canvas ─────────────────────────────────────────────────
(function createParticles() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const particles = [];
  let animId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const count = Math.min(40, Math.floor((canvas.width * canvas.height) / 25000));

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.3,
      speedX: (Math.random() - 0.5) * 0.25,
      speedY: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.25 + 0.04,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 139, 250, ${p.opacity})`;
      ctx.fill();
    }

    // Draw connections — only check particles within 100px
    const maxDist = 100;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distSq = dx * dx + dy * dy;
        if (distSq < maxDist * maxDist) {
          const dist = Math.sqrt(distSq);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(167, 139, 250, ${0.04 * (1 - dist / maxDist)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    animId = requestAnimationFrame(draw);
  }
  draw();
})();

// ── Entry animation on load ─────────────────────────────────────────
(function entryAnim() {
  const els = document.querySelectorAll(
    '.hero-badge, .hero h1, .hero p, .hero-cta, .hero-features-mini, .voice-ui'
  );
  els.forEach((el, i) => {
    el.classList.add('entry-hidden');
    el.style.transition =
      `opacity 0.7s ease ${i * 0.1}s, transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.1}s`;
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      els.forEach(el => el.classList.remove('entry-hidden'));
    });
  });
})();

// ── Scroll reveal ───────────────────────────────────────────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.feature-card').forEach((card, i) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(30px)';
  card.style.transition =
    `opacity 0.7s ease ${i * 0.08}s, transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.08}s`;
  observer.observe(card);
});

document.querySelectorAll('.step, .req-item').forEach((el, i) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = `opacity 0.5s ease ${i * 0.06}s, transform 0.5s ease ${i * 0.06}s`;
  observer.observe(el);
});
