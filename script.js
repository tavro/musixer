let audioContext;
let audioBuffer;
let sourceNode;
let gainNode;
let isPlaying = false;
let isMuted = false;
let startTime;
let pausedTime = 0;
let animationFrameId;
let duration;

document.getElementById('fileInput').addEventListener('change', handleFiles);
document.getElementById('playButton').addEventListener('click', playAudio);
document.getElementById('pauseButton').addEventListener('click', pauseAudio);
document.getElementById('volumeSlider').addEventListener('input', changeVolume);
document.getElementById('muteButton').addEventListener('click', toggleMute);

function handleFiles(event) {
    const files = event.target.files;
    if (files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        
        reader.onload = function(ev) {
            const arrayBuffer = ev.target.result;
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            audioContext.decodeAudioData(arrayBuffer, function(buffer) {
                audioBuffer = buffer;
                drawWaveform(buffer);
                duration = buffer.duration;
            });
        };
        
        reader.readAsArrayBuffer(file);
    }
}

function drawWaveform(buffer) {
    const canvas = document.getElementById('waveform');
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
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    const currentTime = audioContext.currentTime - startTime;
    const progressWidth = (currentTime / duration) * canvas.width;

    drawWaveform(audioBuffer);

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
