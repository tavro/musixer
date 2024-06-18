const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = [];
const gainNode = audioContext.createGain();
let isPlaying = false;
let isMuted = false;
let startTime;
let pausedTime = 0;
let animationFrameId;
let duration = 0;
let mediaRecorder;
const recordedChunks = [];
let currentLayerId = 0;
let progressBar;
let trimming = false;
let trimmingClip = null;
let trimSide = '';

document.getElementById('recordButton').addEventListener('click', toggleRecording);
document.getElementById('playButton').addEventListener('click', playAudio);
document.getElementById('pauseButton').addEventListener('click', pauseAudio);
document.getElementById('volumeSlider').addEventListener('input', changeVolume);
document.getElementById('muteButton').addEventListener('click', toggleMute);
document.getElementById('addLayerButton').addEventListener('click', addLayer);
document.getElementById('exportMp3Button').addEventListener('click', exportToMp3);
document.getElementById('exportProjectButton').addEventListener('click', exportProject);

function playAudio() {
    if (!isPlaying) {
        startTime = audioContext.currentTime - pausedTime;
        isPlaying = true;
        updateProgress();
        playClips();
    }
}

function pauseAudio() {
    if (isPlaying) {
        isPlaying = false;
        pausedTime = audioContext.currentTime - startTime;
        cancelAnimationFrame(animationFrameId);
        stopClips();
    }
}

function playClips() {
    const clips = document.querySelectorAll('.sound-clip');
    clips.forEach(clip => {
        const bufferIndex = clip.dataset.buffer;
        const buffer = audioBuffers[bufferIndex];
        const offset = parseFloat(clip.style.left) / document.getElementById('layersContainer').offsetWidth * duration;
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode).connect(audioContext.destination);
        source.start(0, Math.max(0, pausedTime - offset));
        clip.dataset.source = source;
    });
}

function stopClips() {
    const clips = document.querySelectorAll('.sound-clip');
    clips.forEach(clip => {
        const source = clip.dataset.source;
        if (source) {
            source.stop();
        }
    });
}

function updateProgress() {
    const currentTime = audioContext.currentTime - startTime;
    const progressWidth = (currentTime / duration) * 100;

    progressBar.style.width = `${progressWidth}%`;

    if (currentTime < duration) {
        animationFrameId = requestAnimationFrame(updateProgress);
    } else {
        isPlaying = false;
        pausedTime = 0;
        progressBar.style.width = '0%';
    }
}

function changeVolume(event) {
    const volume = event.target.value;
    gainNode.gain.value = volume;
}

function toggleMute() {
    isMuted = !isMuted;
    gainNode.gain.value = isMuted ? 0 : document.getElementById('volumeSlider').value;
    document.getElementById('muteButton').textContent = isMuted ? '🔊' : '🔇';
}

function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById('recordButton').textContent = '🔴';
    } else {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = event => {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };
                mediaRecorder.onstop = saveRecording;
                mediaRecorder.start();
                document.getElementById('recordButton').textContent = '⏹️';
            });
    }
}

