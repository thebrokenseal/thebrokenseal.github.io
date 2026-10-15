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
