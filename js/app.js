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

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'controls-container';

        const playButton = document.createElement('button');
        playButton.textContent = 'Play';
        playButton.onclick = () => this.playAudio();
        controlsContainer.appendChild(playButton);

        const loopCheckbox = document.createElement('input');
        loopCheckbox.type = 'checkbox';
        loopCheckbox.id = 'loop-checkbox';
        loopCheckbox.onchange = () => this.toggleLoop();
        controlsContainer.appendChild(loopCheckbox);

        const loopLabel = document.createElement('label');
        loopLabel.htmlFor = 'loop-checkbox';
        loopLabel.textContent = 'Loop';
        controlsContainer.appendChild(loopLabel);

        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.onclick = () => this.stopAudio();
        controlsContainer.appendChild(stopButton);

        this.element.appendChild(controlsContainer);

        this.addKnobs(controlsContainer);
        this.initDragHandles(leftHandle, rightHandle, waveformContainer);
        document.getElementById('sound-clips').appendChild(this.element);
    }

    addKnobs(controlsContainer) {
        const knobs = [
            { label: 'Wavelength', min: 1, max: 1000, value: 500, attribute: 'wavelength' },
            { label: 'Amplitude', min: 0, max: 1, value: 0.5, step: 0.01, attribute: 'amplitude' },
            { label: 'Frequency', min: 20, max: 20000, value: 440, attribute: 'frequency' },
            { label: 'Time Period', min: 0.01, max: 5, value: 1, step: 0.01, attribute: 'timePeriod' },
            { label: 'Velocity', min: 0, max: 343, value: 343, attribute: 'velocity' }
        ];

        knobs.forEach(knob => {
            const knobContainer = document.createElement('div');
            knobContainer.className = 'knob-container';

            const knobElement = document.createElement('div');
            knobElement.className = 'knob';
            knobElement.setAttribute('data-attribute', knob.attribute);
            knobElement.setAttribute('data-value', knob.value);
            knobElement.style.transform = `rotate(${(knob.value - knob.min) / (knob.max - knob.min) * 270 - 135}deg)`;
            knobElement.onmousedown = (e) => this.startKnobRotation(e, knobElement, knob);
            knobContainer.appendChild(knobElement);

            const knobLabel = document.createElement('div');
            knobLabel.className = 'knob-label';
            knobLabel.textContent = knob.label;
            knobContainer.appendChild(knobLabel);

            controlsContainer.appendChild(knobContainer);
        });
    }

    startKnobRotation(e, knobElement, knob) {
        e.preventDefault();
        const rect = knobElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const minRotation = -135;
        const maxRotation = 135;

        const onMouseMove = (e) => {
            const deltaX = e.clientX - centerX;
            const deltaY = e.clientY - centerY;
            const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
            const rotation = Math.min(maxRotation, Math.max(minRotation, angle));
            const value = knob.min + (rotation - minRotation) / (maxRotation - minRotation) * (knob.max - knob.min);
            knobElement.style.transform = `rotate(${rotation}deg)`;
            knobElement.setAttribute('data-value', value.toFixed(2));
            this.updateAttribute(knob.attribute, value);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    updateAttribute(attribute, value) {
        console.log(`Updated ${attribute} to ${value}`);
        // TODO: Handle the logic to update the attribute of the sound clip.
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
            const min = Math.min(...data.subarray(i * step, (i + 1) * step));
            const max = Math.max(...data.subarray(i * step, (i + 1) * step));
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