function saveRecording() {
    const blob = new Blob(recordedChunks, { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'recording.wav';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    recordedChunks.length = 0;
}

document.addEventListener('DOMContentLoaded', () => {
    const layersContainer = document.getElementById('layersContainer');
    layersContainer.style.overflowX = 'auto';
    layersContainer.style.overflowY = 'auto';
    layersContainer.style.whiteSpace = 'nowrap';
    layersContainer.style.maxHeight = 'calc(100px * 5 + 10px * 6)';
    addLayer();
});

function addLayer() {
    const layersContainer = document.getElementById('layersContainer');
    const existingLayers = layersContainer.getElementsByClassName('layer').length;

    const layer = document.createElement('div');
    layer.classList.add('layer');
    layer.id = `layer-${currentLayerId++}`;
    layersContainer.appendChild(layer);

    const progressBar = document.createElement('div');
    progressBar.classList.add('progress-bar');
    layer.appendChild(progressBar);

    const layerControls = document.createElement('div');
    layerControls.classList.add('layer-controls');

    const removeLayerButton = document.createElement('button');
    removeLayerButton.textContent = '🗑️';
    removeLayerButton.addEventListener('click', () => removeLayer(layer));
    layerControls.appendChild(removeLayerButton);

    const muteLayerButton = document.createElement('button');
    muteLayerButton.textContent = '🔇';
    muteLayerButton.addEventListener('click', () => toggleLayerMute(layer, muteLayerButton));
    layerControls.appendChild(muteLayerButton);

    layer.appendChild(layerControls);

    layer.addEventListener('dragover', handleLayerDragOver);
    layer.addEventListener('drop', handleLayerDrop);

    if (existingLayers >= 5) {
        layersContainer.style.overflowY = 'auto';
        layersContainer.style.maxHeight = 'calc(100px * 5 + 10px * 6)';
    }
}

function toggleLayerMute(layer, button) {
    const clips = layer.querySelectorAll('.sound-clip');
    const isMuted = button.textContent === '🔇';
    clips.forEach(clip => {
        const source = clip.dataset.source;
        if (source) {
            source.gainNode.gain.value = isMuted ? 0 : 1;
        }
    });
    button.textContent = isMuted ? '🔊' : '🔇';
}

function removeLayer(layer) {
    layer.remove();
    currentLayerId--;
}

function handleLayerDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

function handleLayerDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        
        reader.onload = function(ev) {
            const arrayBuffer = ev.target.result;
            audioContext.decodeAudioData(arrayBuffer, function(buffer) {
                const bufferIndex = audioBuffers.length;
                audioBuffers.push(buffer);

                const soundClip = document.createElement('div');
                soundClip.classList.add('sound-clip');
                soundClip.draggable = true;
                soundClip.dataset.buffer = bufferIndex;

                soundClip.style.width = `${buffer.duration * 200}px`;
                soundClip.style.left = `${event.offsetX}px`;

                const soundClipCanvas = document.createElement('canvas');
                soundClipCanvas.width = parseFloat(soundClip.style.width);
                soundClipCanvas.height = 100;
                soundClip.appendChild(soundClipCanvas);

                drawWaveform(buffer, soundClipCanvas);

                const leftHandle = document.createElement('div');
                leftHandle.classList.add('handle', 'left-handle');
                soundClip.appendChild(leftHandle);

                const rightHandle = document.createElement('div');
                rightHandle.classList.add('handle', 'right-handle');
                soundClip.appendChild(rightHandle);

                event.target.appendChild(soundClip);

                duration = Math.max(duration, buffer.duration);

                soundClip.addEventListener('dragstart', handleSoundClipDragStart);
                soundClip.addEventListener('dragend', handleSoundClipDragEnd);
                soundClip.addEventListener('click', handleSoundClipClick);

                leftHandle.addEventListener('mousedown', (e) => handleTrimMouseDown(e, 'left'));
                rightHandle.addEventListener('mousedown', (e) => handleTrimMouseDown(e, 'right'));

                addTooltip(soundClip, 'Click to select, drag to move, use handles to trim');

                const layersContainer = document.getElementById('layersContainer');
                if (soundClip.offsetLeft + soundClip.offsetWidth > layersContainer.scrollWidth) {
                    layersContainer.style.width = `${soundClip.offsetLeft + soundClip.offsetWidth}px`;
                }
            });
        };
        
        reader.readAsArrayBuffer(file);
    }
}

function handleSoundClipDragStart(event) {
    if (!event.target.classList.contains('handle')) {
        event.dataTransfer.setData('text/plain', null);
        event.target.classList.add('dragging');

        event.target.dataset.originalLeft = parseFloat(event.target.style.left);
        event.target.dataset.originalTop = parseFloat(event.target.style.top);
    }
}

function handleSoundClipDragEnd(event) {
    const layersContainer = document.getElementById('layersContainer');
    const rect = layersContainer.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;

    const soundClipWidth = event.target.offsetWidth;
    const soundClipHeight = event.target.offsetHeight;

    const newLayerIndex = Math.floor(y / soundClipHeight);

    if (x < 0) {
        x = 0;
    } else if (x + soundClipWidth > layersContainer.offsetWidth) {
        x = layersContainer.offsetWidth - soundClipWidth;
    }

    if (newLayerIndex >= 0 && newLayerIndex < currentLayerId) {
        const targetLayer = document.getElementById(`layer-${newLayerIndex}`);
        if (targetLayer) {
            const existingClips = targetLayer.getElementsByClassName('sound-clip');
            let overlap = false;
            for (let clip of existingClips) {
                const clipLeft = parseFloat(clip.style.left);
                const clipRight = clipLeft + clip.offsetWidth;
                const newClipLeft = x;
                const newClipRight = x + soundClipWidth;

                if (
                    (newClipLeft >= clipLeft && newClipLeft < clipRight) ||
                    (newClipRight > clipLeft && newClipRight <= clipRight) ||
                    (newClipLeft <= clipLeft && newClipRight >= clipRight)
                ) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                targetLayer.appendChild(event.target);
                event.target.style.left = `${x}px`;
                event.target.style.top = `0px`;
            } else {
                event.target.style.left = `${event.target.dataset.originalLeft}px`;
                event.target.style.top = `${event.target.dataset.originalTop}px`;
            }
        }
    }

    event.target.classList.remove('dragging');
}

function drawWaveform(buffer, canvas) {
    const ctx = canvas.getContext('2d');
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, amp);
    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.lineTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
}

