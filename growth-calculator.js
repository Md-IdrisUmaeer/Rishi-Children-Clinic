document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('growthForm');
    if (!form) return; // Growth calculator not present on this page

    const dobInput = document.getElementById('gcDob');
    const dateInput = document.getElementById('gcDate');
    const sexInput = document.getElementById('gcSex');
    const heightInput = document.getElementById('gcHeight');
    const weightInput = document.getElementById('gcWeight');
    const errorEl = document.getElementById('gcError');
    const resultsBox = document.getElementById('growthResults');
    const summaryBox = document.getElementById('gcSummary');
    const approxNote = document.getElementById('gcApproxNote');
    const metricSelect = document.getElementById('growthChartMetric');
    const bookApptBtn = document.getElementById('gcBookAppt');

    // Default measurement date = today; nobody can pick a future date/DOB
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
    dateInput.max = todayStr;
    dobInput.max = todayStr;

    const DATA_FILES = {
        who: {
            weight: 'data/who-weight-for-age.json',
            height: 'data/who-height-for-age.json',
            bmi: 'data/who-bmi-for-age.json'
        },
        iap: {
            weight: 'data/iap-weight-for-age.json',
            height: 'data/iap-height-for-age.json',
            bmi: 'data/iap-bmi-for-age.json'
        }
    };

    const METRIC_LABEL = { weight: 'Weight', height: 'Height', bmi: 'BMI' };

    // Standard-normal Z values for the classic clinical percentile lines (IAP charts, 5-18 yrs)
    const WHO_LINE_PERCENTILES = [3, 15, 50, 85, 97];
    const WHO_LINE_Z = { 3: -1.8808, 15: -1.0364, 50: 0, 85: 1.0364, 97: 1.8808 };

    // WHO growth charts (0-5 yrs) are read clinically as SD (Z-score) lines, not percentiles
    const WHO_SD_LEVELS = [-3, -2, -1, 0, 1, 2, 3];
    const WHO_SD_LABEL = { '-3': '-3 SD', '-2': '-2 SD', '-1': '-1 SD', '0': 'Median', '1': '+1 SD', '2': '+2 SD', '3': '+3 SD' };

    const dataCache = {};
    let chartInstance = null;
    let lastResults = null; // { weight: {...}, height: {...}, bmi: {...}, standard, ageMonths, sex }

    async function loadData(standard, metric) {
        const key = standard + '-' + metric;
        if (dataCache[key]) return dataCache[key];
        const res = await fetch(DATA_FILES[standard][metric]);
        if (!res.ok) throw new Error('Could not load ' + DATA_FILES[standard][metric]);
        const json = await res.json();
        dataCache[key] = json;
        return json;
    }

    // Standard normal CDF (Zelen & Severo approximation) — no external stats library needed
    function normalCDF(z) {
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989423 * Math.exp(-z * z / 2);
        let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        p = z > 0 ? 1 - p : p;
        return p;
    }

    function percentileFromZ(z) {
        return Math.min(99.9, Math.max(0.1, normalCDF(z) * 100));
    }

    function lmsZ(value, L, M, S) {
        if (Math.abs(L) < 1e-6) return Math.log(value / M) / S;
        return (Math.pow(value / M, L) - 1) / (L * S);
    }

    function lmsValueAtZ(Z, L, M, S) {
        if (Math.abs(L) < 1e-6) return M * Math.exp(S * Z);
        return M * Math.pow(1 + L * S * Z, 1 / L);
    }

    // Interpolate an LMS row for an exact fractional age (months) from the WHO monthly table
    function interpolateLMS(rows, age) {
        if (age <= rows[0].age) return rows[0];
        if (age >= rows[rows.length - 1].age) return rows[rows.length - 1];
        for (let i = 0; i < rows.length - 1; i++) {
            const a = rows[i], b = rows[i + 1];
            if (age >= a.age && age <= b.age) {
                const frac = (b.age === a.age) ? 0 : (age - a.age) / (b.age - a.age);
                return {
                    age,
                    L: a.L + (b.L - a.L) * frac,
                    M: a.M + (b.M - a.M) * frac,
                    S: a.S + (b.S - a.S) * frac
                };
            }
        }
        return rows[rows.length - 1];
    }

    // Interpolate an IAP percentile row (array of values) for a fractional age (years)
    function interpolateTableRow(rows, age) {
        if (age <= rows[0].age) return rows[0];
        if (age >= rows[rows.length - 1].age) return rows[rows.length - 1];
        for (let i = 0; i < rows.length - 1; i++) {
            const a = rows[i], b = rows[i + 1];
            if (age >= a.age && age <= b.age) {
                const frac = (b.age === a.age) ? 0 : (age - a.age) / (b.age - a.age);
                return {
                    age,
                    values: a.values.map((v, idx) => v + (b.values[idx] - v) * frac)
                };
            }
        }
        return rows[rows.length - 1];
    }

    // Given a measurement and a percentile table row, estimate the percentile by
    // linear interpolation between the two nearest published percentile points
    // (with linear extrapolation past the 3rd/97th tails, clamped to [0.1, 99.9]).
    function percentileFromTable(value, percentiles, values) {
        const n = values.length;
        if (value <= values[0]) {
            const slope = (percentiles[1] - percentiles[0]) / (values[1] - values[0]);
            return Math.min(99.9, Math.max(0.1, percentiles[0] + slope * (value - values[0])));
        }
        if (value >= values[n - 1]) {
            const slope = (percentiles[n - 1] - percentiles[n - 2]) / (values[n - 1] - values[n - 2]);
            return Math.min(99.9, Math.max(0.1, percentiles[n - 1] + slope * (value - values[n - 1])));
        }
        for (let i = 0; i < n - 1; i++) {
            if (value >= values[i] && value <= values[i + 1]) {
                const frac = (value - values[i]) / (values[i + 1] - values[i]);
                return percentiles[i] + (percentiles[i + 1] - percentiles[i]) * frac;
            }
        }
        return 50;
    }

    function ageInMonths(dob, measureDate) {
        const msPerDay = 86400000;
        const days = Math.round((measureDate - dob) / msPerDay);
        return days / 30.4375; // average month length, matches WHO age convention
    }

    function ordinal(n) {
        const rounded = Math.round(n);
        const s = ['th', 'st', 'nd', 'rd'];
        const v = rounded % 100;
        return rounded + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    async function calcMetric(standard, metric, sex, ageMonths, ageYears, measurement) {
        if (standard === 'who') {
            const data = await loadData('who', metric);
            const rows = data[sex];
            const row = interpolateLMS(rows, ageMonths);
            const z = lmsZ(measurement, row.L, row.M, row.S);
            return {
                percentile: percentileFromZ(z),
                z,
                method: 'lms',
                data,
                approximated: false
            };
        }
        const data = await loadData('iap', metric);
        const rows = data[sex];
        const row = interpolateTableRow(rows, ageYears);
        const p = percentileFromTable(measurement, data.percentiles, row.values);
        return {
            percentile: p,
            z: null,
            method: 'table',
            data,
            approximated: !!data.approximated
        };
    }

    function renderSummary(results) {
        summaryBox.innerHTML = '';
        ['weight', 'height', 'bmi'].forEach(metric => {
            const r = results[metric];
            if (!r) return;
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl p-4 shadow-sm border border-brand-lavender/40';
            const zLine = (r.z !== null && !isNaN(r.z)) ? `<p class="text-[11px] text-brand-textSoft mt-1">Z = ${r.z.toFixed(2)}</p>` : '';
            card.innerHTML = `
                <p class="text-xs font-bold uppercase tracking-wide text-brand-textSoft">${METRIC_LABEL[metric]}</p>
                <p class="text-lg font-bold text-brand-text mt-1">${ordinal(r.percentile)} percentile</p>
                ${zLine}
            `;
            summaryBox.appendChild(card);
        });
    }

    function buildWhoChartDatasets(rows, childAgeMonths, childValue) {
        const ageMin = Math.max(0, childAgeMonths - 24);
        const ageMax = Math.min(60, childAgeMonths + 24);
        const step = 1;
        const labels = [];
        const seriesBySd = {};
        WHO_SD_LEVELS.forEach(sd => seriesBySd[sd] = []);

        for (let age = Math.max(0, Math.floor(ageMin)); age <= Math.min(60, Math.ceil(ageMax)); age += step) {
            const row = interpolateLMS(rows, age);
            labels.push(age);
            WHO_SD_LEVELS.forEach(sd => {
                seriesBySd[sd].push(lmsValueAtZ(sd, row.L, row.M, row.S));
            });
        }

        const datasets = WHO_SD_LEVELS.map(sd => ({
            label: WHO_SD_LABEL[sd],
            data: seriesBySd[sd],
            borderColor: sd === 0 ? '#C6A8E8' : '#9FCBEC',
            borderWidth: sd === 0 ? 2.5 : 1.5,
            borderDash: sd === 0 ? [] : [4, 3],
            pointRadius: 0,
            tension: 0.3
        }));

        datasets.push({
            label: 'Your child',
            data: labels.map(age => age === Math.round(childAgeMonths) ? childValue : null),
            borderColor: '#fff',
            backgroundColor: '#F4426E',
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: labels.map(age => age === Math.round(childAgeMonths) ? 4 : 0),
            pointHoverRadius: 6,
            showLine: false,
            type: 'scatter'
        });

        return { labels, datasets, xLabel: 'Age (months)' };
    }

    function buildIapChartDatasets(rows, percentiles, childAgeYears, childValue) {
        const labels = rows.map(r => r.age);
        // Pick the 5 lines closest to the classic 3/15/50/85/97 clinical set
        const targetPs = [3, 15, 50, 85, 97];
        const chosen = targetPs.map(t => percentiles.reduce((best, p) =>
            Math.abs(p - t) < Math.abs(best - t) ? p : best, percentiles[0]));
        const uniqueChosen = [...new Set(chosen)];

        const datasets = uniqueChosen.map(p => {
            const idx = percentiles.indexOf(p);
            return {
                label: p + 'th percentile',
                data: rows.map(r => r.values[idx]),
                borderColor: p === 50 ? '#C6A8E8' : '#9FCBEC',
                borderWidth: p === 50 ? 2.5 : 1.5,
                borderDash: p === 50 ? [] : [4, 3],
                pointRadius: 0,
                tension: 0.3
            };
        });

        const nearestAgeIdx = rows.reduce((best, r, i) =>
            Math.abs(r.age - childAgeYears) < Math.abs(rows[best].age - childAgeYears) ? i : best, 0);

        datasets.push({
            label: 'Your child',
            data: labels.map((age, i) => i === nearestAgeIdx ? childValue : null),
            borderColor: '#fff',
            backgroundColor: '#F4426E',
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: labels.map((age, i) => i === nearestAgeIdx ? 4 : 0),
            pointHoverRadius: 6,
            showLine: false,
            type: 'scatter'
        });

        return { labels, datasets, xLabel: 'Age (years)' };
    }

    function renderChart(metric) {
        if (!lastResults) return;
        const r = lastResults[metric];
        const ctx = document.getElementById('growthChart').getContext('2d');

        let chartData;
        if (lastResults.standard === 'who') {
            const rows = r.data[lastResults.sex];
            chartData = buildWhoChartDatasets(rows, lastResults.ageMonths, r.measurement);
        } else {
            const rows = r.data[lastResults.sex];
            chartData = buildIapChartDatasets(rows, r.data.percentiles, lastResults.ageYears, r.measurement);
        }

        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: chartData.labels, datasets: chartData.datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                plugins: {
                    legend: { display: true, labels: { font: { size: 10 }, color: '#8A7897' } },
                    title: {
                        display: true,
                        text: METRIC_LABEL[metric] + '-for-age' + (lastResults.standard === 'who' ? ' (WHO SD chart)' : ' (IAP percentile chart)'),
                        color: '#5B4B66',
                        font: { size: 13, weight: 'bold' }
                    }
                },
                scales: {
                    x: { title: { display: true, text: chartData.xLabel, color: '#8A7897', font: { size: 10 } } },
                    y: { title: { display: true, text: METRIC_LABEL[metric], color: '#8A7897', font: { size: 10 } } }
                }
            }
        });
        document.getElementById('growthChart').parentElement.style.height = '360px';
    }

    metricSelect.addEventListener('change', () => renderChart(metricSelect.value));

    if (bookApptBtn) {
        bookApptBtn.addEventListener('click', () => {
            const target = document.getElementById('appointment');
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.classList.add('hidden');

        const dob = new Date(dobInput.value);
        const measureDate = new Date(dateInput.value || todayStr);
        const sex = sexInput.value;
        const heightCm = parseFloat(heightInput.value);
        const weightKg = parseFloat(weightInput.value);

        if (!dobInput.value || !sex || isNaN(heightCm) || isNaN(weightKg)) {
            errorEl.textContent = 'Please fill in all fields.';
            errorEl.classList.remove('hidden');
            return;
        }
        if (measureDate < dob) {
            errorEl.textContent = 'Measurement date cannot be before the date of birth.';
            errorEl.classList.remove('hidden');
            return;
        }

        const ageMonths = ageInMonths(dob, measureDate);
        const ageYears = ageMonths / 12;

        if (ageYears > 18) {
            errorEl.textContent = 'This calculator covers ages 0-18 years only.';
            errorEl.classList.remove('hidden');
            return;
        }

        const bmi = weightKg / Math.pow(heightCm / 100, 2);
        const standard = ageYears < 5 ? 'who' : 'iap';

        try {
            const [weightRes, heightRes, bmiRes] = await Promise.all([
                calcMetric(standard, 'weight', sex, ageMonths, ageYears, weightKg),
                calcMetric(standard, 'height', sex, ageMonths, ageYears, heightCm),
                calcMetric(standard, 'bmi', sex, ageMonths, ageYears, bmi)
            ]);
            weightRes.measurement = weightKg;
            heightRes.measurement = heightCm;
            bmiRes.measurement = bmi;

            lastResults = {
                weight: weightRes,
                height: heightRes,
                bmi: bmiRes,
                standard,
                sex,
                ageMonths,
                ageYears
            };

            renderSummary(lastResults);

            const anyApprox = weightRes.approximated || heightRes.approximated || bmiRes.approximated;
            if (standard === 'iap') {
                approxNote.classList.remove('hidden');
                approxNote.textContent = anyApprox
                    ? 'Note: some IAP reference values used here are estimated from published growth charts and are flagged for clinical verification — please confirm with the doctor.'
                    : 'Reference: IAP 2015 growth charts (5-18 years).';
            } else {
                approxNote.classList.add('hidden');
            }

            metricSelect.value = 'weight';
            resultsBox.classList.remove('hidden');
            resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Chart rendering is best-effort — a Chart.js/canvas hiccup shouldn't hide
            // percentile results that were already computed successfully above.
            try {
                renderChart('weight');
            } catch (chartErr) {
                console.error('Growth chart render failed:', chartErr);
            }
        } catch (err) {
            console.error('Growth percentile calculation failed:', err);
            if (window.location.protocol === 'file:') {
                errorEl.textContent = 'This page was opened directly as a file, so the browser blocks it from loading the growth chart data (data/*.json). Serve the site over http(s) — e.g. run "npx serve" in the project folder, or view the deployed Vercel site — then try again.';
            } else {
                errorEl.textContent = 'Could not load growth chart data (data/*.json). Please check your connection and try again.';
            }
            errorEl.classList.remove('hidden');
        }
    });
});
