/**
 * Update 2026-10-29:
 *  - monsters from the game (Eldoria, PixelLab sprites) wander along the bottom of the page; click one to knock it
 *    out with its in-game launch or shatter animation. A monster that walks into a button dies the same way, so
 *    buttons are never covered (user 2026-10-29). A toggle hides them (remembered per visitor).
 *  - gameplay video chapters jump the video to their time.
 */
(() => {
    // sheet pixels -> screen pixels (the sprites are 192/256 px frames)
    const SCALE = window.innerWidth < 700 ? 0.42 : 0.5;
    const WALK_FPS = 10, DIE_FPS = 14;
    const TYPES = ['Goblin', 'GoblinBomber', 'BriarBoar', 'ThornbackWolf', 'BarrowSkeleton', 'ThornSprite', 'LizardSpearman'];

    function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

    // ---- gameplay chapters ----
    function chapters() {
        const video = document.getElementById('gameplayVideo');
        const list = document.getElementById('gameplayChapters');
        if (!video || !list) return;
        const items = [...list.querySelectorAll('li[data-t]')];
        items.forEach(li => {
            li.tabIndex = 0;
            const go = () => { video.currentTime = Number(li.dataset.t); video.play().catch(() => {}); };
            li.addEventListener('click', go);
            li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        });
        video.addEventListener('timeupdate', () => {
            let cur = null;
            items.forEach(li => { if (video.currentTime >= Number(li.dataset.t)) cur = li; });
            items.forEach(li => li.classList.toggle('is-current', li === cur));
        });
    }

    // ---- wandering monsters ----
    function monsters(sheets) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const layer = document.createElement('div');
        layer.className = 'monster-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);

        const toggle = document.createElement('button');
        toggle.className = 'monster-toggle';
        toggle.type = 'button';
        document.body.appendChild(toggle);
        let hidden = storageGet('tbs_monsters_hidden') === '1';
        const label = () => {
            toggle.innerHTML = hidden
                ? '<span class="lang-th">แสดงมอนสเตอร์</span><span class="lang-en">Show monsters</span>'
                : '<span class="lang-th">ซ่อนมอนสเตอร์</span><span class="lang-en">Hide monsters</span>';
            layer.style.display = hidden ? 'none' : '';
        };
        toggle.addEventListener('click', () => { hidden = !hidden; storageSet('tbs_monsters_hidden', hidden ? '1' : '0'); label(); });
        label();

        const count = () => (window.innerWidth < 700 ? 3 : 5);
        const list = [];

        function spawn(fromEdge) {
            const type = TYPES[Math.floor(Math.random() * TYPES.length)];
            const walk = sheets[type + '_walk'];
            if (!walk) return;
            const size = Math.round(walk.w * SCALE);
            const el = document.createElement('div');
            el.className = 'monster';
            el.style.width = el.style.height = size + 'px';
            el.style.backgroundImage = `url(assets/monsters/${type}_walk.png)`;
            el.style.backgroundSize = `${walk.n * size}px ${size}px`;
            layer.appendChild(el);
            const w = window.innerWidth;
            const dir = Math.random() < 0.5 ? 1 : -1;
            const m = {
                type, el, size, dir, n: walk.n, frame: 0, t: 0, dead: false,
                x: fromEdge ? (dir > 0 ? -size : w) : Math.random() * (w - size),
                speed: 28 + Math.random() * 34, pause: 0
            };
            el.addEventListener('click', () => knockOut(m));
            list.push(m);
        }

        // buttons and links near the bottom of the screen; a monster that touches one is knocked out
        const BUTTONS = 'a.btn-primary, a.btn-secondary, button:not(.monster-toggle), input, select, .video-play-toggle, .toc-item, .gameplay-chapters li, .social-btn';
        let nextBump = 0;
        let nextButtonKill = 0;   // one button knock-out at a time, so a full-width button doesn't wipe them all out
        function bumpIntoButtons(now) {
            if (now < nextBump) return;
            nextBump = now + 120;
            const h = window.innerHeight;
            const rects = [];
            document.querySelectorAll(BUTTONS).forEach(b => {
                const r = b.getBoundingClientRect();
                if (r.width > 0 && r.bottom > h - 140 && r.top < h) rects.push(r);
            });
            if (!rects.length) return;
            for (const m of list) {
                if (m.dead) continue;
                const left = m.x + m.size * 0.3, right = m.x + m.size * 0.7, top = h - 4 - m.size * 0.65, bottom = h - 4;
                const over = rects.some(r => left < r.right && right > r.left && top < r.bottom && bottom > r.top);
                if (over && now >= nextButtonKill) { nextButtonKill = now + 4000; knockOut(m); continue; }
                // the rest walk past without blocking the button: taps go through to it
                m.el.style.pointerEvents = over ? 'none' : '';
            }
        }

        function knockOut(m) {
            if (m.dead) return;
            m.dead = true;
            m.el.classList.add('is-dead');
            const kind = Math.random() < 0.5 ? 'launch' : 'shatter';
            const sheet = sheets[`${m.type}_${kind}`];
            m.n = sheet.n; m.frame = 0; m.t = 0;
            m.el.style.backgroundImage = `url(assets/monsters/${m.type}_${kind}.png)`;
            m.el.style.backgroundSize = `${sheet.n * m.size}px ${m.size}px`;
            const pop = document.createElement('div');
            pop.className = 'monster-pop';
            pop.textContent = (Math.floor(Math.random() * 9000) + 1000).toLocaleString('en-US') + '!';
            pop.style.left = (m.x + m.size * 0.3) + 'px';
            layer.appendChild(pop);
            setTimeout(() => pop.remove(), 900);
        }

        for (let i = 0; i < count(); i++) spawn(false);

        // the first visit: a small hint, floating over a living monster, that monsters can be clicked
        let hint = null;
        if (storageGet('tbs_monster_hint') !== '1') {
            setTimeout(() => {
                if (hidden) return;
                const tip = document.createElement('div');
                tip.className = 'monster-hint';
                tip.innerHTML = '<span class="lang-th">แตะมอนดูสิ!</span><span class="lang-en">Tap a monster!</span>';
                layer.appendChild(tip);
                hint = { tip, m: null, until: performance.now() + 6000 };
                storageSet('tbs_monster_hint', '1');
            }, 2500);
        }
        function placeHint(now) {
            if (!hint) return;
            if (now > hint.until) { hint.tip.remove(); hint = null; return; }
            if (!hint.m || hint.m.dead) hint.m = list.find(x => !x.dead) || null;
            hint.tip.style.display = hint.m ? '' : 'none';
            if (hint.m) {
                hint.tip.style.left = (hint.m.x + hint.m.size / 2) + 'px';
                hint.tip.style.bottom = (hint.m.size * 0.85) + 'px';
            }
        }

        let last = performance.now();
        function tick(now) {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            if (!hidden && !document.hidden) {
                bumpIntoButtons(now);
                placeHint(now);
                const w = window.innerWidth;
                for (let i = list.length - 1; i >= 0; i--) {
                    const m = list[i];
                    m.t += dt;
                    if (m.dead) {
                        const f = Math.floor(m.t * DIE_FPS);
                        if (f >= m.n) {
                            m.el.style.opacity = Math.max(0, 1 - (m.t - m.n / DIE_FPS) / 0.6);
                            if (m.t > m.n / DIE_FPS + 0.6) {
                                m.el.remove();
                                list.splice(i, 1);
                                setTimeout(() => { if (list.length < count()) spawn(true); }, 2500 + Math.random() * 3000);
                            }
                            continue;
                        }
                        m.frame = f;
                    } else if (m.pause > 0) {
                        m.pause -= dt;
                        m.frame = 0;
                    } else {
                        m.x += m.dir * m.speed * dt;
                        m.frame = Math.floor(m.t * WALK_FPS) % m.n;
                        if (m.x < -m.size * 0.5) { m.x = -m.size * 0.5; m.dir = 1; }
                        if (m.x > w - m.size * 0.5) { m.x = w - m.size * 0.5; m.dir = -1; }
                        if (Math.random() < dt * 0.12) m.pause = 0.8 + Math.random() * 1.8;
                        else if (Math.random() < dt * 0.06) m.dir *= -1;
                    }
                    m.el.style.backgroundPosition = `${-m.frame * m.size}px 0`;
                    m.el.style.transform = `translateX(${m.x}px) scaleX(${m.dir})`;
                }
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    document.addEventListener('DOMContentLoaded', () => {
        chapters();
        fetch('assets/monsters/sheets.json').then(r => r.json()).then(monsters).catch(() => {});
    });
})();