function handleSoundClipClick(event) {
    const clip = event.target;
    const rect = clip.getBoundingClientRect();
    const clickX = event.clientX - rect.left;

    const bufferIndex = clip.dataset.buffer;
    const buffer = audioBuffers[bufferIndex];
    const originalWidth = parseFloat(clip.style.width);
    const splitTime = (clickX / originalWidth) * buffer.duration;

    const leftBuffer = audioContext.createBuffer(1, splitTime * audioContext.sampleRate, audioContext.sampleRate);
    leftBuffer.copyToChannel(buffer.getChannelData(0).slice(0, splitTime * audioContext.sampleRate), 0);

    const rightBuffer = audioContext.createBuffer(1, (buffer.duration - splitTime) * audioContext.sampleRate, audioContext.sampleRate);
    rightBuffer.copyToChannel(buffer.getChannelData(0).slice(splitTime * audioContext.sampleRate), 0);

    audioBuffers[bufferIndex] = leftBuffer;
    audioBuffers.push(rightBuffer);

    const newClip = clip.cloneNode(true);
    newClip.dataset.buffer = audioBuffers.length - 1;
    newClip.style.width = `${rightBuffer.duration * 200}px`;
    newClip.style.left = `${parseFloat(clip.style.left) + originalWidth - parseFloat(newClip.style.width)}px`;

    const soundClipCanvas = newClip.querySelector('canvas');
    soundClipCanvas.width = parseFloat(newClip.style.width);
    drawWaveform(rightBuffer, soundClipCanvas);

    clip.style.width = `${leftBuffer.duration * 200}px`;
    drawWaveform(leftBuffer, clip.querySelector('canvas'));

    clip.parentNode.appendChild(newClip);

    newClip.addEventListener('dragstart', handleSoundClipDragStart);
    newClip.addEventListener('dragend', handleSoundClipDragEnd);
    newClip.addEventListener('click', handleSoundClipClick);

    const leftHandle = newClip.querySelector('.left-handle');
    const rightHandle = newClip.querySelector('.right-handle');

    leftHandle.addEventListener('mousedown', (e) => handleTrimMouseDown(e, 'left'));
    rightHandle.addEventListener('mousedown', (e) => handleTrimMouseDown(e, 'right'));

    addTooltip(newClip, 'Click to select, drag to move, use handles to trim');

    duration = Math.max(duration, leftBuffer.duration + rightBuffer.duration);
}

function handleTrimMouseDown(event, side) {
    event.stopPropagation();
    trimming = true;
    trimmingClip = event.target.parentElement;
    trimSide = side;
    document.addEventListener('mousemove', handleTrimMouseMove);
    document.addEventListener('mouseup', handleTrimMouseUp);
}

function handleTrimMouseMove(event) {
    if (trimming && trimmingClip) {
        const clip = trimmingClip;
        const rect = clip.getBoundingClientRect();
        let deltaX = event.clientX - rect.left;

        if (trimSide === 'right') {
            deltaX = Math.min(deltaX, clip.parentElement.offsetWidth - parseFloat(clip.style.left));
            clip.style.width = `${deltaX}px`;
        } else if (trimSide === 'left') {
            const newLeft = event.clientX - clip.parentElement.getBoundingClientRect().left;
            const newWidth = parseFloat(clip.style.width) - (newLeft - parseFloat(clip.style.left));
            clip.style.width = `${newWidth}px`;
            clip.style.left = `${newLeft}px`;
        }

        const bufferIndex = clip.dataset.buffer;
        const buffer = audioBuffers[bufferIndex];
        const newDuration = (parseFloat(clip.style.width) / rect.width) * buffer.duration;

        const newBuffer = audioContext.createBuffer(1, newDuration * audioContext.sampleRate, audioContext.sampleRate);
        newBuffer.copyToChannel(buffer.getChannelData(0).slice(0, newDuration * audioContext.sampleRate), 0);

        audioBuffers[bufferIndex] = newBuffer;
        drawWaveform(newBuffer, clip.querySelector('canvas'));
    }
}

function handleTrimMouseUp(event) {
    if (trimming) {
        trimming = false;
        trimmingClip = null;
        trimSide = '';
        document.removeEventListener('mousemove', handleTrimMouseMove);
        document.removeEventListener('mouseup', handleTrimMouseUp);
    }
}

function exportToMp3() {
    // TODO: export project to mp3
}

function exportProject() {
    // TODO: export project file
}

progressBar = document.createElement('div');
progressBar.classList.add('progress-bar');
document.getElementById('layersContainer').appendChild(progressBar);

function addTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.classList.add('tooltip');
    tooltip.textContent = text;
    element.appendChild(tooltip);

    element.addEventListener('mouseenter', () => {
        tooltip.classList.add('show');
    });

    element.addEventListener('mouseleave', () => {
        tooltip.classList.remove('show');
    });
}
