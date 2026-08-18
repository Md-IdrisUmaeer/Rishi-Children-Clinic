document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('vaxAgeSelect');
    if (!select) return; // Vaccination section not present on this page

    const searchBtn = document.getElementById('vaxSearchBtn');
    const resultsBox = document.getElementById('vaxResults');
    const list = document.getElementById('vaxList');

    let scheduleData = null;

    fetch('data/vaccinations.json')
        .then(res => res.json())
        .then(data => {
            scheduleData = data;
            data.schedule.forEach(entry => {
                const opt = document.createElement('option');
                opt.value = entry.id;
                opt.textContent = entry.label;
                select.appendChild(opt);
            });
        })
        .catch(() => {
            resultsBox.classList.remove('hidden');
            list.innerHTML = '<li class="text-red-400 text-sm text-center">Could not load the vaccine schedule right now.</li>';
        });

    function showVaccines() {
        if (!scheduleData || !select.value) return;
        const entry = scheduleData.schedule.find(e => e.id === select.value);
        if (!entry) return;

        list.innerHTML = '';
        entry.vaccines.forEach(v => {
            const li = document.createElement('li');
            li.className = 'bg-white rounded-xl px-4 py-2.5 shadow-sm border border-brand-lavender/40 flex items-center gap-3 text-sm text-brand-text';
            li.innerHTML = `<i class="fa-solid fa-syringe text-brand-blueDeep"></i><span>${v}</span>`;
            list.appendChild(li);
        });
        resultsBox.classList.remove('hidden');
        resultsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    searchBtn.addEventListener('click', showVaccines);
    select.addEventListener('change', showVaccines);
});
