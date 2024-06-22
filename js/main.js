import './uiControls.js';

document.addEventListener('DOMContentLoaded', () => {
    const layersContainer = document.getElementById('layersContainer');
    layersContainer.style.overflowX = 'auto';
    layersContainer.style.overflowY = 'auto';
    layersContainer.style.whiteSpace = 'nowrap';
    layersContainer.style.maxHeight = 'calc(100px * 5 + 10px * 6)';
    addLayer();
});