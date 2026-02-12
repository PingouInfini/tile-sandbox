export function initUI() {
    const panel = document.getElementById('ui-panel');
    const toggleBtn = document.getElementById('panel-toggle-btn');

    if (toggleBtn && panel) {
        toggleBtn.onclick = () => {
            panel.classList.toggle('collapsed');
            if (panel.classList.contains('collapsed')) {
                toggleBtn.innerText = '▶'; 
            } else {
                toggleBtn.innerText = '◀'; 
            }
        };
    }
}