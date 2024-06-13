let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffers = [];
let gainNode = audioContext.createGain();
let isPlaying = false;
let isMuted = false;
let startTime;
let pausedTime = 0;
let animationFrameId;
let duration = 0;
let mediaRecorder;
let recordedChunks = [];
let currentLayerId = 0;
let progressBar;

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
    recordedChunks = [];
}

function addLayer() {
    const layer = document.createElement('div');
    layer.classList.add('layer');
    layer.id = `layer-${currentLayerId++}`;
    document.getElementById('layersContainer').appendChild(layer);

    const progressBar = document.createElement('div');
    progressBar.classList.add('progress-bar');
    layer.appendChild(progressBar);

    layer.addEventListener('dragover', handleLayerDragOver);
    layer.addEventListener('drop', handleLayerDrop);
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
                soundClip.style.height = '100%';
                soundClip.style.left = `${event.offsetX}px`;

                const soundClipCanvas = document.createElement('canvas');
                soundClipCanvas.width = parseFloat(soundClip.style.width);
                soundClipCanvas.height = 100;
                soundClip.appendChild(soundClipCanvas);

                drawWaveform(buffer, soundClipCanvas);

                event.target.appendChild(soundClip);

                duration = Math.max(duration, buffer.duration);

                soundClip.addEventListener('dragstart', handleSoundClipDragStart);
                soundClip.addEventListener('dragend', handleSoundClipDragEnd);
            });
        };
        
        reader.readAsArrayBuffer(file);
    }
}

function handleSoundClipDragStart(event) {
    event.dataTransfer.setData('text/plain', null);
    event.target.classList.add('dragging');
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
            targetLayer.appendChild(event.target);
            event.target.style.left = `${x}px`;
            event.target.style.top = `0px`;
        }
    }

    event.target.classList.remove('dragging');
}

function drawWaveform(buffer, canvas) {
    const ctx = canvas.getContext('2d');
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'black';
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

function exportToMp3() {
    // TODO: export project to mp3
}

function exportProject() {
    // TODO: export project file
}

progressBar = document.createElement('div');
progressBar.classList.add('progress-bar');
document.getElementById('layersContainer').appendChild(progressBar);
