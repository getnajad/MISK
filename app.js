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
};

const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_LABELS = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

let prayerTimesData = {};
let lastAlertedPrayer = '';
let currentWeatherCode = 0;
let rainInterval = null;

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

// ===== Update Clock =====
function updateClock() {
    const now = getNow();
    let h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    const hoursEl = document.getElementById('heroHours');
    const minutesEl = document.getElementById('heroMinutes');
    const secEl = document.getElementById('heroSeconds');
    const perEl = document.getElementById('heroPeriod');

    if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
    if (secEl) secEl.textContent = String(s).padStart(2, '0');
    if (perEl) perEl.textContent = period;

    // Update progress bar of the minute
    const progressFill = document.getElementById('heroProgressFill');
    if (progressFill) {
        const progressPercent = (s / 60) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }
}

// ===== Update Gregorian Date =====
function updateGregorianDate() {
    const el = document.getElementById('gregorianDate');
    if (!el) return;
    const now = getNow();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.textContent = now.toLocaleDateString('en-US', opts);
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
    const now = getNow();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const alertPrayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    // If overlay is active, update the iqamah countdown
    if (activeAlertKey && iqamahTargetTime) {
        const diff = iqamahTargetTime.getTime() - now.getTime();
        updateBigIqamahCountdown(diff);
        if (diff <= 0) {
            // Iqamah time reached — dismiss after a short delay
            setTimeout(() => hideAlert(), 3000);
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



// ===== Dynamic Sky Background & Weather Effects =====
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
    if (t < sunriseH - 1)         sky = 'night';
    else if (t < sunriseH)        sky = 'dawn';
    else if (t < sunriseH + 1.5)  sky = 'morning';
    else if (t < maghribH - 1.5)  sky = 'day';
    else if (t < maghribH - 0.5)  sky = 'golden';
    else if (t < maghribH + 0.5)  sky = 'dusk';
    else                          sky = 'night';

    // Weather Determination based on OpenMeteo code
    let weather = 'clear';
    const c = currentWeatherCode;
    
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) {
        weather = 'rainy';
    } else if (c >= 1 && c <= 48) {
        weather = 'cloudy';
    } else {
        weather = 'clear';
    }

    // Drive the canvas engine
    if (typeof WeatherCanvas !== 'undefined') {
        WeatherCanvas.setSky(sky);
        WeatherCanvas.setWeather(weather);
    }
    document.body.setAttribute('data-sky', sky);
    document.body.setAttribute('data-weather', weather);
}

// ===== Masjid Notice Board Manager =====
function initNoticeBoard() {
    const noticeMessage = document.getElementById('noticeMessage');
    if (!noticeMessage) return;

    function refreshNotice() {
        const storedNotice = localStorage.getItem('masjidNotice');
        // Default notice in Malayalam:
        const defaultNotice = "സക്കരിയ്യാ ജുമാ മസ്ജിദ് ഥാന - ജമാഅത്ത് സമയം: ഫജ്‌ർ 5:00 AM, ദുഹർ 12:35 PM, അസർ 5:05 PM, മഗ്‌രിബ് 6:52 PM, ഇശാ 8:27 PM.";
        const activeNotice = storedNotice ? storedNotice.trim() : defaultNotice;
        
        noticeMessage.textContent = activeNotice;
    }

    refreshNotice();

    // Listen for changes from the admin page in real time
    window.addEventListener('storage', (e) => {
        if (e.key === 'masjidNotice') {
            refreshNotice();
        }
    });

    // Also check local storage every 3 seconds as a fallback
    setInterval(refreshNotice, 3000);
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

// ===== Arabic Day Names =====
const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function updateArabicDay() {
    const el = document.getElementById('arabicDay');
    if (!el) return;
    const now = getNow();
    el.textContent = `يوم ${ARABIC_DAYS[now.getDay()]}`;
}

// ===== Moon Phase =====
function getMoonPhase() {
    const now = getNow();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // Conway's moon phase approximation
    let r = year % 100;
    r %= 19;
    if (r > 9) r -= 19;
    r = ((r * 11) % 30) + month + day;
    if (month < 3) r += 2;
    r -= ((year < 2000) ? 4 : 8.3);
    r = Math.floor(r + 0.5) % 30;
    if (r < 0) r += 30;

    // Map to emoji
    if (r === 0)  return '🌑';
    if (r <= 3)   return '🌒';
    if (r <= 7)   return '🌓';
    if (r <= 10)  return '🌔';
    if (r <= 14)  return '🌕';
    if (r <= 17)  return '🌖';
    if (r <= 21)  return '🌗';
    if (r <= 25)  return '🌘';
    return '🌑';
}

function updateMoonPhase() {
    const hijriEl = document.getElementById('hijriDate');
    if (!hijriEl) return;
    const moon = getMoonPhase();
    // Prepend moon if not already there
    const text = hijriEl.textContent.replace(/^[\u{1F311}-\u{1F318}\u{1F31D}]\s*/u, '');
    hijriEl.textContent = `${moon} ${text}`;
}

// ===== Weather (OpenMeteo — free, no API key) =====
async function fetchWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.latitude}&longitude=${CONFIG.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FKolkata`;
        const res = await fetch(url);
        const json = await res.json();
        const temp = Math.round(json.current.temperature_2m);
        const code = json.current.weather_code;

        currentWeatherCode = code; // Save weather code globally
        updateSky(); // Instantly update sky gradients and overlays based on weather

        const iconEl = document.getElementById('weatherIcon');
        const tempEl = document.getElementById('weatherTemp');

        if (tempEl) tempEl.textContent = `${temp}°C`;
        if (iconEl) iconEl.textContent = getWeatherEmoji(code);
    } catch (e) {
        console.error('Weather fetch failed:', e);
    }
}

function getWeatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 57) return '🌧️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

// ===== Tahajjud Time (Last Third of Night) =====
function updateTahajjud() {
    const el = document.getElementById('tahajjudText');
    if (!el) return;

    const maghribMin = timeStringToMinutes(prayerTimesData.maghrib);
    const fajrMin = timeStringToMinutes(prayerTimesData.fajr);

    if (!maghribMin || !fajrMin) {
        el.textContent = 'Tahajjud: --:--';
        return;
    }

    // Night duration: Maghrib to Fajr (next day)
    let nightDuration = fajrMin - maghribMin;
    if (nightDuration < 0) nightDuration += 1440; // wrap around midnight

    // Last third starts at: Maghrib + (2/3 * night duration)
    const lastThirdStart = (maghribMin + Math.floor(nightDuration * 2 / 3)) % 1440;
    let h = Math.floor(lastThirdStart / 60);
    const m = lastThirdStart % 60;
    const p = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeStr = `${h}:${String(m).padStart(2, '0')} ${p}`;

    el.innerHTML = `Tahajjud: <strong>${timeStr}</strong>`;
}

// ===== Fullscreen Kiosk Mode =====
function initFullscreen() {
    const btn = document.getElementById('fullscreenBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });

    // Update button icon based on state
    document.addEventListener('fullscreenchange', () => {
        btn.textContent = document.fullscreenElement ? '✕' : '⛶';
    });
}

// ===== Main Loop =====
function tick() {
    updateClock();
    updateCardStates();
    updateNextPrayerInfo();
    updateBanner();
    checkPrayerAlert();
    updateJummahMode();
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    createStars();
    addRingGradient();
    updateGregorianDate();
    updateArabicDay();
    updateSky();
    initNoticeBoard();
    initFullscreen();
    fetchPrayerTimes().then(() => {
        updateMoonPhase();
        updateTahajjud();
        updateSky();
    });
    fetchWeather();

    tick();
    setInterval(tick, 1000);

    // Update sky, date, moon every 2 minutes
    setInterval(() => {
        updateGregorianDate();
        updateArabicDay();
        updateSky();
    }, 120000);

    // Refresh weather every 15 minutes
    setInterval(fetchWeather, 900000);

    scheduleMidnightRefresh();

    const overlay = document.getElementById('prayerAlertOverlay');
    if (overlay) overlay.addEventListener('click', hideAlert);
});


