document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('devAgeSelect');
    if (!select) return; // Development section not present on this page

    const searchBtn = document.getElementById('devSearchBtn');
    const resultsBox = document.getElementById('devResults');
    const grossList = document.getElementById('devGrossMotorList');
    const fineList = document.getElementById('devFineMotorList');

    let milestoneData = null;

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
            Object.keys(data)
                .sort((a, b) => Number(a) - Number(b))
                .forEach(age => {
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

    function renderList(listEl, skills, colorClass) {
        listEl.innerHTML = '';
        if (!skills || skills.length === 0) {
            listEl.innerHTML = `<li class="text-brand-textSoft text-sm italic">No specific milestone listed at this age.</li>`;
            return;
        }
        skills.forEach(item => {
            const li = document.createElement('li');
            li.className = 'bg-white rounded-xl px-4 py-2.5 shadow-sm border border-brand-lavender/40 flex items-start gap-3 text-sm text-brand-text';
            li.innerHTML = `<i class="fa-solid fa-circle-check ${colorClass} mt-0.5"></i><span>${item.skill}</span>`;
            listEl.appendChild(li);
        });
    }

    function showMilestones() {
        if (!milestoneData || !select.value) return;
        const entry = milestoneData[select.value];
        if (!entry) return;

        renderList(grossList, entry.gross_motor, 'text-brand-blueDeep');
        renderList(fineList, entry.fine_motor, 'text-brand-blush');

        resultsBox.classList.remove('hidden');
        resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    searchBtn.addEventListener('click', showMilestones);
    select.addEventListener('change', showMilestones);
});
