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

// ==========================================
// ===== RAW PRINTED TIMETABLE DATASET ======
// ==========================================
const RAW_TIMETABLE_CSV = `Month,Day,Subhi,Luhar,Asar,Magrib,Isha
Jan,1,5:24,12:32,3:49,4:37,6:15
Jan,4,5:26,12:34,3:51,4:40,6:17
Jan,7,5:27,12:35,3:52,4:42,6:18
Jan,10,5:28,12:36,3:53,4:43,6:20
Jan,13,5:29,12:37,3:54,4:45,6:21
Jan,16,5:30,12:39,3:56,4:47,6:23
Jan,19,5:31,12:40,3:57,4:48,6:25
Jan,22,5:31,12:40,3:58,4:49,6:26
Jan,25,5:31,12:41,4:01,4:51,6:27
Jan,28,5:32,12:42,4:01,4:52,6:29
Feb,1,5:33,12:43,4:02,4:54,6:31
Feb,4,5:32,12:43,4:03,4:55,6:32
Feb,7,5:32,12:43,4:03,4:56,6:33
Feb,10,5:31,12:43,4:04,4:56,6:33
Feb,13,5:31,12:43,4:04,4:57,6:34
Feb,16,5:30,12:43,4:04,4:58,6:35
Feb,19,5:30,12:43,4:04,4:58,6:36
Feb,22,5:29,12:43,4:04,4:58,6:36
Feb,25,5:28,12:42,4:04,4:59,6:37
Feb,28,5:27,12:42,4:04,4:59,6:38
Mar,1,5:25,12:41,4:04,4:59,6:38
Mar,4,5:24,12:41,4:04,4:59,6:39
Mar,7,5:22,12:40,4:04,4:59,6:39
Mar,10,5:20,12:39,3:58,4:58,6:39
Mar,13,5:19,12:38,3:57,4:58,6:39
Mar,16,5:17,12:38,3:55,4:57,6:39
Mar,19,5:15,12:37,3:53,4:57,6:40
Mar,22,5:14,12:36,3:53,4:57,6:40
Mar,25,5:12,12:35,3:51,4:56,6:40
Mar,28,5:10,12:34,3:49,4:55,6:40
Apr,1,5:07,12:33,3:47,4:54,6:40
Apr,4,5:05,12:32,3:45,4:53,6:40
Apr,7,5:04,12:31,3:43,4:52,6:41
Apr,10,5:02,12:30,3:41,4:51,6:41
Apr,13,4:59,12:30,3:39,4:51,6:41
Apr,16,4:57,12:29,3:36,4:50,6:41
Apr,19,4:55,12:28,3:35,4:49,6:41
Apr,22,4:53,12:28,3:33,4:48,6:42
Apr,25,4:51,12:27,3:34,4:47,6:42
Apr,28,4:49,12:26,3:35,4:48,6:42
May,1,4:47,12:26,3:36,4:50,6:42
May,4,4:46,12:26,3:38,4:51,6:42
May,7,4:44,12:25,3:39,4:51,6:42
May,10,4:43,12:25,3:41,4:52,6:43
May,13,4:41,12:25,3:43,4:53,6:44
May,16,4:40,12:25,3:44,4:54,6:45
May,19,4:38,12:25,3:46,4:56,6:47
May,22,4:37,12:26,3:48,4:57,6:48
May,25,4:37,12:26,3:49,4:57,6:48
May,28,4:38,12:26,3:49,4:57,6:48
Jun,1,4:37,12:27,3:51,4:59,6:50
Jun,4,4:36,12:27,3:51,4:59,6:51
Jun,7,4:36,12:28,3:53,4:59,6:51
Jun,10,4:36,12:29,3:53,4:59,6:52
Jun,13,4:36,12:29,3:54,4:59,6:52
Jun,16,4:37,12:30,3:55,4:59,6:53
Jun,19,4:37,12:30,3:56,4:59,6:54
Jun,22,4:38,12:31,3:57,4:59,6:55
Jun,25,4:38,12:31,3:57,4:59,6:55
Jun,28,4:39,12:32,3:58,4:59,6:56
Jul,1,4:40,12:33,3:59,5:00,6:57
Jul,4,4:41,12:33,3:59,5:00,6:57
Jul,7,4:42,12:34,3:59,5:00,6:57
Jul,10,4:43,12:34,3:59,5:00,6:57
Jul,13,4:45,12:35,3:59,5:00,6:57
Jul,16,4:46,12:35,3:58,4:59,6:56
Jul,19,4:46,12:35,3:58,4:59,6:56
Jul,22,4:47,12:35,3:56,4:58,6:56
Jul,25,4:48,12:35,3:55,4:56,6:55
Jul,28,4:50,12:35,3:54,4:55,6:55
Aug,1,4:51,12:35,3:53,4:52,6:54
Aug,4,4:53,12:35,3:51,4:50,6:53
Aug,7,4:54,12:35,3:49,4:48,6:52
Aug,10,4:54,12:34,3:46,4:45,6:51
Aug,13,4:56,12:33,3:44,4:43,6:50
Aug,16,4:57,12:33,3:42,4:40,6:48
Aug,19,4:57,12:32,3:40,4:38,6:47
Aug,22,4:57,12:32,3:38,4:36,6:46
Aug,25,4:57,12:31,3:36,4:34,6:44
Aug,28,4:58,12:30,3:33,4:32,6:42
Sep,1,4:58,12:29,3:30,4:28,6:40
Sep,4,4:59,12:28,3:27,4:25,6:39
Sep,7,5:00,12:27,3:24,4:22,6:36
Sep,10,5:00,12:26,3:21,4:18,6:34
Sep,13,5:00,12:25,3:19,4:15,6:32
Sep,16,5:00,12:24,3:16,4:12,6:30
Sep,19,5:00,12:23,3:13,4:09,6:28
Sep,22,5:00,12:22,3:10,4:06,6:26
Sep,25,5:00,12:21,3:08,4:03,6:24
Sep,28,5:00,12:20,3:05,4:00,6:22
Oct,1,5:00,12:19,3:03,3:57,6:20
Oct,4,5:00,12:18,3:01,3:54,6:18
Oct,7,5:00,12:17,2:59,3:51,6:16
Oct,10,5:00,12:16,2:57,3:48,6:14
Oct,13,5:00,12:15,2:56,3:46,6:12
Oct,16,5:00,12:15,2:55,3:43,6:11
Oct,19,5:00,12:14,2:54,3:41,6:09
Oct,22,5:00,12:14,2:53,3:39,6:07
Oct,25,5:00,12:13,2:52,3:36,6:06
Oct,28,5:00,12:13,2:52,3:34,6:05
Nov,1,5:01,12:13,2:53,3:32,6:04
Nov,4,5:01,12:13,2:53,3:31,6:04
Nov,7,5:02,12:13,2:54,3:30,6:04
Nov,10,5:03,12:13,2:55,3:30,6:04
Nov,13,5:04,12:13,2:56,3:30,6:04
Nov,16,5:05,12:13,2:57,3:30,6:04
Nov,19,5:06,12:14,2:59,3:31,6:05
Nov,22,5:07,12:15,3:01,3:32,6:06
Nov,25,5:08,12:16,3:03,3:34,6:07
Nov,28,5:09,12:17,3:05,3:36,6:09
Dec,1,5:10,12:18,3:07,3:39,6:11
Dec,4,5:12,12:19,3:10,3:42,6:13
Dec,7,5:13,12:21,3:12,3:45,6:16
Dec,10,5:15,12:22,3:15,3:48,6:18
Dec,13,5:16,12:24,3:18,3:51,6:21
Dec,16,5:18,12:26,3:21,3:54,6:24
Dec,19,5:20,12:27,3:23,3:57,6:26
Dec,22,5:21,12:29,3:26,4:00,6:29
Dec,25,5:23,12:31,3:29,4:03,6:32
Dec,28,5:24,12:33,3:31,4:06,6:34`;

