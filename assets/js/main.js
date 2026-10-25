/* =========================================================
   METHOD — interactions
   ========================================================= */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const themeToggle = $('#themeToggle');
  const storedTheme = localStorage.getItem('method-theme');
  const setTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('method-theme', theme);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f7f7fb' : '#05060a');
  };
  setTheme(storedTheme || 'dark');

  themeToggle?.addEventListener('click', () => {
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------- Preloader ---------- */
  const preloader = $('#preloader');
  const hidePreloader = () => {
    preloader?.classList.add('is-done');
    document.body.classList.add('is-ready');
    revealVisible();
  };
  if (document.readyState === 'complete') {
    setTimeout(hidePreloader, 500);
  } else {
    window.addEventListener('load', () => setTimeout(hidePreloader, 1250));
  }
  // 兜底：即使资源加载失败也不要卡住页面
  setTimeout(() => preloader?.classList.add('is-done'), 4200);

  /* ---------- Reveal on scroll ---------- */
  const revealItems = $$('[data-reveal]');
  // 同一父容器内的元素做轻微错峰
  $$('.bento, .stats, .steps, .plans, .showcase').forEach((group) => {
    $$(':scope > [data-reveal]', group).forEach((el, i) => {
      el.style.setProperty('--delay', `${i * 70}ms`);
    });
  });

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    : null;

  function revealVisible() {
    revealItems.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) {
        el.classList.add('is-in');
      }
    });
  }
  if (revealObserver) revealItems.forEach((el) => revealObserver.observe(el));
  else revealItems.forEach((el) => el.classList.add('is-in'));

  /* ---------- Counters ---------- */
  const animateCount = (el) => {
    const target = Number(el.dataset.count || 0);
    const suffix = el.dataset.suffix || '';
    const duration = reduceMotion ? 0 : 1600;
    const start = performance.now();
    const fmt = (n) => n >= 1000 ? n.toLocaleString('en-US') : String(n);

    const tick = (now) => {
      const p = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const counterObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.6 })
    : null;
  $$('[data-count]').forEach((el) => {
    if (counterObserver) counterObserver.observe(el);
    else animateCount(el);
  });

  /* ---------- Typewriter ---------- */
  const typedEl = $('#typed');
  const phrases = ['表达', '协作', '发布', '被看见'];
  if (typedEl) {
    let phraseIndex = 0, charIndex = 0, deleting = false;
    const step = () => {
      const word = phrases[phraseIndex];
      typedEl.textContent = word.slice(0, charIndex);
      if (!deleting && charIndex < word.length) {
        charIndex++;
        setTimeout(step, 95);
      } else if (!deleting) {
        deleting = true;
        setTimeout(step, 1700);
      } else if (charIndex > 0) {
        charIndex--;
        setTimeout(step, 48);
      } else {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(step, 320);
      }
    };
    if (reduceMotion) typedEl.textContent = phrases[0];
    else setTimeout(step, 1600);
  }

  /* ---------- Nav: scroll state + progress + active section ---------- */
  const nav = $('#nav');
  const progress = $('#scrollProgress');
  const toTop = $('#toTop');
  const sections = $$('main section[id]');

  const onScroll = () => {
    const y = window.scrollY;
    nav?.classList.toggle('is-scrolled', y > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
    toTop?.classList.toggle('is-visible', y > 700);
  };
  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(() => { onScroll(); scrollTicking = false; });
      scrollTicking = true;
    }
  }, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window && sections.length) {
    const navLinks = $$('.nav__links a');
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => {
            link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => sectionObserver.observe(s));
  }

  toTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- Mobile menu ---------- */
  const burger = $('#burger');
  const navLinks = $('#navLinks');
  const closeMenu = () => {
    burger?.classList.remove('is-open');
    navLinks?.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('lock');
  };
  burger?.addEventListener('click', () => {
    const open = !navLinks?.classList.contains('is-open');
    navLinks?.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('lock', open);
  });
  navLinks?.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu();
  });

  /* ---------- Magnetic buttons ---------- */
  if (!isTouch && !reduceMotion) {
    $$('[data-magnetic]').forEach((btn) => {
      const strength = 18;
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        btn.style.transform = `translate(${x * strength}px, ${y * strength * 0.6}px)`;
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ---------- Cards: spotlight + tilt ---------- */
  if (!isTouch && !reduceMotion) {
    $$('[data-tilt]').forEach((card) => {
      const tilt = 5;
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * tilt}deg) rotateY(${(px - 0.5) * tilt}deg)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });

    /* ---------- Hero orb parallax ---------- */
    const orbWrap = $('#orbWrap');
    if (orbWrap) {
      const layers = $$('[data-depth]', orbWrap);
      window.addEventListener('pointermove', (e) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        layers.forEach((layer) => {
          const d = Number(layer.dataset.depth || 1);
          layer.style.transform = `translate3d(${dx * d * 10}px, ${dy * d * 8}px, 0)`;
        });
      }, { passive: true });
    }
  }

  /* ---------- Global cursor glow ---------- */
  const glow = $('#cursorGlow');
  if (!isTouch && glow) {
    document.body.classList.add('has-pointer');
    let gx = window.innerWidth / 2, gy = window.innerHeight / 2;
    let tx = gx, ty = gy;
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
    }, { passive: true });
    const loop = () => {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- Pricing billing switch ---------- */
  const billingSwitch = $('#billingSwitch');
  const billingLabels = $$('.billing__label');
  const amountEls = $$('.plan__price .amount');
  let yearly = false;

  const updateBilling = () => {
    billingSwitch?.setAttribute('aria-checked', String(yearly));
    billingLabels.forEach((l) => {
      l.classList.toggle('is-active', l.dataset.billing === (yearly ? 'yearly' : 'monthly'));
    });
    amountEls.forEach((el) => {
      const target = Number(el.dataset[yearly ? 'yearly' : 'monthly'] || 0);
      const from = Number(el.textContent.replace(/[^\d]/g, '')) || 0;
      const start = performance.now();
      const duration = reduceMotion ? 0 : 420;
      const tick = (now) => {
        const p = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(from + (target - from) * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };
  billingSwitch?.addEventListener('click', () => {
    yearly = !yearly;
    updateBilling();
  });
  billingLabels.forEach((label) => {
    label.addEventListener('click', () => {
      yearly = label.dataset.billing === 'yearly';
      updateBilling();
    });
  });

  /* ---------- FAQ: accordion ---------- */
  $$('.faq').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        $$('.faq').forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* ---------- Modal ---------- */
  const videoModal = $('#videoModal');
  const openModal = () => {
    videoModal?.classList.add('is-open');
    videoModal?.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('lock');
  };
  const closeModal = () => {
    videoModal?.classList.remove('is-open');
    videoModal?.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('lock');
  };
  $('#watchBtn')?.addEventListener('click', openModal);
  $$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeModal));

  /* ---------- Command palette ---------- */
  const palette = $('#palette');
  const paletteInput = $('#paletteInput');
  const paletteList = $('#paletteList');
  const paletteBtn = $('#paletteBtn');

  const icon = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke-linecap="round"/></svg>',
    top: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  };

  const commands = [
    { label: '能力 · 一个工作台', hint: '页面', icon: icon.arrow, action: () => go('#features') },
    { label: '案例 · 作品展示', hint: '页面', icon: icon.arrow, action: () => go('#showcase') },
    { label: '流程 · 从想法到上线', hint: '页面', icon: icon.arrow, action: () => go('#process') },
    { label: '定价 · 选择方案', hint: '页面', icon: icon.arrow, action: () => go('#pricing') },
    { label: '问答 · 常见问题', hint: '页面', icon: icon.arrow, action: () => go('#faq') },
    { label: '切换明暗主题', hint: '外观', icon: icon.sun, action: () => {
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      closePalette();
    } },
    { label: '观看产品演示', hint: '视频', icon: icon.play, action: openModal },
    { label: '回到顶部', hint: '导航', icon: icon.top, action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
  ];

  let filtered = commands;
  let activeIndex = 0;

  function go(hash) {
    const el = $(hash);
    closePalette();
    if (el) setTimeout(() => el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }), 80);
  }

  function renderPalette(query = '') {
    const q = query.trim().toLowerCase();
    filtered = commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
    activeIndex = 0;
    if (!filtered.length) {
      paletteList.innerHTML = `<div class="palette__empty">没有找到「${escapeHtml(query)}」相关命令</div>`;
      return;
    }
    paletteList.innerHTML = filtered.map((c, i) => `
      <button class="palette__item ${i === 0 ? 'is-active' : ''}" data-index="${i}">
        ${c.icon}<span>${c.label}</span><small>${c.hint}</small>
      </button>
    `).join('');
    $$('.palette__item', paletteList).forEach((item) => {
      item.addEventListener('click', () => filtered[Number(item.dataset.index)].action());
    });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function openPalette() {
    if (!palette) return;
    palette.classList.add('is-open');
    palette.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('lock');
    renderPalette('');
    if (paletteInput) {
      paletteInput.value = '';
      setTimeout(() => paletteInput.focus(), 60);
    }
  }
  function closePalette() {
    palette?.classList.remove('is-open');
    palette?.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('lock');
  }
  function setActive(index) {
    const items = $$('.palette__item', paletteList);
    items.forEach((item, i) => item.classList.toggle('is-active', i === index));
    items[index]?.scrollIntoView({ block: 'nearest' });
  }

  paletteBtn?.addEventListener('click', openPalette);
  $$('[data-close-palette]').forEach((el) => el.addEventListener('click', closePalette));
  paletteInput?.addEventListener('input', (e) => renderPalette(e.target.value));
  paletteInput?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      setActive(activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      setActive(activeIndex);
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      filtered[activeIndex].action();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette?.classList.contains('is-open') ? closePalette() : openPalette();
    }
    if (e.key === 'Escape') {
      if (palette?.classList.contains('is-open')) closePalette();
      if (videoModal?.classList.contains('is-open')) closeModal();
      closeMenu();
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      openPalette();
    }
  });

  /* ---------- Particle network ---------- */
  const canvas = $('#particles');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, dpr = 1;
    let dots = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots();
    };

    const buildDots = () => {
      const count = Math.min(90, Math.max(26, Math.floor((width * height) / 26000)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: Math.random() * 1.5 + 0.5,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const isLight = root.getAttribute('data-theme') === 'light';
      const dotColor = isLight ? 'rgba(60,50,140,' : 'rgba(190,200,255,';
      const lineColor = isLight ? 'rgba(90,80,180,' : 'rgba(140,160,255,';

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.x += d.vx;
        d.y += d.vy;

        if (d.x < 0 || d.x > width) d.vx *= -1;
        if (d.y < 0 || d.y > height) d.vy *= -1;

        // 鼠标轻微排斥
        if (mouse.active) {
          const dx = d.x - mouse.x;
          const dy = d.y - mouse.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 16000 && dist2 > 0) {
            const dist = Math.sqrt(dist2);
            const force = (1 - dist / 126) * 0.55;
            d.x += (dx / dist) * force;
            d.y += (dy / dist) * force;
          }
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `${dotColor}0.55)`;
        ctx.fill();

        for (let j = i + 1; j < dots.length; j++) {
          const o = dots[j];
          const dx = d.x - o.x;
          const dy = d.y - o.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(o.x, o.y);
            ctx.strokeStyle = `${lineColor}${(1 - dist / 130) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // 连接鼠标
        if (mouse.active) {
          const md = Math.hypot(d.x - mouse.x, d.y - mouse.y);
          if (md < 180) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `${lineColor}${(1 - md / 180) * 0.28})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    let raf;
    resize();
    if (!reduceMotion) {
      draw();
      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
      }, { passive: true });
      window.addEventListener('pointerleave', () => { mouse.active = false; });
    } else {
      // 静态绘制一次
      draw();
      cancelAnimationFrame(raf);
    }
  }

  /* ---------- Smooth anchors (fallback 兼容) ---------- */
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') {
        // 占位链接：避免跳回页面顶部
        e.preventDefault();
        return;
      }
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      // 先让菜单/弹层关闭并解除滚动锁定，再执行滚动
      setTimeout(() => {
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }, 30);
      history.replaceState(null, '', hash);
    });
  });

  /* ---------- External links safety ---------- */
  $$('a[target="_blank"]').forEach((a) => a.setAttribute('rel', 'noopener noreferrer'));

})();
