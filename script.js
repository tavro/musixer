let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffer;
let sourceNode;
let gainNode = audioContext.createGain();
let isPlaying = false;
let isMuted = false;
let startTime;
let pausedTime = 0;
let animationFrameId;
let duration;
let mediaRecorder;
let recordedChunks = [];
let currentLayerId = 0;

document.getElementById('recordButton').addEventListener('click', toggleRecording);
document.getElementById('playButton').addEventListener('click', playAudio);
document.getElementById('pauseButton').addEventListener('click', pauseAudio);
document.getElementById('volumeSlider').addEventListener('input', changeVolume);
document.getElementById('muteButton').addEventListener('click', toggleMute);
document.getElementById('addLayerButton').addEventListener('click', addLayer);
document.getElementById('exportMp3Button').addEventListener('click', exportToMp3);
document.getElementById('exportProjectButton').addEventListener('click', exportProject);

const canvas = document.getElementById('waveform');
canvas.addEventListener('dragover', handleDragOver);
canvas.addEventListener('drop', handleDrop);

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

function handleDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        
        reader.onload = function(ev) {
            const arrayBuffer = ev.target.result;
            audioContext.decodeAudioData(arrayBuffer, function(buffer) {
                audioBuffer = buffer;
                drawWaveform(buffer, canvas);
                duration = buffer.duration;
            });
        };
        
        reader.readAsArrayBuffer(file);
    }
}

function drawWaveform(buffer, targetCanvas) {
    const ctx = targetCanvas.getContext('2d');
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / targetCanvas.width);
    const amp = targetCanvas.height / 2;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(0, amp);
    for (let i = 0; i < targetCanvas.width; i++) {
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

function playAudio() {
    if (audioBuffer && !isPlaying) {
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(gainNode).connect(audioContext.destination);
        sourceNode.start(0, pausedTime);
        startTime = audioContext.currentTime - pausedTime;
        isPlaying = true;
        updateProgress();
    }
}

function pauseAudio() {
    if (isPlaying) {
        sourceNode.stop();
        pausedTime = audioContext.currentTime - startTime;
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
    }
}

function updateProgress() {
    const ctx = canvas.getContext('2d');
    const currentTime = audioContext.currentTime - startTime;
    const progressWidth = (currentTime / duration) * canvas.width;

    drawWaveform(audioBuffer, canvas);

    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(progressWidth, 0);
    ctx.lineTo(progressWidth, canvas.height);
    ctx.stroke();

    if (currentTime < duration) {
        animationFrameId = requestAnimationFrame(updateProgress);
    } else {
        isPlaying = false;
        pausedTime = 0;
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
                const soundClip = document.createElement('div');
                soundClip.classList.add('sound-clip');
                soundClip.draggable = true;
                soundClip.dataset.buffer = buffer;
                
                const soundClipCanvas = document.createElement('canvas');
                soundClipCanvas.width = 200;
                soundClipCanvas.height = 100;
                soundClip.appendChild(soundClipCanvas);

                drawWaveform(buffer, soundClipCanvas);

                event.target.appendChild(soundClip);

                soundClip.addEventListener('dragstart', handleSoundClipDragStart);
                soundClip.addEventListener('dragend', handleSoundClipDragEnd);
            });
        };
        
        reader.readAsArrayBuffer(file);
    }
}

function handleSoundClipDragStart(event) {
    event.dataTransfer.setData('text/plain', null);
}

function handleSoundClipDragEnd(event) {
    const layer = event.target.parentElement;
    const rect = layer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    event.target.style.left = `${x}px`;
    event.target.style.top = `${y}px`;
}

function exportToMp3() {
    // TODO: export project to mp3
}

function exportProject() {
    // TODO: export project file
}