let parsedTimetableData = null;

function parseTimetable() {
    if (parsedTimetableData) return parsedTimetableData;
    const monthMap = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const db = {};
    for (let i = 1; i <= 12; i++) db[i] = [];

    const lines = RAW_TIMETABLE_CSV.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 7) continue;
        const mNum = monthMap[cols[0]];
        if (!mNum) continue;
        db[mNum].push({
            day: parseInt(cols[1]),
            Subhi: cols[2],
            Luhar: cols[3],
            Asar: cols[4],
            Magrib: cols[5],
            Isha: cols[6]
        });
    }
    parsedTimetableData = db;
    return db;
}

function getClosestTimetableRow(targetDate, db) {
    const monthEntries = db[targetDate.getMonth() + 1];
    const targetDay = targetDate.getDate();
    if (!monthEntries || monthEntries.length === 0) return null;
    
    let matchedRow = monthEntries[0];
    for (let i = 0; i < monthEntries.length; i++) {
        if (monthEntries[i].day <= targetDay) {
            matchedRow = monthEntries[i];
        } else {
            break;
        }
    }
    return matchedRow;
}

function calculateLocalPrayerTimes(targetDate) {
    const db = parseTimetable();
    const chart = getClosestTimetableRow(targetDate, db);
    if (!chart) return null;

    const get24h = (rawTime, offsetMin, isPm) => {
        let [h, m] = rawTime.split(':').map(Number);
        if (isPm && h < 12) h += 12;
        let totalMin = h * 60 + m + offsetMin;
        let newH = Math.floor(totalMin / 60) % 24;
        let newM = totalMin % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    };

    // --- CORRECTION FOR PRINTED TIMETABLE COLUMN SHIFT BUG ---
    // Column 5 (Asar)   = Shafi Asr (e.g. 3:48)
    // Column 6 (Magrib) = Hanafi Asr (e.g. 4:57) -> NOT real Maghrib!
    // Column 7 (Isha)   = Real Sunset/Maghrib (e.g. 6:48)
    // Isha is calculated as Sunset/Maghrib + 75 minutes (1 hour 15 minutes)
    return {
        fajr: get24h(chart.Subhi, 4, false),
        dhuhr: get24h(chart.Luhar, 3, true),
        asr: get24h(chart.Asar, 5, true),
        maghrib: get24h(chart.Isha, 3, true), // Map Maghrib to Column 7 (Isha) + 3 mins offset
        isha: get24h(chart.Isha, 78, true)    // Isha is Column 7 + 78 mins (which is Maghrib Azan + 75 mins!)
    };
}

