/**
 * ノイズ生成器（バックグラウンド再生対応）
 * Web Audio APIを使用して白ノイズ、ピンクノイズ、ブラウンノイズを生成します
 * バックグラウンド再生にも対応
 */

let audioContext = null;
let bufferSources = [];
let gainNodes = [];
let filterNodes = [];
let isPlaying = false;
let currentVolume = 0.3;
let currentNoiseType = 'brown';

export function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // バックグラウンド再生対応
    if (audioContext.state === 'suspended') {
      // ユーザーインタラクション後に再開
      const resume = () => {
        audioContext.resume().then(() => {
          document.removeEventListener('click', resume);
          document.removeEventListener('touchstart', resume);
        });
      };
      document.addEventListener('click', resume);
      document.addEventListener('touchstart', resume);
    }
  }
  return audioContext;
}

/**
 * ピンクノイズ生成用フィルタ
 * -3dB/octave の周波数特性を持つ
 */
function createPinkNoiseFilter(ctx) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 20;
  return filter;
}

/**
 * ブラウンノイズ生成用フィルタ
 * -6dB/octave の周波数特性を持つ（低周波を強調）
 */
function createBrownNoiseFilters(ctx) {
  // 複数のローパスフィルタを組み合わせて -6dB/octave の特性を実現
  const filter1 = ctx.createBiquadFilter();
  filter1.type = 'lowpass';
  filter1.frequency.value = 1000;
  filter1.Q.value = 0.707;
  
  const filter2 = ctx.createBiquadFilter();
  filter2.type = 'lowpass';
  filter2.frequency.value = 500;
  filter2.Q.value = 0.707;
  
  return [filter1, filter2];
}

/**
 * ホワイトノイズバッファを生成
 */
function generateWhiteNoiseBuffer(ctx, duration = 2) {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  return buffer;
}

/**
 * ノイズを開始
 * @param {string} noiseType - 'white', 'pink', 'brown'
 * @param {number} volume - 0-1
 */
export function startNoise(noiseType = 'brown', volume = 0.3) {
  if (isPlaying) return;

  const ctx = initAudioContext();
  
  // AudioContext が suspended の場合は再開
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  currentVolume = volume;
  currentNoiseType = noiseType;

  // ホワイトノイズバッファを生成
  const buffer = generateWhiteNoiseBuffer(ctx);
  
  // バッファソースの作成
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  // ゲインノードの作成
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  
  // ノイズタイプに応じたフィルタリング
  let lastNode = source;
  
  if (noiseType === 'white') {
    // ホワイトノイズ：フィルタなし
    source.connect(gainNode);
  } else if (noiseType === 'pink') {
    // ピンクノイズ：ハイパスフィルタで低周波を減衰
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 100;
    filter.Q.value = 0.707;
    
    source.connect(filter);
    filter.connect(gainNode);
    filterNodes.push(filter);
  } else if (noiseType === 'brown') {
    // ブラウンノイズ：複数のローパスフィルタで低周波を強調
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.value = 500;
    filter1.Q.value = 0.707;
    
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = 200;
    filter2.Q.value = 0.707;
    
    source.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(gainNode);
    filterNodes.push(filter1, filter2);
  }
  
  gainNode.connect(ctx.destination);
  
  source.start(0);
  
  bufferSources.push(source);
  gainNodes.push(gainNode);
  
  isPlaying = true;
}

// 後方互換性のため
export function startBrownNoise(volume = 0.3) {
  startNoise('brown', volume);
}

export function stopBrownNoise() {
  if (!isPlaying) return;

  bufferSources.forEach(source => {
    try {
      source.stop();
    } catch (e) {
      // 既に停止している場合はエラーを無視
    }
  });
  
  bufferSources = [];
  gainNodes = [];
  filterNodes = [];
  isPlaying = false;
}

/**
 * ノイズタイプを変更
 * @param {string} noiseType - 'white', 'pink', 'brown'
 */
export function changeNoiseType(noiseType) {
  if (isPlaying) {
    stopBrownNoise();
    startNoise(noiseType, currentVolume);
  }
}

export function setBrownNoiseVolume(volume) {
  currentVolume = volume;
  gainNodes.forEach((gainNode) => {
    gainNode.gain.value = volume;
  });
}

export function isBrownNoisePlaying() {
  return isPlaying;
}

// バックグラウンド再生の永続化
export function enableBackgroundPlayback() {
  // Service Worker でタイマーを管理
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.active?.postMessage({
        type: 'ENABLE_BACKGROUND_PLAYBACK'
      });
    });
  }
}

// ページが非表示になった時の処理
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isPlaying) {
    // ページが非表示でもノイズは継続
    console.log('Background playback: Noise continues');
  } else if (!document.hidden && isPlaying) {
    // ページが表示されたときの処理
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }
});

// ページを離れる際の処理
window.addEventListener('beforeunload', () => {
  // ノイズを停止
  stopBrownNoise();
});
