/**
 * ALPHA CONFIG - edit here only. Times are absolute UTC instants (Bangkok = UTC+7).
 * Download links: paste the URL between the quotes; empty = button shows "coming soon".
 */
const ALPHA_CONFIG = {
    start: '2026-11-19T11:00:00Z',      // Thu 19 Nov 2026 18:00 Bangkok (moved from Tue 17 Nov, owner 2026-11-17)
    end: '2026-12-01T16:59:59Z',        // Tue 1 Dec 2026 23:59:59 Bangkok
    downloads: {
        windows: 'https://updates.thebrokensealgame.com/alpha/download/BrokenSeal-Alpha-0.1.0-windows.zip',
        macos: 'https://updates.thebrokensealgame.com/alpha/download/BrokenSeal-Alpha-0.1.0-mac.zip',
        android: 'https://play.google.com/apps/internaltest/4701162765935539875',   // Google Play internal-test link
        ios: ''        // TestFlight invite link
    }
};

/**
 * THE BROKEN SEAL - OFFICIAL WEBSITE JAVASCRIPT
 * Handles language switching, video viewport autoplay, and mobile navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. LANGUAGE SWITCHING LOGIC ---
    const langToggleBtn = document.getElementById('langToggleBtn');
    const bodyEl = document.body;
    const htmlEl = document.documentElement;

    // Check stored language preference or default to Thai
    const currentLang = localStorage.getItem('tbs_website_lang') || 'th';
    setLanguage(currentLang);

    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            const newLang = bodyEl.classList.contains('lang-th') ? 'en' : 'th';
            setLanguage(newLang);
        });
    }

    function setLanguage(lang) {
        const isGuidePage = window.location.pathname.includes('guide.html');
        if (lang === 'en') {
            bodyEl.classList.remove('lang-th');
            bodyEl.classList.add('lang-en');
            htmlEl.setAttribute('lang', 'en');
            document.title = isGuidePage 
                ? "Game Guide | The Broken Seal"
                : "The Broken Seal | Online Action RPG Hack & Slash";
            localStorage.setItem('tbs_website_lang', 'en');
        } else {
            bodyEl.classList.remove('lang-en');
            bodyEl.classList.add('lang-th');
            htmlEl.setAttribute('lang', 'th');
            document.title = isGuidePage 
                ? "คู่มือการเล่น | The Broken Seal"
                : "The Broken Seal | เกมแอ็กชัน RPG ออนไลน์ Hack & Slash";
            localStorage.setItem('tbs_website_lang', 'th');
        }
    }

    // --- 2. MOBILE MENU TOGGLE ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');

    if (mobileMenuBtn && mainNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mainNav.classList.toggle('open');
        });

        // Close mobile nav when clicking any nav link
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('open');
            });
        });
    }

    // Header background: the map flight video. Browsers pause muted autoplay in a hidden tab; resume it on return.
    const heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
        const resume = () => { if (!document.hidden && heroVideo.paused) heroVideo.play().catch(() => {}); };
        document.addEventListener('visibilitychange', resume);
        resume();
    }

    // --- 3. VIDEO AUTOPLAY ON VISIBILITY (INTERSECTION OBSERVER) ---
    const videoElements = document.querySelectorAll('.skill-video');

    if ('IntersectionObserver' in window && videoElements.length > 0) {
        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                if (entry.isIntersecting) {
                    // Play video when visible
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(() => {
                            // Autoplay was prevented or postponed by browser policy
                        });
                    }
                } else {
                    // Pause video when scrolled away to save GPU/CPU
                    video.pause();
                }
            });
        }, {
            threshold: 0.3
        });

        videoElements.forEach(video => {
            videoObserver.observe(video);
        });
    }

    // --- 4. MANUAL VIDEO PLAY / PAUSE BUTTONS ---
    const playButtons = document.querySelectorAll('.video-play-toggle');
    playButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.video-wrapper');
            if (wrapper) {
                const video = wrapper.querySelector('video');
                if (video) {
                    if (video.paused) {
                        video.play();
                        btn.textContent = '❚❚';
                    } else {
                        video.pause();
                        btn.textContent = '▶';
                    }
                }
            }
        });
    });

    // Update play button icons on native video events
    videoElements.forEach(video => {
        const btn = video.parentElement.querySelector('.video-play-toggle');
        if (btn) {
            video.addEventListener('play', () => btn.textContent = '❚❚');
            video.addEventListener('pause', () => btn.textContent = '▶');
        }
    });

    // --- 5. HEADER SCROLL EFFECT ---
    const headerEl = document.querySelector('.site-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            headerEl.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.8)';
            headerEl.style.background = 'rgba(11, 10, 15, 0.96)';
        } else {
            headerEl.style.boxShadow = 'none';
            headerEl.style.background = 'rgba(11, 10, 15, 0.92)';
        }
    });
});


// ---- E-mail sign-up (Claude) ----
// Set SIGNUP.url to the team's form endpoint. For a Google Form: url = ".../formResponse" and fields maps each
// input name to its "entry.NNN" id (open the form's pre-filled link to read them). Empty url: the form says
// sign-up opens soon and sends nothing.
const SIGNUP = {
    url: "https://docs.google.com/forms/d/e/1FAIpQLSdc7cUIC5Yuu42HpFp8W7_Z5-w-PD2lXCX3aBek8oGm5FplUg/formResponse",
    fields: { email: "entry.164281841", platform: "entry.93634053", hours: "entry.412402187", intent: "entry.1693884636" },
};

(function () {
    const form = document.getElementById("signupForm");
    if (!form) return;
    const status = document.getElementById("signupStatus");
    const th = () => !document.body.classList.contains("lang-en");
    const say = (cls, thText, enText) => { status.className = "signup-status " + cls; status.textContent = th() ? thText : enText; };

    // Option labels follow the language toggle.
    const relabel = () => form.querySelectorAll("option[data-th]").forEach(o => { o.textContent = th() ? o.dataset.th : o.dataset.en; });
    new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "class"] });
    new MutationObserver(relabel).observe(document.body, { attributes: true, attributeFilter: ["class"] });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const email = (data.get("email") || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("err", "กรุณาใส่อีเมลให้ถูกต้อง", "Please enter a valid email.");
        if (!data.get("platform") || !data.get("hours")) return say("err", "กรุณาตอบให้ครบทุกข้อ", "Please answer every question.");
        if (!data.get("consent")) return say("err", "กรุณาติ๊กยินยอมก่อนลงทะเบียน", "Please tick the consent box.");
        if (!SIGNUP.url) return say("ok", "ระบบลงทะเบียนจะเปิดเร็ว ๆ นี้ ขอบคุณที่สนใจ!", "Sign-up opens soon. Thank you for your interest!");

        const body = new URLSearchParams();
        // The sheet gets readable Thai text, not the option codes.
        const label = (name) => {
            const v = data.get(name);
            const opt = form.querySelector(`select[name="${name}"] option[value="${v}"]`);
            if (opt) return opt.dataset.th || v;
            return { alpha: "อยากร่วมทดสอบ Alpha", news: "รับข่าวสารอย่างเดียว" }[v] || v;
        };
        for (const [name, entry] of Object.entries(SIGNUP.fields)) if (entry) body.append(entry, name === "email" ? email : label(name));
        try {
            await fetch(SIGNUP.url, { method: "POST", mode: "no-cors", body });
            form.reset();
            say("ok", "ลงทะเบียนเรียบร้อย ขอบคุณ! เราจะส่งข่าวไปที่อีเมลของคุณ", "You're signed up. Thank you! We'll send news to your email.");
        } catch {
            say("err", "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง", "Could not send. Please try again.");
        }
    });
})();

// --- ALPHA COUNTDOWN + DOWNLOAD LINKS ---
// Phases (Bangkok time): 'before' < 19 Nov 18:00, 'live' 19 Nov 18:00 - 1 Dec 23:59:59, 'after' beyond.
// Download links work ONLY in 'live'; before and after the buttons are disabled with their own text.
(function initAlpha() {
    const box = document.getElementById('alphaCountdown');
    if (!box) return;
    const bodyEl = document.body;
    const start = Date.parse(ALPHA_CONFIG.start);
    const end = Date.parse(ALPHA_CONFIG.end);
    const live = document.getElementById('alphaLive');
    const timer = document.getElementById('alphaTimer');
    const nums = {};
    box.querySelectorAll('[data-unit]').forEach(el => { nums[el.dataset.unit] = el; });
    let lastPhase = '', lastMinute = -1, parts = { d: 0, h: 0, m: 0 }, timerId = 0;
    const pad = n => String(n).padStart(2, '0');
    const isThai = () => !bodyEl.classList.contains('lang-en');

    // Button text per phase (the label spans carry their own language class); 'live' restores the original text.
    const dlLabels = {
        before: { th: 'เปิดให้ดาวน์โหลด 19 พ.ย. 18:00', en: 'Opens 19 Nov, 18:00' },
        soon:   { th: 'เร็ว ๆ นี้', en: 'Coming soon' },
        after:  { th: 'ปิดรอบทดสอบแล้ว', en: 'Test round closed' }
    };
    const dlButtons = [...document.querySelectorAll('[data-dl]')];
    dlButtons.forEach(a => a.querySelectorAll('.dl-label').forEach(l => { l.dataset.orig = l.textContent; }));

    function applyDownloads(phase) {
        dlButtons.forEach(a => {
            const url = (ALPHA_CONFIG.downloads[a.dataset.dl] || '').trim();
            const open = phase === 'live' && url !== '';
            if (open) {
                a.href = url;
                a.rel = 'noopener';
                a.classList.remove('is-soon');
                a.removeAttribute('aria-disabled');
            } else {
                a.removeAttribute('href');
                a.removeAttribute('rel');
                a.classList.add('is-soon');
                a.setAttribute('aria-disabled', 'true');
            }
            const key = phase === 'live' ? 'soon' : phase;   // live without a link yet = "coming soon"
            a.querySelectorAll('.dl-label').forEach(l => {
                l.textContent = open ? l.dataset.orig : dlLabels[key][l.classList.contains('lang-th') ? 'th' : 'en'];
            });
        });
    }

    // Screen readers: one announcement a minute (not every second), refreshed at once when the language switches;
    // after the end it is the thank-you line instead of a countdown.
    function announce() {
        const th = isThai();
        let text;
        if (lastPhase === 'after') {
            const el = box.querySelector(`[data-phase-text="after"].lang-${th ? 'th' : 'en'}`);
            text = el ? el.textContent.trim() : '';
        } else {
            const lead = lastPhase === 'before' ? (th ? 'เปิดทดสอบ Alpha ใน' : 'Alpha test opens in')
                                                : (th ? 'Alpha จะสิ้นสุดใน' : 'Alpha ends in');
            text = th ? `${lead} ${parts.d} วัน ${parts.h} ชั่วโมง ${parts.m} นาที`
                      : `${lead} ${parts.d} days ${parts.h} hours ${parts.m} minutes`;
        }
        if (live.textContent !== text) live.textContent = text;
    }

    function tick() {
        const now = Date.now();
        const phase = now < start ? 'before' : (now <= end ? 'live' : 'after');
        if (phase !== lastPhase) {
            lastPhase = phase;
            lastMinute = -1;
            box.dataset.phase = phase;
            document.querySelectorAll('[data-phase-text]').forEach(el => { el.hidden = el.dataset.phaseText !== phase; });
            timer.hidden = phase === 'after';
            applyDownloads(phase);
            if (phase === 'after') { announce(); clearInterval(timerId); return; }
        }
        const target = phase === 'before' ? start : end + 1000;
        const left = Math.max(0, Math.floor((target - now) / 1000));
        const d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600),
              m = Math.floor(left % 3600 / 60), s = left % 60;
        nums.d.textContent = pad(d); nums.h.textContent = pad(h);
        nums.m.textContent = pad(m); nums.s.textContent = pad(s);
        const minuteKey = Math.floor(left / 60);
        if (minuteKey !== lastMinute) {
            lastMinute = minuteKey;
            parts = { d, h, m };
            announce();
        }
    }
    tick();
    if (lastPhase !== 'after') timerId = setInterval(tick, 1000);
    new MutationObserver(announce).observe(bodyEl, { attributes: true, attributeFilter: ['class'] });   // language switch
})();
