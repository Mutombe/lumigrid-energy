/* Lumigrid Energy — site interactions. No dependencies. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  window.__lgReady = true;

  /* ------------------------------------------------------------ nav */
  const nav = $('[data-nav]');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    if (!document.body.classList.contains('menu-open')) {
      nav.classList.toggle('is-hidden', y > 400 && y > lastY + 4);
      if (y < lastY - 4) nav.classList.remove('is-hidden');
    }
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    nav.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menu = $('[data-menu]');
  const toggle = $('[data-menu-toggle]');
  const setMenu = open => {
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 800);
    }
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false); });
  $$('.menu__link', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ------------------------------------------------------------ split headings into words */
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'split-w';
            const inner = document.createElement('span');
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            w.append(inner);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          // keep styled spans (e.g. .accent) intact and animate them as one word
          if (n.children.length === 0 && !n.classList.contains('split-w')) {
            const w = document.createElement('span');
            w.className = 'split-w';
            const inner = n.cloneNode(true);
            inner.style.setProperty('--i', i++);
            w.append(inner);
            n.replaceWith(w);
          } else walk(n);
        }
      });
    };
    walk(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  });

  /* ------------------------------------------------------------ reveal on scroll */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  const revealables = $$('[data-reveal], [data-unveil], [data-split], .chart, [data-io]');
  revealables.forEach(el => io.observe(el));
  // Sweep: anything already scrolled past (anchor jumps, fast flings) is revealed too
  let sweepQueued = false, deepest = 0;
  const sweep = () => {
    sweepQueued = false;
    revealables.forEach(el => {
      if (!el.classList.contains('is-in') && el.getBoundingClientRect().top + scrollY < deepest) { el.classList.add('is-in'); io.unobserve(el); }
    });
  };
  addEventListener('scroll', () => {
    deepest = Math.max(deepest, scrollY + innerHeight);
    if (!sweepQueued) { sweepQueued = true; setTimeout(sweep, 120); }
  }, { passive: true });
  addEventListener('load', () => { deepest = Math.max(deepest, scrollY + innerHeight); sweep(); });

  /* ------------------------------------------------------------ scroll-filled statement */
  const fills = $$('[data-fill]');
  fills.forEach(el => {
    const words = [];
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const s = document.createElement('span');
            s.className = 'fw';
            s.textContent = part;
            words.push(s);
            frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el._words = words;
  });

  /* ------------------------------------------------------------ parallax */
  const parallax = $$('[data-parallax]');

  let ticking = false;
  const frame = () => {
    ticking = false;
    const vh = innerHeight;
    fills.forEach(el => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const n = Math.round(p * el._words.length);
      el._words.forEach((w, i) => w.classList.toggle('on', i < n));
    });
    if (!reduce) parallax.forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const speed = parseFloat(el.dataset.parallax) || 0.12;
      const center = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(-center * speed).toFixed(1)}px, 0)`;
    });
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request);
  frame();

  /* ------------------------------------------------------------ counters */
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      const el = e.target;
      const end = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const dur = reduce ? 0 : 1800;
      const t0 = performance.now();
      const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      const step = t => {
        const p = dur ? Math.min(1, (t - t0) / dur) : 1;
        el.textContent = fmt(end * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  $$('[data-count]').forEach(el => countIO.observe(el));

  /* ------------------------------------------------------------ touch: mirror hover as in-view */
  if (touch) {
    const inview = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('is-inview', e.isIntersecting));
    }, { rootMargin: '-38% 0px -38% 0px' });
    $$('.tcard').forEach(el => inview.observe(el));
  }

  /* ------------------------------------------------------------ live clock + sample output */
  const clock = $$('[data-clock]');
  const live = $$('[data-live]');
  const spark = $$('[data-spark]');
  const sparkData = Array.from({ length: 28 }, (_, i) => 0.55 + 0.25 * Math.sin(i / 3) + Math.random() * 0.12);
  const tick = () => {
    const now = new Date();
    const hre = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Harare', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(now);
    clock.forEach(el => { el.textContent = hre; });
    // Sample residential output curve for a 5 kW array by Harare hour of day
    const h = parseFloat(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Harare', hour: 'numeric', hour12: false }).format(now)) + now.getMinutes() / 60;
    const sun = Math.max(0, Math.sin(((h - 6) / 12.5) * Math.PI));
    const kw = (sun * 4.6 + (sun > 0 ? Math.random() * 0.12 : 0)).toFixed(2);
    live.forEach(el => { el.textContent = kw; });
    const pct = Math.round(kw / 5 * 100);
    $$('[data-live-ring]').forEach(c => c.style.setProperty('--off', 100 - pct));
    $$('[data-live-pct]').forEach(el => { el.textContent = pct; });
    sparkData.push(0.55 + 0.25 * Math.sin(sparkData.length / 3) + Math.random() * 0.12);
    sparkData.shift();
    spark.forEach(svg => {
      const d = sparkData.map((v, i) => `${i ? 'L' : 'M'}${(i / (sparkData.length - 1) * 160).toFixed(1)} ${(34 - v * 30).toFixed(1)}`).join(' ');
      svg.querySelector('path').setAttribute('d', d);
    });
  };
  if (clock.length || live.length) { tick(); setInterval(tick, 2500); }

  /* ------------------------------------------------------------ FAQ: animate height */
  $$('.faq__item').forEach(d => {
    const sum = $('summary', d);
    const body = $('.faq__body', d);
    sum.addEventListener('click', e => {
      if (reduce) return;
      e.preventDefault();
      if (d.open) {
        const h = body.offsetHeight;
        body.animate([{ height: h + 'px' }, { height: '0px' }], { duration: 450, easing: 'cubic-bezier(.22,.8,.2,1)' }).onfinish = () => { d.open = false; };
      } else {
        $$('.faq__item[open]', d.parentElement).forEach(o => {
          const ob = $('.faq__body', o);
          ob.animate([{ height: ob.offsetHeight + 'px' }, { height: '0px' }], { duration: 450, easing: 'cubic-bezier(.22,.8,.2,1)' }).onfinish = () => { o.open = false; };
        });
        d.open = true;
        const h = body.offsetHeight;
        body.animate([{ height: '0px' }, { height: h + 'px' }], { duration: 550, easing: 'cubic-bezier(.22,.8,.2,1)' });
      }
    });
  });

  /* ------------------------------------------------------------ drag-to-scroll rails */
  $$('[data-rail]').forEach(rail => {
    const track = $('.rail__track', rail);
    const prev = $('[data-rail-prev]', rail);
    const next = $('[data-rail-next]', rail);
    const bar = $('.rail__progress span', rail);
    const card = () => (track.firstElementChild?.getBoundingClientRect().width || 300) + 16;
    prev?.addEventListener('click', () => track.scrollBy({ left: -card() * 2, behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: card() * 2, behavior: 'smooth' }));
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const p = max > 0 ? track.scrollLeft / max : 0;
      const r = Math.max(.12, track.clientWidth / track.scrollWidth);
      if (bar) bar.style.transform = `translateX(${(p * (1 - r) * 100).toFixed(2)}%) scaleX(${r.toFixed(3)})`;
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft > max - 4;
    };
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();

    let down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 5) { moved = true; track.classList.add('is-drag'); }
      track.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      track.classList.remove('is-drag');
    });
    track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });

  /* ------------------------------------------------------------ lightbox (gallery + slideshow) */
  const lb = $('[data-lightbox]');
  if (lb) {
    const img = $('[data-lb-img]', lb);
    const cap = $('[data-lb-cap]', lb);
    const bar = $('[data-lb-bar]', lb);
    let items = [], idx = 0, timer = null, lastFocus = null;
    const show = i => {
      idx = (i + items.length) % items.length;
      const it = items[idx];
      img.classList.add('is-swap');
      const pre = new Image();
      pre.onload = () => { img.src = it.src; img.alt = it.alt; img.classList.remove('is-swap'); };
      pre.src = it.src;
      cap.textContent = it.cap || '';
    };
    const run = () => {
      clearTimeout(timer);
      if (!lb._auto) return;
      bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run');
      timer = setTimeout(() => { show(idx + 1); run(); }, 4000);
    };
    const open = (list, start, auto) => {
      items = list; lb._auto = auto; lastFocus = document.activeElement;
      lb.hidden = false; document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => lb.classList.add('is-open'));
      show(start); run();
      $('[data-lb-close]', lb).focus();
    };
    const close = () => {
      clearTimeout(timer); bar.classList.remove('run');
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { lb.hidden = true; }, 400);
      lastFocus?.focus();
    };
    $('[data-lb-close]', lb).addEventListener('click', close);
    $('[data-lb-prev]', lb).addEventListener('click', () => { show(idx - 1); run(); });
    $('[data-lb-next]', lb).addEventListener('click', () => { show(idx + 1); run(); });
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') { show(idx - 1); run(); }
      if (e.key === 'ArrowRight') { show(idx + 1); run(); }
      if (e.key === 'Tab') {
        const f = $$('button', lb);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    const collect = group => $$(`[data-gallery="${group}"]`).filter(a => !a.closest('.is-hidden')).map(a => ({ src: a.getAttribute('href'), alt: $('img', a)?.alt || '', cap: a.dataset.cap }));
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-gallery]');
      if (a) {
        e.preventDefault();
        const list = collect(a.dataset.gallery);
        open(list, list.findIndex(x => x.src === a.getAttribute('href')), false);
      }
      const s = e.target.closest('[data-slideshow]');
      if (s) {
        e.preventDefault();
        open(collect(s.dataset.slideshow), 0, true);
      }
    });
  }

  /* ------------------------------------------------------------ testimonial wheel */
  $$('[data-wheel]').forEach(wheel => {
    const cards = $$('.qcard', wheel);
    const knob = $('.knob', wheel);
    const n = cards.length;
    let active = 0, timer;
    const step = 22; // degrees between cards on the arc
    const narrow = matchMedia('(max-width: 600px)');
    narrow.addEventListener('change', () => place());
    const place = () => {
      cards.forEach((c, i) => {
        let off = i - active;
        if (off > n / 2) off -= n;
        if (off < -n / 2) off += n;
        const a = Math.abs(off);
        c.style.transform = narrow.matches
          ? `translateY(-50%) translateX(${off * 108}%)`
          : `translateY(-50%) rotate(${off * step}deg) scale(${1 - a * 0.06})`;
        c.style.opacity = a > 2 ? 0 : a === 0 ? 1 : a === 1 ? .4 : .12;
        c.style.filter = a ? `blur(${a * 0.8}px)` : 'none';
        c.style.zIndex = 10 - a;
        c.setAttribute('aria-hidden', a !== 0);
      });
      if (knob) knob.style.transform = `rotate(${(active / (n - 1) - 0.5) * 50}deg)`;
    };
    const go = d => { active = (active + d + n) % n; place(); };
    const auto = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => go(1), 4200); };
    $('[data-wheel-prev]', wheel.parentElement)?.addEventListener('click', () => { go(-1); auto(); });
    $('[data-wheel-next]', wheel.parentElement)?.addEventListener('click', () => { go(1); auto(); });
    cards.forEach((c, i) => c.addEventListener('click', () => { active = i; place(); auto(); }));
    wheel.addEventListener('mouseenter', () => clearInterval(timer));
    wheel.addEventListener('mouseleave', auto);
    // swipe sideways on phones, where the cards slide horizontally
    let sx = null;
    wheel.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    wheel.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { go(dx < 0 ? 1 : -1); auto(); }
      sx = null;
    });
    place(); auto();
  });

  /* ------------------------------------------------------------ hero carousel card */
  $$('[data-hslides]').forEach(card => {
    const slides = $$('.hslide', card);
    const tabs = $$('.hslides__nav button', card);
    let active = 0;
    const show = i => {
      active = (i + slides.length) % slides.length;
      card.dataset.slide = active;
      slides.forEach((s, j) => {
        const on = j === active;
        s.classList.toggle('is-active', on);
        s.inert = !on;
        s.setAttribute('aria-hidden', !on);
      });
      // restart the fill animation on the newly selected bar
      tabs.forEach((t, j) => t.setAttribute('aria-selected', 'false'));
      void card.offsetWidth;
      tabs[active].setAttribute('aria-selected', 'true');
    };
    tabs.forEach((t, j) => t.addEventListener('click', () => show(j)));
    // the bar's fill animation is the timer, so pausing it pauses the carousel
    card.addEventListener('animationend', e => { if (e.animationName === 'hs-fill') show(active + 1); });
    const pause = on => card.classList.toggle('is-paused', on || reduce);
    card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') pause(true); });
    card.addEventListener('pointerleave', () => pause(false));
    card.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) pause(true); });
    card.addEventListener('focusout', () => pause(false));
    let sx = null;
    card.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) show(active + (dx < 0 ? 1 : -1));
      sx = null;
    });
    // hold the timer until the card is on screen
    const vis = new IntersectionObserver(es => card.classList.toggle('is-off', !es[0].isIntersecting));
    vis.observe(card);
    show(0); pause(false);
  });

  /* ------------------------------------------------------------ Zimbabwe map */
  $$('[data-zim]').forEach(map => {
    const svg = $('svg', map);
    const dots = $$('.zim-map__dots circle', svg);
    const vb = svg.viewBox.baseVal;
    const cities = JSON.parse(map.dataset.zim);
    const hq = cities.Harare;
    const inner = $('.zim-map__inner', map);
    Object.entries(cities).forEach(([name, [x, y]]) => {
      const pin = document.createElement('div');
      pin.className = 'zim-pin' + (name === 'Harare' ? ' zim-pin--hq' : '');
      pin.style.left = `${x / vb.width * 100}%`;
      pin.style.top = `${y / vb.height * 100}%`;
      pin.dataset.city = name;
      pin.innerHTML = `<i></i><span>${name === 'Harare' ? 'Harare · Head office' : name}</span>`;
      inner.append(pin);
    });
    // light the dots outward from Harare once the map is in view
    const light = () => {
      dots.forEach(d => {
        const dx = d.cx.baseVal.value - hq[0], dy = d.cy.baseVal.value - hq[1];
        const dist = Math.hypot(dx, dy);
        const cls = dist < 70 ? 'lit' : dist < 180 ? 'lit-2' : dist < 330 && Math.random() > .55 ? 'lit-3' : '';
        if (!cls) return;
        setTimeout(() => d.classList.add(cls), reduce ? 0 : dist * 4.5);
      });
    };
    const mio = new IntersectionObserver(es => { if (es[0].isIntersecting) { light(); mio.disconnect(); } }, { threshold: 0.3 });
    mio.observe(map);
    // hovering a city in the list highlights its pin
    $$('[data-city]', document).forEach(li => {
      if (li.classList.contains('zim-pin')) return;
      li.addEventListener('mouseenter', () => $(`.zim-pin[data-city="${li.dataset.city}"]`, map)?.classList.add('is-hot'));
      li.addEventListener('mouseleave', () => $(`.zim-pin[data-city="${li.dataset.city}"]`, map)?.classList.remove('is-hot'));
    });
  });

  /* ------------------------------------------------------------ project filters */
  $$('[data-filters]').forEach(group => {
    const target = $(group.dataset.filters);
    $$('button', group).forEach(b => {
      const f = b.dataset.filter;
      const n = $$('.pcard', target).filter(c => f === 'all' || c.dataset.type === f).length;
      b.insertAdjacentHTML('beforeend', `<span class="filters__n" aria-hidden="true">${n}</span>`);
    });
    $$('button', group).forEach(b => b.addEventListener('click', () => {
      $$('button', group).forEach(x => x.setAttribute('aria-pressed', x === b));
      const f = b.dataset.filter;
      $$('.pcard', target).forEach(c => c.classList.toggle('is-hidden', f !== 'all' && c.dataset.type !== f));
    }));
  });

  /* ------------------------------------------------------------ magnetic buttons */
  if (!touch && !reduce) $$('.btn--amber').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.18;
      const y = (e.clientY - r.top - r.height / 2) * 0.25;
      b.style.translate = `${x}px ${y}px`;
    });
    b.addEventListener('pointerleave', () => { b.style.translate = ''; });
  });

  /* ------------------------------------------------------------ quote form → WhatsApp / email */
  $$('[data-quote]').forEach(form => {
    const pkg = new URLSearchParams(location.search).get('package');
    if (pkg) {
      const opt = [...form.system.options].find(o => o.value === pkg);
      if (opt) opt.selected = true;
    }
    const compose = () => {
      const f = Object.fromEntries(new FormData(form));
      return [
        'Hi Lumigrid, I would like a solar quote.',
        `Name: ${f.name}`,
        `Phone: ${f.phone}`,
        f.email && `Email: ${f.email}`,
        f.area && `Location: ${f.area}`,
        `Property: ${f.property}`,
        `Interested in: ${f.system}`,
        f.message && `Needs: ${f.message}`,
      ].filter(Boolean).join('\n');
    };
    const valid = () => {
      let ok = true;
      ['name', 'phone'].forEach(n => {
        const i = form.elements[n];
        const bad = !i.value.trim();
        i.setAttribute('aria-invalid', bad);
        i.style.borderColor = bad ? '#d64545' : '';
        if (bad && ok) { i.focus(); ok = false; }
      });
      return ok;
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!valid()) return;
      window.open(`https://wa.me/263779056541?text=${encodeURIComponent(compose())}`, '_blank', 'noopener');
      $('[data-quote-ok]', form)?.classList.add('is-on');
    });
    $('[data-quote-mail]', form)?.addEventListener('click', e => {
      if (!valid()) { e.preventDefault(); return; }
      e.currentTarget.href = `mailto:info@lumigridenergy.co.zw?subject=${encodeURIComponent('Solar quote request')}&body=${encodeURIComponent(compose())}`;
    });
  });

  /* ------------------------------------------------------------ misc */
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