// ===== Compute Iqama Time String (Using Timetable-Specific Rules) =====
function getIqamaTime12(prayerTimeStr, key) {
    if (!prayerTimeStr) return '--:--';
    const clean = prayerTimeStr.replace(/\s*\(.*\)/, '').trim();
    let [h, m] = clean.split(':').map(Number);
    
    // Friday Jumu'ah Special Logic (Dhuhr Iqamah is statically 12:45 PM)
    const now = getNow();
    if (key === 'dhuhr' && now.getDay() === 5) {
        return "12:45 PM";
    }
    
    // Apply calculation offsets: Fajr (+15), Dhuhr (+15), Asr (+15), Maghrib (+7), Isha (+15)
    let interval = 15;
    if (key === 'maghrib') {
        interval = 7;
    }
    
    const totalMin = h * 60 + m + interval;
    let ih = Math.floor(totalMin / 60) % 24;
    const im = totalMin % 60;
    const period = ih >= 12 ? 'PM' : 'AM';
    ih = ih % 12 || 12;
    return `${ih}:${String(im).padStart(2, '0')} ${period}`;
}

// ===== Fetch Prayer Times (100% Precise Offline Calculation Engine) =====
async function fetchPrayerTimes() {
    const now = getNow();
    
    // 1. Instantly calculate prayer times locally from our raw printed dataset!
    const localTimes = calculateLocalPrayerTimes(now);
    if (localTimes) {
        prayerTimesData = localTimes;
        updatePrayerDisplay();
    }
    
    // 2. Fetch current Hijri date progressively from Aladhan API (with graceful offline fallback)
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${CONFIG.latitude}&longitude=${CONFIG.longitude}&method=${CONFIG.method}&school=${CONFIG.school}`;
    try {
        const res = await fetch(url);
        const json = await res.json();
        
        // Update Hijri date from response
        const h = json.data.date.hijri;
        const hijriEl = document.getElementById('hijriDate');
        if (hijriEl) {
            hijriEl.textContent = `${h.day} ${h.month.en} ${h.year} AH`;
        }
    } catch (e) {
        console.error('Failed to fetch progressive Hijri date:', e);
        // Retry fetch in 30 seconds for Hijri date updates
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

    const hoursEl = document.getElementById('heroHours');
    const minutesEl = document.getElementById('heroMinutes');
    const secondsEl = document.getElementById('heroSeconds');
    const periodEl = document.getElementById('heroPeriod');

    if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(m).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(s).padStart(2, '0');
    if (periodEl) periodEl.textContent = period;

    // Smooth progress bar update for the current minute
    const progressFill = document.getElementById('heroProgressFill');
    if (progressFill) {
        const ms = now.getMilliseconds();
        const percent = ((s + ms / 1000) / 60) * 100;
        progressFill.style.width = `${percent}%`;
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

// ===== Dynamic Notice Board Sync =====
function initNoticeBoard() {
    refreshNotice();

    // Listen for changes from the admin page in real time
    window.addEventListener('storage', (e) => {
        if (e.key === 'masjidNotice1' || e.key === 'masjidNotice2' || e.key === 'masjidNotice3' || e.key === 'masjidNotice') {
            refreshNotice();
        }
    });

    // Also check local storage every 3 seconds as a fallback
    setInterval(refreshNotice, 3000);
}

function refreshNotice() {
    const el = document.getElementById('noticeMessage');
    const container = document.querySelector('.notice-board-container');
    if (!el) return;

    // Load messages individually
    const raw1 = localStorage.getItem('masjidNotice1');
    const raw2 = localStorage.getItem('masjidNotice2');
    const raw3 = localStorage.getItem('masjidNotice3');

    // Default populated values on initial launch before any admin publish
    const m1 = raw1 !== null ? raw1.trim() : "Zakariya Juma Masjid Thana Notice Board - അറിയിപ്പുകൾ ഇവിടെ കാണാം.";
    const m2 = raw2 !== null ? raw2.trim() : "";
    const m3 = raw3 !== null ? raw3.trim() : "";

    const activeMsgs = [m1, m2, m3].filter(Boolean);

    if (activeMsgs.length === 0) {
        // Hide notice board container completely if there is nothing to display
        if (container) container.style.display = 'none';
        el.innerHTML = '';
    } else {
        // Show notice board container and display active messages stacked cleanly
        if (container) container.style.display = 'flex';
        
        if (activeMsgs.length === 1) {
            el.innerHTML = activeMsgs[0];
        } else {
            // Display formatted list inside the spacious 3-line container
            el.innerHTML = activeMsgs.map(msg => `<div class="notice-line" style="margin-bottom: 4px; line-height: 1.4;">• ${msg}</div>`).join('');
        }
    }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    createStars();
    addRingGradient();
    updateGregorianDate();
    updateSky();
    initTicker();
    initNoticeBoard();
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

