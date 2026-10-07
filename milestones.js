document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('devAgeSelect');
    if (!select) return; // Development section not present on this page

    const searchBtn = document.getElementById('devSearchBtn');
    const resultsBox = document.getElementById('devResults');
    const grossList = document.getElementById('devGrossMotorList');
    const fineList = document.getElementById('devFineMotorList');
    const socialList = document.getElementById('devSocialList');
    const languageList = document.getElementById('devLanguageList');

    let milestoneData = null;
    let sortedAges = []; // numeric ages, ascending

    function formatAgeLabel(months) {
        const n = Number(months);
        if (n < 12) return `${n} Month${n === 1 ? '' : 's'}`;
        if (n % 12 === 0) return `${n / 12} Year${n === 12 ? '' : 's'}`;
        return `${n} Months`;
    }

    fetch('data/milestones.json')
        .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(data => {
            milestoneData = data;
            sortedAges = Object.keys(data).map(Number).sort((a, b) => a - b);
            sortedAges.forEach(age => {
                const opt = document.createElement('option');
                opt.value = age;
                opt.textContent = formatAgeLabel(age);
                select.appendChild(opt);
            });
        })
        .catch(() => {
            resultsBox.classList.remove('hidden');
            grossList.innerHTML = '<li class="text-red-400 text-sm text-center">Could not load milestone data right now.</li>';
            fineList.innerHTML = '';
            socialList.innerHTML = '';
            languageList.innerHTML = '';
        });

    // If the selected age has no entry for this category, fall back to the most recent
    // earlier age that does have one, so the card shows the last achieved milestone
    // instead of an empty box.
    function findAchieved(category, selectedAge) {
        for (let i = sortedAges.length - 1; i >= 0; i--) {
            const age = sortedAges[i];
            if (age > selectedAge) continue;
            const skills = milestoneData[age][category];
            if (skills && skills.length > 0) return { skills, age };
        }
        return null;
    }

    function renderList(listEl, category, colorClass, selectedAge) {
        listEl.innerHTML = '';
        const currentSkills = milestoneData[selectedAge][category];

        if (currentSkills && currentSkills.length > 0) {
            currentSkills.forEach(item => renderCard(listEl, item, colorClass, null));
            return;
        }

        const achieved = findAchieved(category, selectedAge);
        if (!achieved) {
            listEl.innerHTML = `<p class="col-span-full text-brand-textSoft text-sm italic">No milestone listed yet for this age.</p>`;
            return;
        }
        achieved.skills.forEach(item => renderCard(listEl, item, colorClass, achieved.age));
    }

    function iconEl(name, cls) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'icon ' + (cls || ''));
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(NS, 'use');
        use.setAttribute('href', 'assets/icons.svg#i-' + name);
        svg.appendChild(use);
        return svg;
    }

    function fallbackTile(colorClass) {
        const tile = document.createElement('div');
        tile.className = 'w-full aspect-square flex items-center justify-center text-3xl ' + colorClass + ' bg-brand-babypink/40';
        tile.appendChild(iconEl('circle-check'));
        return tile;
    }

    function renderCard(listEl, item, colorClass, achievedAtAge) {
        const card = document.createElement('div');
        card.className = 'bg-white/80 rounded-2xl shadow-md border border-white hover:shadow-xl transition-all overflow-hidden flex flex-col';

        if (item.image) {
            const img = document.createElement('img');
            // encodeURI keeps data-driven paths from breaking out of the assets folder URL
            img.src = 'assets/milestones/' + encodeURI(String(item.image));
            img.alt = String(item.skill);
            img.width = 500;
            img.height = 500;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.className = 'w-full aspect-square object-contain bg-brand-babypink/20 p-2';
            img.addEventListener('error', () => img.replaceWith(fallbackTile(colorClass)), { once: true });
            card.appendChild(img);
        } else {
            card.appendChild(fallbackTile(colorClass));
        }

        const label = document.createElement('p');
        label.className = 'text-sm font-semibold text-brand-text p-3';
        label.textContent = String(item.skill);
        if (achievedAtAge !== null) {
            const note = document.createElement('span');
            note.className = 'text-brand-textSoft font-normal';
            note.textContent = ' (' + formatAgeLabel(achievedAtAge) + ')';
            label.appendChild(note);
        }
        card.appendChild(label);
        listEl.appendChild(card);
    }

    function showMilestones() {
        if (!milestoneData || !select.value) return;
        const selectedAge = Number(select.value);
        if (!milestoneData[selectedAge]) return;

        renderList(grossList, 'gross_motor', 'text-brand-blueDeep', selectedAge);
        renderList(fineList, 'fine_motor', 'text-brand-blush', selectedAge);
        renderList(socialList, 'social', 'text-brand-lavenderDeep', selectedAge);
        renderList(languageList, 'language', 'text-brand-blush', selectedAge);

        resultsBox.classList.remove('hidden');
        resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    searchBtn.addEventListener('click', showMilestones);
    select.addEventListener('change', showMilestones);
});
