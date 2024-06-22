import { audioContext } from './audioContext.js';

export class SoundClip {
    constructor(buffer, offset = 0, length = null, trimmed = false) {
        this.buffer = buffer;
        this.offset = offset;
        this.length = length || buffer.duration;
        this.trimmed = trimmed;
        this.source = null;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.length * 200;
        this.canvas.height = 100;
        this.drawWaveform();
    }

    play(audioContext, gainNode, startTime, pausedTime) {
        this.source = audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(gainNode).connect(audioContext.destination);
        this.source.start(0, Math.max(0, pausedTime - this.offset));
    }

    stop() {
        if (this.source) {
            this.source.stop();
        }
    }

    trim(start, end) {
        if (start >= 0 && end <= this.buffer.duration && start < end) {
            const trimmedBuffer = audioContext.createBuffer(
                this.buffer.numberOfChannels,
                (end - start) * audioContext.sampleRate,
                audioContext.sampleRate
            );

            for (let i = 0; i < this.buffer.numberOfChannels; i++) {
                trimmedBuffer.copyToChannel(
                    this.buffer.getChannelData(i).slice(
                        start * audioContext.sampleRate,
                        end * audioContext.sampleRate
                    ), i
                );
            }

            this.buffer = trimmedBuffer;
            this.length = end - start;
            this.trimmed = true;
            this.canvas.width = this.length * 200;
            this.drawWaveform();
        }
    }

    drawWaveform() {
        const ctx = this.canvas.getContext('2d');
        const data = this.buffer.getChannelData(0);
        const step = Math.ceil(data.length / this.canvas.width);
        const amp = this.canvas.height / 2;

        ctx.fillStyle = '#f4f4f4';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(0, amp);
        for (let i = 0; i < this.canvas.width; i++) {
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
}
