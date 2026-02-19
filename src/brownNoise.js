/**
 * ブラウンノイズ生成器（バックグラウンド再生対応）
 * Web Audio APIを使用してブラウンノイズを生成します
 * バックグラウンド再生にも対応
 */

let audioContext = null;
let bufferSources = [];
let gainNodes = [];
let isPlaying = false;
let currentVolume = 0.3;

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

export function startBrownNoise(volume = 0.3) {
  if (isPlaying) return;

  const ctx = initAudioContext();
  
  // AudioContext が suspended の場合は再開
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  currentVolume = volume;

  // ブラウンノイズは複数の周波数帯域のノイズを組み合わせて生成
  const frequencies = [100, 200, 400, 800, 1600, 3200, 6400];
  
  frequencies.forEach(freq => {
    // ホワイトノイズ生成
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    // バッファソースの作成
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    // ローパスフィルタの作成（ブラウンノイズ化）
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.5;
    
    // ゲインノードの作成
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume / frequencies.length;
    
    // 接続
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    source.start(0);
    
    bufferSources.push(source);
    gainNodes.push(gainNode);
  });
  
  isPlaying = true;
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
  isPlaying = false;
}

export function setBrownNoiseVolume(volume) {
  currentVolume = volume;
  gainNodes.forEach((gainNode, index) => {
    gainNode.gain.value = volume / gainNodes.length;
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
    console.log('Background playback: Brown noise continues');
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
