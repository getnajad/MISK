// ===== Configuration =====
const CONFIG = {
    latitude: 11.87,
    longitude: 75.37,
    method: 4,         // Umm Al-Qura
    school: 1,         // Hanafi for Asr
    timezone: 'Asia/Kolkata',
    iqamaOffsets: { fajr: 15, dhuhr: 10, asr: 10, maghrib: 5, isha: 10 },
    jummahTime: '12:30 PM',
    alertDurationMs: 60000,
    prayerSilenceMinutes: 15, // Screen goes silent/empty for 15 minutes once prayer starts
};

const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_LABELS = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

let prayerTimesData = {};
let lastAlertedPrayer = '';
let activeSilenceKey = null;
let silenceEndTime = null;

// ===== Initialize Stars (subtle, Apple-style dots) =====
function createStars() {
    const container = document.getElementById('starsContainer');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        const size = Math.random() * 2 + 0.5;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.setProperty('--dur', (Math.random() * 6 + 3) + 's');
        star.style.animationDelay = Math.random() * 5 + 's';
        container.appendChild(star);
    }
}

// ===== Add SVG gradient for ring =====
function addRingGradient() {
    const svg = document.querySelector('.clock-ring-svg');
    if (!svg) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.id = 'ringGradient';
    grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '100%');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#0a84ff');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#5e5ce6');
    grad.appendChild(s1); grad.appendChild(s2);
    defs.appendChild(grad); svg.prepend(defs);
}

// ===== Time Utilities =====
function getNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: CONFIG.timezone }));
}

function timeStringToMinutes(str) {
    if (!str) return 0;
    const clean = str.replace(/\s*\(.*\)/, '').trim();
    const [h, m] = clean.split(':').map(Number);
    return h * 60 + m;
}

