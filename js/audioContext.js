export const audioContext = new (window.AudioContext || window.webkitAudioContext)();
export const gainNode = audioContext.createGain();
