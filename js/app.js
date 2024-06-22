class SoundClip {
    constructor(file) {
        this.file = file;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.audioBuffer = null;
        this.startTime = 0;
        this.endTime = null;
        this.isPlaying = false;
        this.isLooping = false;
        this.source = null;
        this.loadAudio(file);

        this.element = document.createElement('div');
        this.element.className = 'sound-clip';

        const waveformContainer = document.createElement('div');
        waveformContainer.className = 'waveform-container';
        this.element.appendChild(waveformContainer);

        const waveform = document.createElement('canvas');
        waveform.className = 'waveform';
        waveform.width = 800;
        waveform.height = 100;
        waveformContainer.appendChild(waveform);
        this.waveformCtx = waveform.getContext('2d');

        this.progressBar = document.createElement('div');
        this.progressBar.className = 'progress-bar';
        waveformContainer.appendChild(this.progressBar);

        const leftHandle = document.createElement('div');
        leftHandle.className = 'handle left';
        leftHandle.setAttribute('data-tooltip', 'Start Trim');
        waveformContainer.appendChild(leftHandle);

        const rightHandle = document.createElement('div');
        rightHandle.className = 'handle right';
        rightHandle.setAttribute('data-tooltip', 'End Trim');
        waveformContainer.appendChild(rightHandle);

        const playButton = document.createElement('button');
        playButton.textContent = 'Play';
        playButton.onclick = () => this.playAudio();
        this.element.appendChild(playButton);

        const loopCheckbox = document.createElement('input');
        loopCheckbox.type = 'checkbox';
        loopCheckbox.id = 'loop-checkbox';
        loopCheckbox.onchange = () => this.toggleLoop();
        this.element.appendChild(loopCheckbox);

        const loopLabel = document.createElement('label');
        loopLabel.htmlFor = 'loop-checkbox';
        loopLabel.textContent = 'Loop';
        this.element.appendChild(loopLabel);

        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.onclick = () => this.stopAudio();
        this.element.appendChild(stopButton);

        this.initDragHandles(leftHandle, rightHandle, waveformContainer);
        document.getElementById('sound-clips').appendChild(this.element);
    }

    async loadAudio(file) {
        const arrayBuffer = await file.arrayBuffer();
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        this.endTime = this.audioBuffer.duration;
        this.drawWaveform();
    }

    drawWaveform() {
        if (!this.audioBuffer) return;
        const canvas = this.waveformCtx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const data = this.audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        this.waveformCtx.fillStyle = '#eee';
        this.waveformCtx.fillRect(0, 0, width, height);
        this.waveformCtx.strokeStyle = '#333';
        this.waveformCtx.beginPath();

        for (let i = 0; i < width; i++) {
            const min = 1.0 - Math.max(...data.subarray(i * step, (i + 1) * step));
            const max = 1.0 - Math.min(...data.subarray(i * step, (i + 1) * step));
            this.waveformCtx.moveTo(i, (1 + min) * amp);
            this.waveformCtx.lineTo(i, (1 + max) * amp);
        }

        this.waveformCtx.stroke();
    }

    playAudio() {
        if (!this.audioBuffer) return;
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.source = this.audioCtx.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioCtx.destination);
        this.source.loop = this.isLooping;
        this.source.loopStart = this.startTime;
        this.source.loopEnd = this.endTime;
        this.source.start(0, this.startTime, this.isLooping ? undefined : this.endTime - this.startTime);

        const duration = this.endTime - this.startTime;
        const updateProgress = () => {
            if (!this.isPlaying) return;

            const elapsed = this.audioCtx.currentTime - startTime;
            const progress = this.isLooping ? (elapsed % duration) / duration : Math.min(1, elapsed / duration);
            this.progressBar.style.left = `${(this.startTime / this.audioBuffer.duration) * 100}%`;
            this.progressBar.style.width = `${progress * (this.endTime - this.startTime) / this.audioBuffer.duration * 100}%`;

            if (progress < 1 || this.isLooping) {
                requestAnimationFrame(updateProgress);
            } else {
                this.isPlaying = false;
                this.progressBar.style.width = '0';
            }
        };

        const startTime = this.audioCtx.currentTime;
        updateProgress();
    }

    stopAudio() {
        if (this.isPlaying && this.source) {
            this.source.stop();
            this.isPlaying = false;
            this.progressBar.style.width = '0';
        }
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        if (this.isPlaying) {
            this.stopAudio();
            this.playAudio();
        }
    }

    initDragHandles(leftHandle, rightHandle, waveformContainer) {
        const onDrag = (handle, direction) => {
            let isDragging = false;

            handle.addEventListener('mousedown', () => {
                isDragging = true;
                document.body.style.cursor = 'ew-resize';
                this.progressBar.style.width = '0';
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const rect = waveformContainer.getBoundingClientRect();
                    const offset = direction === 'left' ? e.clientX - rect.left : rect.right - e.clientX;
                    handle.style[direction] = `${Math.max(0, Math.min(rect.width - handle.offsetWidth, offset))}px`;

                    if (direction === 'left') {
                        this.startTime = (offset / rect.width) * this.audioBuffer.duration;
                    } else {
                        this.endTime = (1 - offset / rect.width) * this.audioBuffer.duration;
                    }
                }
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = 'default';
                }
            });
        };

        onDrag(leftHandle, 'left');
        onDrag(rightHandle, 'right');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;

        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                new SoundClip(file);
            }
        }
    });

    const modeToggle = document.getElementById('mode-toggle');
    modeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode');
    });
});
