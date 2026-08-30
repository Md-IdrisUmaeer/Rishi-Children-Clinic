document.addEventListener('DOMContentLoaded', () => {
    // Ordered list of dynamic categories (drives nav buttons + arrow navigation)
    const categories = ['home', 'services', 'growth', 'development'];

    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.page-section');
    const prevArrow = document.getElementById('prevArrow');
    const nextArrow = document.getElementById('nextArrow');

    let currentIndex = 0;

    function switchSection(targetId) {
        const index = categories.indexOf(targetId);
        if (index === -1) return;
        currentIndex = index;

        sections.forEach(section => {
            section.classList.toggle('active', section.id === targetId);
            section.classList.toggle('hidden', section.id !== targetId);
        });

        updateNavStyles(targetId);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateNavStyles(activeTarget) {
        navButtons.forEach(btn => {
            const isActive = btn.getAttribute('data-target') === activeTarget;
            btn.classList.toggle('active-nav', isActive);
            btn.classList.toggle('text-brand-text/70', !isActive);
        });
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-target');
            if (target) switchSection(target);
        });
    });

    // Side arrow navigation cycles through the categories
    prevArrow.addEventListener('click', () => {
        const newIndex = (currentIndex - 1 + categories.length) % categories.length;
        switchSection(categories[newIndex]);
    });

    nextArrow.addEventListener('click', () => {
        const newIndex = (currentIndex + 1) % categories.length;
        switchSection(categories[newIndex]);
    });

    // Click-to-copy appointment phone number
    const phoneEl = document.getElementById('phoneNumber');
    const toast = document.getElementById('copyToast');
    let toastTimeout;

    if (phoneEl) {
        phoneEl.addEventListener('click', async () => {
            const number = phoneEl.getAttribute('data-phone') || phoneEl.textContent.trim();
            try {
                await navigator.clipboard.writeText(number);
            } catch (err) {
                // Fallback for browsers without Clipboard API access
                const tempInput = document.createElement('textarea');
                tempInput.value = number;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
            }

            if (toast) {
                clearTimeout(toastTimeout);
                toast.classList.remove('opacity-0');
                toast.classList.add('opacity-100');
                toastTimeout = setTimeout(() => {
                    toast.classList.remove('opacity-100');
                    toast.classList.add('opacity-0');
                }, 1500);
            }
        });
    }
});
