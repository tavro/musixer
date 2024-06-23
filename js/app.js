class SoundClip {
  constructor(file = null, type = null) {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.audioBuffer = null;
    this.startTime = 0;
    this.endTime = null;
    this.isPlaying = false;
    this.isLooping = false;
    this.source = null;
    this.type = type;
    this.attributes = {
      amplitude: 0.5,
      frequency: 440,
      timePeriod: 0.01,
    };

    this.element = document.createElement("div");
    this.element.className = "sound-clip";

    const waveformContainer = document.createElement("div");
    waveformContainer.className = "waveform-container";
    this.element.appendChild(waveformContainer);

    const waveform = document.createElement("canvas");
    waveform.className = "waveform";
    waveform.width = 800;
    waveform.height = 100;
    waveformContainer.appendChild(waveform);
    this.waveformCtx = waveform.getContext("2d");

    this.progressBar = document.createElement("div");
    this.progressBar.className = "progress-bar";
    waveformContainer.appendChild(this.progressBar);

    const leftHandle = document.createElement("div");
    leftHandle.className = "handle left";
    leftHandle.setAttribute("data-tooltip", "Start Trim");
    waveformContainer.appendChild(leftHandle);

    const rightHandle = document.createElement("div");
    rightHandle.className = "handle right";
    rightHandle.setAttribute("data-tooltip", "End Trim");
    waveformContainer.appendChild(rightHandle);

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "controls-container";

    const playButton = document.createElement("button");
    playButton.textContent = "Play";
    playButton.onclick = () => this.playAudio();
    controlsContainer.appendChild(playButton);

    const loopCheckbox = document.createElement("input");
    loopCheckbox.type = "checkbox";
    loopCheckbox.id = "loop-checkbox";
    loopCheckbox.onchange = () => this.toggleLoop();
    controlsContainer.appendChild(loopCheckbox);

    const loopLabel = document.createElement("label");
    loopLabel.htmlFor = "loop-checkbox";
    loopLabel.textContent = "Loop";
    controlsContainer.appendChild(loopLabel);

    const stopButton = document.createElement("button");
    stopButton.textContent = "Stop";
    stopButton.onclick = () => this.stopAudio();
    controlsContainer.appendChild(stopButton);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter name";
    nameInput.className = "name-input";
    controlsContainer.appendChild(nameInput);

    const downloadButton = document.createElement("button");
    downloadButton.textContent = "Download";
    downloadButton.onclick = () => this.downloadAudio(nameInput.value);
    controlsContainer.appendChild(downloadButton);

    this.element.appendChild(controlsContainer);

    this.addKnobs(controlsContainer);
    this.initDragHandles(leftHandle, rightHandle, waveformContainer);
    document.getElementById("sound-clips").appendChild(this.element);

    if (file) {
      this.loadAudio(file);
    } else if (type) {
      this.generateTone(type);
    }
  }

  addKnobs(controlsContainer) {
    const knobs = [
      {
        label: "Amplitude",
        min: 0,
        max: 1,
        value: this.attributes.amplitude,
        step: 0.01,
        attribute: "amplitude",
        unit: "",
      },
      {
        label: "Frequency",
        min: 20,
        max: 20000,
        value: this.attributes.frequency,
        attribute: "frequency",
        unit: " Hz",
      },
      {
        label: "Time Period",
        min: 0.01,
        max: 5,
        value: this.attributes.timePeriod,
        step: 0.01,
        attribute: "timePeriod",
        unit: " s",
      },
    ];

    const knobGroup = document.createElement("div");
    knobGroup.className = "knob-group";
    controlsContainer.appendChild(knobGroup);

    knobs.forEach((knob) => {
      const knobContainer = document.createElement("div");
      knobContainer.className = "knob-container";

      const knobElement = document.createElement("div");
      knobElement.className = "knob";
      knobElement.setAttribute("data-attribute", knob.attribute);
      knobElement.setAttribute("data-value", knob.value + knob.unit);
      knobElement.setAttribute("data-tooltip", knob.value + knob.unit);
      knobElement.style.transform = `rotate(${
        ((knob.value - knob.min) / (knob.max - knob.min)) * 270 - 135
      }deg)`;
      knobElement.onmousedown = (e) =>
        this.startKnobRotation(e, knobElement, knob);
      knobElement.onmouseenter = (e) => this.showTooltip(e, knobElement);
      knobElement.onmouseleave = () => this.hideTooltip();
      knobContainer.appendChild(knobElement);

      const knobLabel = document.createElement("div");
      knobLabel.className = "knob-label";
      knobLabel.textContent = knob.label;
      knobContainer.appendChild(knobLabel);

      const knobInput = document.createElement("input");
      knobInput.type = "number";
      knobInput.min = knob.min;
      knobInput.max = knob.max;
      knobInput.step = knob.step || 1;
      knobInput.value = knob.value;
      knobInput.onchange = (e) => {
        const value = parseFloat(e.target.value);
        this.updateKnobAndAttribute(knobElement, knob, value);
      };
      knobContainer.appendChild(knobInput);

      knobGroup.appendChild(knobContainer);
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
      const value =
        knob.min +
        ((rotation - minRotation) / (maxRotation - minRotation)) *
          (knob.max - knob.min);
      knobElement.style.transform = `rotate(${rotation}deg)`;
      knobElement.setAttribute("data-value", value.toFixed(2) + knob.unit);
      knobElement.setAttribute("data-tooltip", value.toFixed(2) + knob.unit);
      this.updateAttribute(knob.attribute, value);
      this.updateTooltip(knobElement, value.toFixed(2) + knob.unit);
      const input = knobElement.nextElementSibling;
      input.value = value.toFixed(2);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  showTooltip(e, knobElement) {
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = knobElement.getAttribute("data-tooltip");
    document.body.appendChild(tooltip);

    const rect = knobElement.getBoundingClientRect();
    tooltip.style.left = `${
      rect.left + rect.width / 2 - tooltip.offsetWidth / 2
    }px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;

    knobElement.tooltip = tooltip;
  }

  updateTooltip(knobElement, value) {
    if (knobElement.tooltip) {
      knobElement.tooltip.textContent = value;
    }
  }

  hideTooltip() {
    const tooltips = document.querySelectorAll(".tooltip");
    tooltips.forEach((tooltip) => tooltip.remove());
  }

  updateAttribute(attribute, value) {
    console.log(`Updated ${attribute} to ${value}`);
    this.attributes[attribute] = value;
    if (this.type) {
      this.generateTone(this.type, attribute, value);
    } else {
      this.applyAttributesToAudio();
    }
  }

  updateKnobAndAttribute(knobElement, knob, value) {
    const minRotation = -135;
    const maxRotation = 135;
    const rotation =
      minRotation +
      ((value - knob.min) / (knob.max - knob.min)) * (maxRotation - minRotation);
    knobElement.style.transform = `rotate(${rotation}deg)`;
    knobElement.setAttribute("data-value", value.toFixed(2) + knob.unit);
    knobElement.setAttribute("data-tooltip", value.toFixed(2) + knob.unit);
    this.updateAttribute(knob.attribute, value);
    this.updateTooltip(knobElement, value.toFixed(2) + knob.unit);
  }

  async loadAudio(file) {
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    this.endTime = this.audioBuffer.duration;
    //this.updateAttributesFromAudio();
    this.drawWaveform();
  }

  updateAttributesFromAudio() {
    if (!this.audioBuffer) return;

    const data = this.audioBuffer.getChannelData(0);
    const sampleRate = this.audioBuffer.sampleRate;
    const length = this.audioBuffer.length;

    // Calculate amplitude (peak value)
    const amplitude = Math.max(...data.map(Math.abs));
    this.attributes.amplitude = amplitude;
    this.updateKnobUI("amplitude", amplitude);

    // Estimate frequency using zero-crossing method
    let crossings = 0;
    for (let i = 1; i < length; i++) {
      if (data[i - 1] <= 0 && data[i] > 0) crossings++;
    }
    const frequency = (crossings / length) * sampleRate / 2;
    this.attributes.frequency = frequency;
    this.updateKnobUI("frequency", frequency);
  }

  updateKnobUI(attribute, value) {
    const knobElement = document.querySelector(`.knob[data-attribute="${attribute}"]`);
    if (knobElement) {
      const knob = {
        min: parseFloat(knobElement.getAttribute("data-min")),
        max: parseFloat(knobElement.getAttribute("data-max")),
        unit: knobElement.getAttribute("data-unit"),
      };
      this.updateKnobAndAttribute(knobElement, knob, value);
    }
  }

  applyAttributesToAudio() {
    if (!this.audioBuffer) return;

    const { amplitude, frequency } = this.attributes;
    const data = this.audioBuffer.getChannelData(0);
    const sampleRate = this.audioBuffer.sampleRate;
    const length = this.audioBuffer.length;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      data[i] *= amplitude * Math.sin(2 * Math.PI * frequency * t);
    }

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

    this.waveformCtx.fillStyle = "#eee";
    this.waveformCtx.fillRect(0, 0, width, height);
    this.waveformCtx.strokeStyle = "#333";
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
    this.source.start(
      0,
      this.startTime,
      this.isLooping ? undefined : this.endTime - this.startTime
    );

    const duration = this.endTime - this.startTime;
    const updateProgress = () => {
      if (!this.isPlaying) return;

      const elapsed = this.audioCtx.currentTime - startTime;
      const progress = this.isLooping
        ? (elapsed % duration) / duration
        : Math.min(1, elapsed / duration);
      this.progressBar.style.left = `${
        (this.startTime / this.audioBuffer.duration) * 100
      }%`;
      this.progressBar.style.width = `${
        ((progress * (this.endTime - this.startTime)) /
          this.audioBuffer.duration) *
        100
      }%`;

      if (progress < 1 || this.isLooping) {
        requestAnimationFrame(updateProgress);
      } else {
        this.isPlaying = false;
        this.progressBar.style.width = "0";
      }
    };

    const startTime = this.audioCtx.currentTime;
    updateProgress();
  }

  stopAudio() {
    if (this.isPlaying && this.source) {
      this.source.stop();
      this.isPlaying = false;
      this.progressBar.style.width = "0";
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

      handle.addEventListener("mousedown", () => {
        isDragging = true;
        document.body.style.cursor = "ew-resize";
        this.progressBar.style.width = "0";
      });

      document.addEventListener("mousemove", (e) => {
        if (isDragging) {
          const rect = waveformContainer.getBoundingClientRect();
          const offset =
            direction === "left"
              ? e.clientX - rect.left
              : rect.right - e.clientX;
          handle.style[direction] = `${Math.max(
            0,
            Math.min(rect.width - handle.offsetWidth, offset)
          )}px`;

          if (direction === "left") {
            this.startTime = (offset / rect.width) * this.audioBuffer.duration;
          } else {
            this.endTime =
              (1 - offset / rect.width) * this.audioBuffer.duration;
          }
        }
      });

      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = "default";
        }
      });
    };

    onDrag(leftHandle, "left");
    onDrag(rightHandle, "right");
  }

  generateTone(type, attribute = null, value = null) {
    let duration = this.attributes.timePeriod;
    const sampleRate = this.audioCtx.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let frequency = this.attributes.frequency;
    let amplitude = this.attributes.amplitude;
    let timePeriod = this.attributes.timePeriod;

    if (attribute) {
      if (attribute === "frequency") frequency = value;
      if (attribute === "amplitude") amplitude = value;
      if (attribute === "timePeriod") {
        timePeriod = value;
        duration = value;
      }
    }

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      switch (type) {
        case "sine":
          data[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
          break;
        case "triangle":
          data[i] =
            amplitude *
            (Math.abs((((i / sampleRate) * frequency) % 2) - 1) * 2 - 1);
          break;
        case "square":
          data[i] = amplitude * Math.sign(Math.sin(2 * Math.PI * frequency * t));
          break;
        case "sawtooth":
          data[i] =
            amplitude * (2 * (t * frequency - Math.floor(t * frequency + 0.5)));
          break;
      }
    }

    this.audioBuffer = buffer;
    this.endTime = this.audioBuffer.duration;
    this.drawWaveform();
  }

  downloadAudio(name) {
    if (!this.audioBuffer) return;

    const offlineCtx = new OfflineAudioContext(
      1,
      this.audioBuffer.length,
      this.audioBuffer.sampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    offlineCtx.startRendering().then((renderedBuffer) => {
      const wavBuffer = this.bufferToWave(renderedBuffer);
      const blob = new Blob([wavBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name ? `${name}.wav` : "soundclip.wav";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  bufferToWave(buffer) {
    const numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [],
      sampleRate = buffer.sampleRate;

    let offset = 0,
      pos = 0;

    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; // scale to 16-bit signed int
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return bufferArray;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const dropZone = document.getElementById("drop-zone");

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const files = e.dataTransfer.files;

    for (const file of files) {
      if (file.type.startsWith("audio/")) {
        new SoundClip(file);
      }
    }
  });

  const modeToggle = document.getElementById("mode-toggle");
  modeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    document.body.classList.toggle("dark-mode");
  });

  const sineToneButton = document.getElementById("sine-tone");
  sineToneButton.addEventListener("click", () => new SoundClip(null, "sine"));

  const triangleToneButton = document.getElementById("triangle-tone");
  triangleToneButton.addEventListener(
    "click",
    () => new SoundClip(null, "triangle")
  );

  const squareToneButton = document.getElementById("square-tone");
  squareToneButton.addEventListener(
    "click",
    () => new SoundClip(null, "square")
  );

  const sawtoothToneButton = document.getElementById("sawtooth-tone");
  sawtoothToneButton.addEventListener(
    "click",
    () => new SoundClip(null, "sawtooth")
  );
});