function formatTime12(str) {
    if (!str) return '--:--';
    const clean = str.replace(/\s*\(.*\)/, '').trim();
    let [h, m] = clean.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function formatCountdown(diffMs) {
    if (diffMs <= 0) return '00:00:00';
    const totalSec = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ===== Compute Iqama Time String =====
function getIqamaTime12(prayerTimeStr, key) {
    if (!prayerTimeStr || !CONFIG.iqamaOffsets[key]) return '--:--';
    const clean = prayerTimeStr.replace(/\s*\(.*\)/, '').trim();
    let [h, m] = clean.split(':').map(Number);
    const totalMin = h * 60 + m + CONFIG.iqamaOffsets[key];
    let ih = Math.floor(totalMin / 60) % 24;
    const im = totalMin % 60;
    const period = ih >= 12 ? 'PM' : 'AM';
    ih = ih % 12 || 12;
    return `${ih}:${String(im).padStart(2, '0')} ${period}`;
}

// ===== Fetch Prayer Times =====
async function fetchPrayerTimes() {
    const now = getNow();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${CONFIG.latitude}&longitude=${CONFIG.longitude}&method=${CONFIG.method}&school=${CONFIG.school}`;
    try {
        const res = await fetch(url);
        const json = await res.json();
        const t = json.data.timings;
        prayerTimesData = {
            fajr: t.Fajr, sunrise: t.Sunrise, dhuhr: t.Dhuhr,
            asr: t.Asr, maghrib: t.Maghrib, isha: t.Isha,
        };
        // Hijri date
        const h = json.data.date.hijri;
        const hijriEl = document.getElementById('hijriDate');
        if (hijriEl) hijriEl.textContent = `${h.day} ${h.month.en} ${h.year} AH`;
        updatePrayerDisplay();
    } catch (e) {
        console.error('Failed to fetch prayer times:', e);
        setTimeout(fetchPrayerTimes, 30000);
    }
}

// ===== Update Prayer Time Cards (Azan + Iqamah) =====
function updatePrayerDisplay() {
    PRAYER_KEYS.forEach(key => {
        const el = document.getElementById(`time-${key}`);
        if (el) el.textContent = formatTime12(prayerTimesData[key]);

        // Update iqama time on each card
        const iqEl = document.getElementById(`iqama-${key}`);
        if (iqEl) iqEl.textContent = getIqamaTime12(prayerTimesData[key], key);
    });
}

// ===== Determine Current & Next Prayer =====
function getPrayerStatus() {
    const now = getNow();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const times = PRAYER_KEYS.map(k => ({ key: k, minutes: timeStringToMinutes(prayerTimesData[k]) }));
    let current = null;
    let next = null;

    for (let i = times.length - 1; i >= 0; i--) {
        if (nowMin >= times[i].minutes) {
            current = times[i];
            next = times[i + 1] || null;
            break;
        }
    }

    if (!current) {
        next = times[0];
    }

    return { current, next, nowMin, times };
}

// ===== Update Cards Active State =====
function updateCardStates() {
    const { current, next } = getPrayerStatus();
    PRAYER_KEYS.forEach(key => {
        const card = document.getElementById(`card-${key}`);
        const statusEl = document.getElementById(`status-${key}`);
        if (!card) return;
        card.classList.remove('active', 'next-up', 'passed');
        if (statusEl) statusEl.textContent = '';

        if (current && key === current.key && key !== 'sunrise') {
            card.classList.add('active');
            if (statusEl) statusEl.textContent = '● CURRENT';
        } else if (next && key === next.key) {
            card.classList.add('next-up');
            if (statusEl) statusEl.textContent = '◎ NEXT';
        } else if (current) {
            const keyMin = timeStringToMinutes(prayerTimesData[key]);
            const curMin = current.minutes;
            if (keyMin < curMin && key !== current.key) {
                card.classList.add('passed');
            }
        }
    });
}

// ===== Update Next Prayer Info & Countdown =====
function updateNextPrayerInfo() {
    const { next } = getPrayerStatus();
    const nameEl = document.getElementById('nextPrayerName');
    const countEl = document.getElementById('countdown');

    if (!next || !prayerTimesData[next.key]) {
        if (nameEl) nameEl.textContent = 'Fajr';
        if (countEl) countEl.textContent = 'Tomorrow';
        return;
    }

    if (nameEl) nameEl.textContent = PRAYER_LABELS[next.key];

    const now = getNow();
    const nowMs = now.getTime();
    const [h, m] = prayerTimesData[next.key].replace(/\s*\(.*\)/, '').trim().split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= nowMs) target.setDate(target.getDate() + 1);
    const diff = target.getTime() - nowMs;
    if (countEl) countEl.textContent = formatCountdown(diff);

    updateRingProgress(diff, next.key);
    updateIqama(next.key, target);
    updateIqamaCountdown(next.key, target);
}

// ===== Ring Progress =====
function updateRingProgress(diffMs) {
    const ring = document.getElementById('ringProgress');
    if (!ring) return;
    const circumference = 2 * Math.PI * 140;
    const totalSpanMs = 6 * 60 * 60 * 1000;
    const progress = Math.max(0, Math.min(1, 1 - diffMs / totalSpanMs));
    ring.style.strokeDashoffset = circumference * (1 - progress);
}

// ===== Footer Iqama Time =====
function updateIqama(nextKey, prayerDate) {
    const el = document.getElementById('iqamaTime');
    if (!el) return;
    const offset = CONFIG.iqamaOffsets[nextKey];
    if (!offset) { el.textContent = '--:--'; return; }
    const iqama = new Date(prayerDate.getTime() + offset * 60000);
    let h = iqama.getHours();
    const m = iqama.getMinutes();
    const p = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    el.textContent = `${h}:${String(m).padStart(2, '0')} ${p}`;
}

// ===== Footer Iqama Countdown =====
function updateIqamaCountdown(nextKey, prayerDate) {
    const el = document.getElementById('iqamaCountdown');
    if (!el) return;
    const offset = CONFIG.iqamaOffsets[nextKey];
    if (!offset) { el.textContent = ''; return; }
    const iqamaTime = new Date(prayerDate.getTime() + offset * 60000);
    const now = getNow();
    const diff = iqamaTime.getTime() - now.getTime();
    if (diff > 0) {
        el.textContent = `in ${formatCountdown(diff)}`;
    } else {
        el.textContent = '';
    }
}

// ===== Current Prayer Banner =====
function updateBanner() {
    const { current } = getPrayerStatus();
    const banner = document.getElementById('currentPrayerBanner');
    const bannerText = document.getElementById('bannerText');
    if (!banner || !bannerText) return;

    if (current && current.key !== 'sunrise') {
        banner.classList.add('visible');
        bannerText.textContent = `${PRAYER_LABELS[current.key]} time is ongoing`;
    } else {
        banner.classList.remove('visible');
    }
}

// ===== Prayer Alert with Iqamah Countdown =====
let activeAlertKey = null;
let iqamahTargetTime = null;

function checkPrayerAlert() {
    if (activeSilenceKey) return; // Prevent alerts during silence/prayer mode

    const now = getNow();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const alertPrayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    // If overlay is active, update the iqamah countdown
    if (activeAlertKey && iqamahTargetTime) {
        const diff = iqamahTargetTime.getTime() - now.getTime();
        updateBigIqamahCountdown(diff);
        if (diff <= 0) {
            // Iqamah time reached — transition immediately to distraction-free prayer mode!
            const key = activeAlertKey;
            hideAlert();
            showPrayerSilence(key);
        }
        return;
    }

    // Check if any prayer time just started
    for (const key of alertPrayers) {
        const pMin = timeStringToMinutes(prayerTimesData[key]);
        if (!pMin) continue;
        const offset = CONFIG.iqamaOffsets[key] || 10;
        const iqamahMin = pMin + offset;

        // Show alert if we're between azan and iqamah
        if (nowMin >= pMin && nowMin < iqamahMin && lastAlertedPrayer !== key) {
            showAlert(key);
            lastAlertedPrayer = key;
            break;
        }
    }
}

function showAlert(key) {
    activeAlertKey = key;

    // Calculate iqamah target time
    const prayerStr = prayerTimesData[key];
    if (!prayerStr) return;
    const clean = prayerStr.replace(/\s*\(.*\)/, '').trim();
    const [h, m] = clean.split(':').map(Number);
    const offset = CONFIG.iqamaOffsets[key] || 10;
    const now = getNow();
    iqamahTargetTime = new Date(now);
    iqamahTargetTime.setHours(h, m + offset, 0, 0);

    // Set overlay content
    const overlay = document.getElementById('prayerAlertOverlay');
    const nameEl = document.getElementById('alertPrayerName');
    const iqamahLabel = document.getElementById('iqamahTimeLabel');

    if (overlay) overlay.classList.add('active');
    if (nameEl) nameEl.textContent = PRAYER_LABELS[key];
    if (iqamahLabel) {
        let ih = iqamahTargetTime.getHours();
        const im = iqamahTargetTime.getMinutes();
        const p = ih >= 12 ? 'PM' : 'AM';
        ih = ih % 12 || 12;
        iqamahLabel.textContent = `Iqamah at ${ih}:${String(im).padStart(2, '0')} ${p}`;
    }

    // Initial countdown update
    const diff = iqamahTargetTime.getTime() - now.getTime();
    updateBigIqamahCountdown(diff);
}

function updateBigIqamahCountdown(diffMs) {
    const el = document.getElementById('iqamahCountdownBig');
    if (!el) return;

    if (diffMs <= 0) {
        el.textContent = '00:00';
        el.classList.add('urgent');
        const label = document.getElementById('iqamahLabelBig');
        if (label) label.textContent = 'IQAMAH NOW';
        return;
    }

    const totalSec = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Last 60 seconds — turn red
    if (totalSec <= 60) {
        el.classList.add('urgent');
    } else {
        el.classList.remove('urgent');
    }
}

function hideAlert() {
    const overlay = document.getElementById('prayerAlertOverlay');
    if (overlay) overlay.classList.remove('active');
    activeAlertKey = null;
    iqamahTargetTime = null;

    const el = document.getElementById('iqamahCountdownBig');
    if (el) el.classList.remove('urgent');
}

// ===== Distraction-Free Prayer Silence Handlers =====
function showPrayerSilence(key) {
    activeSilenceKey = key;
    const now = getNow();
    silenceEndTime = new Date(now.getTime() + CONFIG.prayerSilenceMinutes * 60 * 1000);

    const overlay = document.getElementById('prayerSilenceOverlay');
    const label = document.getElementById('silencePrayerName');
    
    if (label) {
        const prayerName = PRAYER_LABELS[key] ? PRAYER_LABELS[key].toUpperCase() : key.toUpperCase();
        label.textContent = `${prayerName} CONGREGATION IN PROGRESS`;
    }
    
    if (overlay) {
        overlay.classList.add('active');
    }
}

function checkPrayerSilence() {
    if (!activeSilenceKey || !silenceEndTime) return;
    const now = getNow();
    if (now.getTime() >= silenceEndTime.getTime()) {
        hidePrayerSilence();
    }
}

function hidePrayerSilence() {
    const overlay = document.getElementById('prayerSilenceOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    activeSilenceKey = null;
    silenceEndTime = null;
}

// ===== Update Clock =====
function updateClock() {
    const now = getNow();
    let h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    const timeEl = document.getElementById('currentTime');
    const secEl = document.getElementById('currentSeconds');
    const perEl = document.getElementById('timePeriod');

    if (timeEl) timeEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (secEl) secEl.textContent = String(s).padStart(2, '0');
    if (perEl) perEl.textContent = period;
}

// ===== Update Gregorian Date =====
function updateGregorianDate() {
    const el = document.getElementById('gregorianDate');
    if (!el) return;
    const now = getNow();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.textContent = now.toLocaleDateString('en-US', opts);
}

// ===== Dynamic Sky Background =====
function updateSky() {
    const now = getNow();
    const h = now.getHours();
    const m = now.getMinutes();
    const t = h + m / 60; // decimal hours

    // Use sunrise/sunset from prayer data if available
    const sunriseMin = timeStringToMinutes(prayerTimesData.sunrise);
    const maghribMin = timeStringToMinutes(prayerTimesData.maghrib);
    const sunriseH = sunriseMin / 60 || 6;
    const maghribH = maghribMin / 60 || 18.5;

    let sky;
    if (t < sunriseH - 1) sky = 'night';
    else if (t < sunriseH) sky = 'dawn';
    else if (t < sunriseH + 1.5) sky = 'morning';
    else if (t < maghribH - 1.5) sky = 'day';
    else if (t < maghribH - 0.5) sky = 'golden';
    else if (t < maghribH + 0.5) sky = 'dusk';
    else sky = 'night';

    document.body.setAttribute('data-sky', sky);
}

// ===== Hadith / Verse Ticker =====
const TICKER_ITEMS = [
    { ar: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا', en: '"Indeed, prayer has been decreed upon the believers at specified times." — Quran 4:103' },
    { ar: 'خَيْرُ صُفُوفِ الرِّجَالِ أَوَّلُهَا', en: '"The best rows for men are the first rows." — Sahih Muslim' },
    { ar: 'مَنْ بَنَى مَسْجِدًا لِلَّهِ بَنَى اللَّهُ لَهُ مِثْلَهُ فِي الْجَنَّةِ', en: '"Whoever builds a mosque for Allah, Allah will build for him a house in Paradise." — Bukhari' },
    { ar: 'الصَّلَاةُ نُورٌ', en: '"Prayer is light." — Sahih Muslim' },
    { ar: 'بُنِيَ الإِسْلامُ عَلَى خَمْسٍ', en: '"Islam is built upon five pillars." — Bukhari & Muslim' },
    { ar: 'إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ', en: '"Indeed, Allah and His angels send blessings upon the Prophet." — Quran 33:56' },
    { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً', en: '"Our Lord, give us good in this world and good in the Hereafter." — Quran 2:201' },
    { ar: 'أَقِمِ الصَّلَاةَ لِذِكْرِي', en: '"Establish prayer for My remembrance." — Quran 20:14' },
];

function initTicker() {
    const container = document.getElementById('tickerContent');
    if (!container) return;

    // Build items — duplicate for seamless loop
    let html = '';
    const items = [...TICKER_ITEMS, ...TICKER_ITEMS]; // duplicate for seamless scroll
    items.forEach((item, i) => {
        html += `<span class="ticker-item"><span class="ticker-arabic">${item.ar}</span><span class="ticker-english">${item.en}</span></span>`;
        if (i < items.length - 1) {
            html += '<span class="ticker-separator">✦</span>';
        }
    });
    container.innerHTML = html;

    // Set duration based on content width (measured after render)
    requestAnimationFrame(() => {
        const width = container.scrollWidth;
        const speed = 60; // pixels per second
        const duration = width / speed / 2; // /2 because we duplicate
        container.style.setProperty('--ticker-duration', `${duration}s`);
    });
}

// ===== Jumu'ah Friday Mode =====
function updateJummahMode() {
    const now = getNow();
    const isFriday = now.getDay() === 5;
    const jummahText = document.getElementById('jummahText');

    if (isFriday) {
        document.body.classList.add('jummah-mode');

        // Parse Jumu'ah time
        const jMatch = CONFIG.jummahTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (jMatch && jummahText) {
            let jH = parseInt(jMatch[1]);
            const jM = parseInt(jMatch[2]);
            const jP = jMatch[3].toUpperCase();
            if (jP === 'PM' && jH !== 12) jH += 12;
            if (jP === 'AM' && jH === 12) jH = 0;

            const jTarget = new Date(now);
            jTarget.setHours(jH, jM, 0, 0);
            const diff = jTarget.getTime() - now.getTime();

            if (diff > 0) {
                const totalSec = Math.floor(diff / 1000);
                const hrs = Math.floor(totalSec / 3600);
                const mins = Math.floor((totalSec % 3600) / 60);
                jummahText.innerHTML = `Jumu'ah in <strong class="jummah-countdown">${hrs}h ${mins}m</strong>`;
            } else if (diff > -3600000) {
                jummahText.innerHTML = `<strong class="jummah-countdown">Jumu'ah is now</strong>`;
            } else {
                jummahText.innerHTML = `Jumu'ah: <strong>${CONFIG.jummahTime}</strong> ✓`;
            }
        }
    } else {
        document.body.classList.remove('jummah-mode');
        if (jummahText) {
            // Show days until Friday
            const daysUntil = (5 - now.getDay() + 7) % 7 || 7;
            jummahText.innerHTML = `Jumu'ah: <strong>${CONFIG.jummahTime}</strong> <span style="opacity:0.5">(${daysUntil}d)</span>`;
        }
    }
}

// ===== Midnight Reset =====
function scheduleMidnightRefresh() {
    const now = getNow();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 5, 0);
    const ms = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
        lastAlertedPrayer = '';
        fetchPrayerTimes();
        scheduleMidnightRefresh();
    }, ms);
}

// ===== Main Loop =====
function tick() {
    updateClock();
    updateCardStates();
    updateNextPrayerInfo();
    updateBanner();
    checkPrayerAlert();
    checkPrayerSilence();
    updateJummahMode();
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    createStars();
    addRingGradient();
    updateGregorianDate();
    updateSky();
    initTicker();
    fetchPrayerTimes();

    tick();
    setInterval(tick, 1000);

    // Update sky & date every 2 minutes
    setInterval(() => {
        updateGregorianDate();
        updateSky();
    }, 120000);

    scheduleMidnightRefresh();

    const overlay = document.getElementById('prayerAlertOverlay');
    if (overlay) overlay.addEventListener('click', hideAlert);
});

