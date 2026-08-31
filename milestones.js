document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('devAgeSelect');
    if (!select) return; // Development section not present on this page

    const searchBtn = document.getElementById('devSearchBtn');
    const resultsBox = document.getElementById('devResults');
    const grossList = document.getElementById('devGrossMotorList');
    const fineList = document.getElementById('devFineMotorList');

    let milestoneData = null;
    let sortedAges = []; // numeric ages, ascending

    function formatAgeLabel(months) {
        const n = Number(months);
        if (n < 12) return `${n} Month${n === 1 ? '' : 's'}`;
        if (n % 12 === 0) return `${n / 12} Year${n === 12 ? '' : 's'}`;
        return `${n} Months`;
    }

    fetch('data/milestones.json')
        .then(res => res.json())
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

    function renderCard(listEl, item, colorClass, achievedAtAge) {
        const card = document.createElement('div');
        card.className = 'bg-white/80 rounded-2xl shadow-md border border-white hover:shadow-xl transition-all overflow-hidden flex flex-col';
        const imgHtml = item.image
            ? `<img src="assets/milestones/${item.image}" alt="${item.skill}" class="w-full aspect-square object-contain bg-brand-babypink/20 p-2" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'w-full aspect-square flex items-center justify-center text-3xl ${colorClass} bg-brand-babypink/40',innerHTML:'<i class=\\'fa-solid fa-circle-check\\'></i>'}))">`
            : `<div class="w-full aspect-square flex items-center justify-center text-3xl ${colorClass} bg-brand-babypink/40"><i class="fa-solid fa-circle-check"></i></div>`;
        const ageNote = achievedAtAge !== null ? ` <span class="text-brand-textSoft font-normal">(${formatAgeLabel(achievedAtAge)})</span>` : '';
        card.innerHTML = `${imgHtml}<p class="text-sm font-semibold text-brand-text p-3">${item.skill}${ageNote}</p>`;
        listEl.appendChild(card);
    }

    function showMilestones() {
        if (!milestoneData || !select.value) return;
        const selectedAge = Number(select.value);
        if (!milestoneData[selectedAge]) return;

        renderList(grossList, 'gross_motor', 'text-brand-blueDeep', selectedAge);
        renderList(fineList, 'fine_motor', 'text-brand-blush', selectedAge);

        resultsBox.classList.remove('hidden');
        resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    searchBtn.addEventListener('click', showMilestones);
    select.addEventListener('change', showMilestones);
});
