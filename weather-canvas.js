// =====================================================================
// Apple iPhone Weather App — Dynamic Animated Canvas Background
// =====================================================================
// Renders: Sky gradient, Sun/Moon, Clouds, Stars, Rain, Atmospheric haze
// All at 60fps using requestAnimationFrame for silky-smooth motion
// =====================================================================

const WeatherCanvas = (() => {
    let canvas, ctx, W, H, dpr;
    let animId = null;
    let time = 0;

    // --- State (driven by app.js) ---
    let skyState = 'day';     // night, dawn, morning, day, golden, dusk
    let weatherState = 'clear'; // clear, cloudy, rainy

    // --- Interpolated colors (smooth transitions) ---
    let currentColors = null;
    let targetColors = null;
    let colorLerp = 1;

    // --- Particle arrays ---
    let clouds = [];
    let stars = [];
    let raindrops = [];

    // ===================== SKY COLOR PALETTES =====================
    const SKY_PALETTES = {
        night: {
            top:    [8, 8, 35],
            mid:    [12, 20, 50],
            low:    [15, 25, 55],
            bottom: [8, 12, 30],
            cloud:  [35, 45, 75, 0.3],
            ambient: [80, 80, 180, 0.06],
        },
        dawn: {
            top:    [25, 15, 55],
            mid:    [80, 35, 70],
            low:    [180, 80, 50],
            bottom: [230, 150, 60],
            cloud:  [255, 190, 140, 0.55],
            ambient: [255, 140, 60, 0.1],
        },
        morning: {
            top:    [30, 100, 170],
            mid:    [70, 150, 210],
            low:    [140, 195, 230],
            bottom: [200, 225, 180],
            cloud:  [255, 255, 255, 0.8],
            ambient: [255, 220, 120, 0.06],
        },
        day: {
            top:    [25, 110, 200],
            mid:    [55, 150, 225],
            low:    [100, 180, 240],
            bottom: [160, 210, 250],
            cloud:  [255, 255, 255, 0.85],
            ambient: [255, 255, 220, 0.04],
        },
        golden: {
            top:    [40, 75, 140],
            mid:    [120, 100, 110],
            low:    [200, 130, 70],
            bottom: [240, 170, 50],
            cloud:  [255, 210, 140, 0.65],
            ambient: [255, 170, 50, 0.08],
        },
        dusk: {
            top:    [20, 15, 50],
            mid:    [70, 30, 60],
            low:    [160, 55, 50],
            bottom: [200, 85, 45],
            cloud:  [180, 110, 100, 0.5],
            ambient: [200, 60, 40, 0.07],
        },
    };

    // ===================== INITIALIZATION =====================
    function init() {
        canvas = document.getElementById('weatherCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio || 1;

        resize();
        window.addEventListener('resize', resize);

        currentColors = getColorSet('day');
        targetColors = getColorSet('day');

        initClouds();
        initStars();

        loop();
    }

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ===================== COLOR UTILITIES =====================
    function getColorSet(sky, weather = weatherState) {
        const p = SKY_PALETTES[sky] || SKY_PALETTES.day;
        
        let colors = {
            top: [...p.top],
            mid: [...p.mid],
            low: [...p.low],
            bottom: [...p.bottom],
            cloud: [...p.cloud],
            ambient: [...p.ambient],
        };

        // If it's rainy, blend sky gradients with desaturated dark slate blue tones
        if (weather === 'rainy') {
            const blend = (c, target, amount) => c.map((v, i) => i === 3 ? v : v + (target[i] - v) * amount);
            colors.top = blend(colors.top, [20, 25, 40], 0.75);
            colors.mid = blend(colors.mid, [32, 40, 55], 0.7);
            colors.low = blend(colors.low, [45, 52, 68], 0.65);
            colors.bottom = blend(colors.bottom, [55, 62, 78], 0.6);
            colors.cloud = [85, 95, 110, colors.cloud[3] || 0.75]; // realistic soft grey-blue rain clouds!
        }
        // If it's cloudy, blend sky gradients with a soft overcast misty desaturated grey
        else if (weather === 'cloudy') {
            const blend = (c, target, amount) => c.map((v, i) => i === 3 ? v : v + (target[i] - v) * amount);
            colors.top = blend(colors.top, [75, 95, 120], 0.55);
            colors.mid = blend(colors.mid, [100, 115, 135], 0.5);
            colors.low = blend(colors.low, [120, 130, 145], 0.45);
            colors.bottom = blend(colors.bottom, [135, 145, 155], 0.4);
            colors.cloud = [215, 220, 228, colors.cloud[3] || 0.8]; // fluffy white-grey clouds
        }
        else {
            // Clear weather: clouds should be bright and colorful depending on the time of day
            if (sky === 'day') {
                colors.cloud = [255, 255, 255, 0.85];
            } else if (sky === 'morning') {
                colors.cloud = [255, 250, 235, 0.8];
            } else if (sky === 'golden') {
                colors.cloud = [255, 225, 175, 0.75];
            } else if (sky === 'dawn') {
                colors.cloud = [255, 195, 150, 0.65];
            } else if (sky === 'dusk') {
                colors.cloud = [190, 120, 110, 0.55];
            } else {
                colors.cloud = [40, 50, 80, 0.35]; // dark blue night clouds
            }
        }

        return colors;
    }

    function lerpColor(a, b, t) {
        return a.map((v, i) => v + (b[i] - v) * t);
    }

    function rgbaStr(arr) {
        if (arr.length === 4) return `rgba(${arr[0]|0},${arr[1]|0},${arr[2]|0},${arr[3].toFixed(3)})`;
        return `rgb(${arr[0]|0},${arr[1]|0},${arr[2]|0})`;
    }

    // ===================== PUBLIC STATE SETTERS =====================
    function setSky(state) {
        if (state === skyState) return;
        skyState = state;
        targetColors = getColorSet(state, weatherState);
        colorLerp = 0;
    }

    function setWeather(state) {
        if (state === weatherState) return;
        weatherState = state;
        
        // Softly transition color palettes
        targetColors = getColorSet(skyState, state);
        colorLerp = 0;

        // Adjust rain
        if (state === 'rainy' && raindrops.length === 0) {
            initRain();
        } else if (state !== 'rainy') {
            raindrops = [];
        }
    }

    // ===================== PARTICLE INITIALIZATION =====================
    function initClouds() {
        clouds = [];
        const count = 8;
        for (let i = 0; i < count; i++) {
            clouds.push({
                x: Math.random() * W * 1.5 - W * 0.25,
                y: H * 0.06 + Math.random() * H * 0.55,
                w: 180 + Math.random() * 280,
                h: 40 + Math.random() * 50,
                speed: 8 + Math.random() * 18,  // px per second
                opacity: 0.25 + Math.random() * 0.45,
                bumps: 3 + Math.floor(Math.random() * 3),
                layer: i < 3 ? 'far' : (i < 6 ? 'mid' : 'near'),
            });
        }
        // Sort by layer for depth
        clouds.sort((a, b) => {
            const order = { far: 0, mid: 1, near: 2 };
            return order[a.layer] - order[b.layer];
        });
    }

    function initStars() {
        stars = [];
        for (let i = 0; i < 80; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.65,
                r: 0.4 + Math.random() * 1.5,
                twinkleSpeed: 0.5 + Math.random() * 2,
                twinkleOffset: Math.random() * Math.PI * 2,
                baseOpacity: 0.3 + Math.random() * 0.6,
            });
        }
    }

    function initRain() {
        raindrops = [];
        for (let i = 0; i < 120; i++) {
            raindrops.push(makeRaindrop());
        }
    }

    function makeRaindrop() {
        return {
            x: Math.random() * (W + 200) - 100,
            y: Math.random() * -H,
            len: 15 + Math.random() * 25,
            speed: 600 + Math.random() * 400,
            opacity: 0.15 + Math.random() * 0.35,
            wind: -40 - Math.random() * 30, // slight angle
        };
    }

    // ===================== MAIN RENDER LOOP =====================
    function loop() {
        const now = performance.now() / 1000;
        const dt = Math.min(now - (time || now), 0.05);
        time = now;

        // Smooth color transition
        if (colorLerp < 1) {
            colorLerp = Math.min(1, colorLerp + dt * 0.15); // ~7 second transition
            currentColors = {
                top: lerpColor(currentColors.top, targetColors.top, dt * 0.8),
                mid: lerpColor(currentColors.mid, targetColors.mid, dt * 0.8),
                low: lerpColor(currentColors.low, targetColors.low, dt * 0.8),
                bottom: lerpColor(currentColors.bottom, targetColors.bottom, dt * 0.8),
                cloud: lerpColor(currentColors.cloud, targetColors.cloud, dt * 0.8),
                ambient: lerpColor(currentColors.ambient, targetColors.ambient, dt * 0.8),
            };
        }

        ctx.clearRect(0, 0, W, H);

        drawSkyGradient();
        drawAmbientGlow();

        const showStars = (skyState === 'night' || skyState === 'dawn' || skyState === 'dusk');
        if (showStars) drawStars(dt);

        drawCelestialBody();
        drawClouds(dt);

        if (weatherState === 'rainy') drawRain(dt);

        drawAtmosphereHaze();

        animId = requestAnimationFrame(loop);
    }

    // ===================== SKY GRADIENT =====================
    function drawSkyGradient() {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, rgbaStr(currentColors.top));
        grad.addColorStop(0.35, rgbaStr(currentColors.mid));
        grad.addColorStop(0.7, rgbaStr(currentColors.low));
        grad.addColorStop(1, rgbaStr(currentColors.bottom));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ===================== AMBIENT GLOW =====================
    function drawAmbientGlow() {
        const c = currentColors.ambient;
        const glow1X = W * 0.3 + Math.sin(time * 0.1) * W * 0.05;
        const glow1Y = H * 0.2 + Math.cos(time * 0.08) * H * 0.05;
        const r1 = Math.min(W, H) * 0.5;

        const g1 = ctx.createRadialGradient(glow1X, glow1Y, 0, glow1X, glow1Y, r1);
        g1.addColorStop(0, `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${(c[3] * 1.5).toFixed(3)})`);
        g1.addColorStop(1, `rgba(${c[0]|0},${c[1]|0},${c[2]|0},0)`);
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, W, H);

        const glow2X = W * 0.7 + Math.cos(time * 0.07) * W * 0.04;
        const glow2Y = H * 0.7 + Math.sin(time * 0.12) * H * 0.04;
        const g2 = ctx.createRadialGradient(glow2X, glow2Y, 0, glow2X, glow2Y, r1 * 0.8);
        g2.addColorStop(0, `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${(c[3]).toFixed(3)})`);
        g2.addColorStop(1, `rgba(${c[0]|0},${c[1]|0},${c[2]|0},0)`);
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);
    }

    // ===================== STARS =====================
    function drawStars(dt) {
        let starAlpha = 1;
        if (skyState === 'dawn') starAlpha = 0.3;
        if (skyState === 'dusk') starAlpha = 0.5;

        stars.forEach(s => {
            const twinkle = 0.4 + 0.6 * ((Math.sin(time * s.twinkleSpeed + s.twinkleOffset) + 1) / 2);
            const a = s.baseOpacity * twinkle * starAlpha;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
            ctx.fill();
        });
    }

    // ===================== CELESTIAL BODY (SUN / MOON) =====================
    function drawCelestialBody() {
        if (weatherState === 'rainy') return; // hidden in rain

        if (skyState === 'night') {
            drawMoon();
        } else {
            drawSun();
        }
    }

    function drawSun() {
        // Position based on sky state
        let sunX, sunY, sunR, glowR;
        const baseR = Math.min(W, H) * 0.035;

        switch (skyState) {
            case 'dawn':
                sunX = W * 0.45; sunY = H * 0.78; sunR = baseR * 1.2; glowR = baseR * 8;
                break;
            case 'morning':
                sunX = W * 0.8; sunY = H * 0.25; sunR = baseR; glowR = baseR * 6;
                break;
            case 'day':
                sunX = W * 0.82; sunY = H * 0.12; sunR = baseR; glowR = baseR * 5;
                break;
            case 'golden':
                sunX = W * 0.75; sunY = H * 0.6; sunR = baseR * 1.3; glowR = baseR * 9;
                break;
            case 'dusk':
                sunX = W * 0.6; sunY = H * 0.82; sunR = baseR * 1.1; glowR = baseR * 7;
                break;
            default:
                sunX = W * 0.8; sunY = H * 0.15; sunR = baseR; glowR = baseR * 5;
        }

        // Gentle floating
        sunX += Math.sin(time * 0.05) * 5;
        sunY += Math.cos(time * 0.04) * 3;

        // Outer glow (pulsing)
        const pulse = 1 + Math.sin(time * 0.3) * 0.08;
        const outerGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, glowR * pulse);
        outerGlow.addColorStop(0, 'rgba(255, 240, 180, 0.25)');
        outerGlow.addColorStop(0.3, 'rgba(255, 200, 100, 0.08)');
        outerGlow.addColorStop(1, 'rgba(255, 180, 60, 0)');
        ctx.fillStyle = outerGlow;
        ctx.fillRect(0, 0, W, H);

        // Inner glow
        const innerGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.5);
        innerGlow.addColorStop(0, 'rgba(255, 255, 240, 0.9)');
        innerGlow.addColorStop(0.4, 'rgba(255, 230, 150, 0.4)');
        innerGlow.addColorStop(1, 'rgba(255, 200, 80, 0)');
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Sun disc
        const discGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
        discGrad.addColorStop(0, '#fffef5');
        discGrad.addColorStop(0.7, '#ffe680');
        discGrad.addColorStop(1, '#ffcc33');
        ctx.fillStyle = discGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
        ctx.fill();

        // Cloudy: dim sun
        if (weatherState === 'cloudy') {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = rgbaStr(currentColors.mid);
            ctx.beginPath();
            ctx.arc(sunX, sunY, sunR * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function drawMoon() {
        const moonX = W * 0.8 + Math.sin(time * 0.03) * 4;
        const moonY = H * 0.12 + Math.cos(time * 0.025) * 3;
        const moonR = Math.min(W, H) * 0.025;

        // Moon glow
        const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 6);
        glow.addColorStop(0, 'rgba(200, 210, 240, 0.15)');
        glow.addColorStop(1, 'rgba(150, 160, 200, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Moon disc
        ctx.fillStyle = '#e8e8f0';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fill();

        // Crescent shadow
        ctx.fillStyle = rgbaStr(currentColors.top);
        ctx.beginPath();
        ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.1, moonR * 0.85, 0, Math.PI * 2);
        ctx.fill();
    }

    // ===================== CLOUDS =====================
    function drawClouds(dt) {
        let cloudAlpha = 1;
        if (weatherState === 'rainy') cloudAlpha = 1.3;
        if (weatherState === 'cloudy') cloudAlpha = 1.2;
        if (skyState === 'night') cloudAlpha *= 0.4;

        clouds.forEach(c => {
            // Movement
            c.x += c.speed * dt;
            if (c.x > W + c.w) {
                c.x = -c.w - Math.random() * 200;
                c.y = H * 0.06 + Math.random() * H * 0.5;
            }

            // Vertical float
            const floatY = Math.sin(time * 0.15 + c.x * 0.001) * 4;

            const cc = currentColors.cloud;
            let alpha = c.opacity * cloudAlpha;
            if (c.layer === 'far') alpha *= 0.5;
            if (c.layer === 'near') alpha *= 1.2;
            alpha = Math.min(alpha, 1);

            const r = cc[0], g = cc[1], b = cc[2];

            drawSingleCloud(c.x, c.y + floatY, c.w, c.h, c.bumps, r, g, b, alpha);
        });
    }

    function drawSingleCloud(x, y, w, h, bumps, r, g, b, alpha) {
        ctx.save();
        
        // Overlapping soft radial gradient puffs to create fluffy cloud structures
        const cx = x + w / 2;
        const cy = y + h / 2;
        
        // Draw the cloud base puffs
        const numPuffs = 6;
        for (let i = 0; i < numPuffs; i++) {
            // Distribute puffs horizontally
            const offsetRatio = (i / (numPuffs - 1)) - 0.5; // -0.5 to 0.5
            const px = cx + offsetRatio * w * 0.7;
            const py = cy + (Math.sin(i * 2.2) * h * 0.08);
            const pr = (h * 0.75) + (Math.cos(i * 3.1) * h * 0.25); // puff radius
            
            // Soft volumetric gradient fading to 0 opacity at the edges
            const puffGrad = ctx.createRadialGradient(px, py, pr * 0.05, px, py, pr * 1.35);
            puffGrad.addColorStop(0, `rgba(${r|0}, ${g|0}, ${b|0}, ${alpha.toFixed(3)})`);
            puffGrad.addColorStop(0.35, `rgba(${r|0}, ${g|0}, ${b|0}, ${(alpha * 0.85).toFixed(3)})`);
            puffGrad.addColorStop(0.7, `rgba(${r|0}, ${g|0}, ${b|0}, ${(alpha * 0.25).toFixed(3)})`);
            puffGrad.addColorStop(1, `rgba(${r|0}, ${g|0}, ${b|0}, 0)`);
            
            ctx.fillStyle = puffGrad;
            ctx.beginPath();
            ctx.arc(px, py, pr * 1.35, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add top illuminated highlights to simulate sunlight reflecting on cloud tops
        if (weatherState !== 'rainy') {
            let hr = 255, hg = 255, hb = 255, ha = alpha * 0.35;
            if (skyState === 'night') { hr = 180; hg = 200; hb = 255; ha = alpha * 0.15; }
            else if (skyState === 'golden' || skyState === 'dawn') { hr = 255; hg = 215; hb = 160; ha = alpha * 0.45; }
            
            for (let i = 1; i < numPuffs - 1; i++) {
                const offsetRatio = (i / (numPuffs - 1)) - 0.5;
                const px = cx + offsetRatio * w * 0.6;
                const py = cy - h * 0.22 + (Math.sin(i * 1.5) * h * 0.04);
                const pr = (h * 0.55) + (Math.cos(i * 2.5) * h * 0.15);
                
                const highlightGrad = ctx.createRadialGradient(px, py - pr * 0.15, 0, px, py - pr * 0.15, pr * 1.15);
                highlightGrad.addColorStop(0, `rgba(${hr}, ${hg}, ${hb}, ${ha.toFixed(3)})`);
                highlightGrad.addColorStop(0.4, `rgba(${hr}, ${hg}, ${hb}, ${(ha * 0.55).toFixed(3)})`);
                highlightGrad.addColorStop(1, `rgba(${hr}, ${hg}, ${hb}, 0)`);
                
                ctx.fillStyle = highlightGrad;
                ctx.beginPath();
                ctx.arc(px, py, pr * 1.15, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }

    // ===================== RAIN =====================
    function drawRain(dt) {
        ctx.save();
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';

        raindrops.forEach(drop => {
            drop.y += drop.speed * dt;
            drop.x += drop.wind * dt;

            if (drop.y > H + 50) {
                Object.assign(drop, makeRaindrop());
                drop.y = -30;
            }

            const angle = Math.atan2(drop.speed, drop.wind);
            const endX = drop.x + Math.cos(angle) * drop.len;
            const endY = drop.y + Math.sin(angle) * drop.len;

            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = `rgba(200, 215, 240, ${drop.opacity.toFixed(2)})`;
            ctx.stroke();
        });

        ctx.restore();
    }

    // ===================== ATMOSPHERE HAZE =====================
    function drawAtmosphereHaze() {
        // Bottom atmospheric haze for depth
        const hazeGrad = ctx.createLinearGradient(0, H * 0.6, 0, H);
        const bc = currentColors.bottom;
        hazeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        hazeGrad.addColorStop(0.5, `rgba(${bc[0]|0},${bc[1]|0},${bc[2]|0},0.04)`);
        hazeGrad.addColorStop(1, `rgba(${bc[0]|0},${bc[1]|0},${bc[2]|0},0.12)`);
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, H * 0.6, W, H * 0.4);

        // Rainy: extra fog
        if (weatherState === 'rainy') {
            const fogGrad = ctx.createLinearGradient(0, 0, 0, H);
            fogGrad.addColorStop(0, 'rgba(40,50,65,0.1)');
            fogGrad.addColorStop(0.5, 'rgba(50,60,75,0.06)');
            fogGrad.addColorStop(1, 'rgba(30,40,55,0.15)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, W, H);
        }
    }

    // ===================== CLEANUP =====================
    function destroy() {
        if (animId) cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
    }

    // ===================== PUBLIC API =====================
    return { init, setSky, setWeather, destroy };
})();

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    WeatherCanvas.init();
});
