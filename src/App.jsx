import React, { useState, useEffect, useRef } from 'react'
import { startNoise, stopBrownNoise, setBrownNoiseVolume, isBrownNoisePlaying, enableBackgroundPlayback, changeNoiseType } from './brownNoise'
import './App.css'

const PRESETS = [
  { name: '25分/5分', focus: 25, break: 5 },
  { name: '15分/3分', focus: 15, break: 3 },
  { name: '45分/10分', focus: 45, break: 10 },
  { name: 'カスタム', focus: null, break: null },
]

export default function App() {
  // タイマー設定
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [timeRemaining, setTimeRemaining] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [noiseVolume, setNoiseVolume] = useState(0.3)
  const [noiseType, setNoiseType] = useState('brown')
  
  // UI状態
  const [showSettings, setShowSettings] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [showAlert, setShowAlert] = useState(false)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  
  // 参照
  const timerIntervalRef = useRef(null)
  const alertTimeoutRef = useRef(null)

  // LocalStorage から設定を読み込む
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode')
    const savedFocus = localStorage.getItem('focusMinutes')
    const savedBreak = localStorage.getItem('breakMinutes')
    const savedVolume = localStorage.getItem('noiseVolume')
    const savedNoiseType = localStorage.getItem('noiseType')
    const savedPomodoroCount = localStorage.getItem('pomodoroCount')

    if (savedDarkMode !== null) setDarkMode(JSON.parse(savedDarkMode))
    if (savedFocus) setFocusMinutes(parseInt(savedFocus))
    if (savedBreak) setBreakMinutes(parseInt(savedBreak))
    if (savedVolume) setNoiseVolume(parseFloat(savedVolume))
    if (savedNoiseType) setNoiseType(savedNoiseType)
    if (savedPomodoroCount) setPomodoroCount(parseInt(savedPomodoroCount))
    
    // バックグラウンド再生を有効化
    enableBackgroundPlayback()
  }, [])

  // 設定を保存
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    localStorage.setItem('focusMinutes', focusMinutes.toString())
    localStorage.setItem('breakMinutes', breakMinutes.toString())
    localStorage.setItem('noiseVolume', noiseVolume.toString())
    localStorage.setItem('noiseType', noiseType)
    localStorage.setItem('pomodoroCount', pomodoroCount.toString())
  }, [darkMode, focusMinutes, breakMinutes, noiseVolume, noiseType, pomodoroCount])

  // タイマーのメイン処理
  useEffect(() => {
    if (!isRunning || isPaused) return

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleTimerEnd()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerIntervalRef.current)
  }, [isRunning, isPaused, isBreak, focusMinutes, breakMinutes])

  // ノイズの制御
  useEffect(() => {
    if (isRunning && !isPaused && !isBreak) {
      if (!isBrownNoisePlaying()) {
        startNoise(noiseType, noiseVolume)
      }
    } else {
      if (isBrownNoisePlaying()) {
        stopBrownNoise()
      }
    }
  }, [isRunning, isPaused, isBreak, noiseVolume, noiseType])

  const handleTimerEnd = () => {
    playNotificationSound()
    setShowAlert(true)
    
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
    alertTimeoutRef.current = setTimeout(() => setShowAlert(false), 2000)
    
    if (!isBreak) {
      // 集中終了 → 休憩開始
      setPomodoroCount(prev => prev + 1)
      setIsBreak(true)
      setTimeRemaining(breakMinutes * 60)
      setIsRunning(false)
      setIsPaused(false)
    } else {
      // 休憩終了 → 集中開始
      setIsBreak(false)
      setTimeRemaining(focusMinutes * 60)
      setIsRunning(false)
      setIsPaused(false)
    }
  }

  const playNotificationSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }

  const handleStartPause = () => {
    if (!isRunning) {
      setIsRunning(true)
      setIsPaused(false)
    } else if (!isPaused) {
      setIsPaused(true)
    } else {
      setIsPaused(false)
    }
  }

  const handleReset = () => {
    setIsRunning(false)
    setIsPaused(false)
    setIsBreak(false)
    setTimeRemaining(focusMinutes * 60)
    stopBrownNoise()
  }

  const handlePresetChange = (index) => {
    setSelectedPreset(index)
    if (index < PRESETS.length - 1) {
      setFocusMinutes(PRESETS[index].focus)
      setBreakMinutes(PRESETS[index].break)
      if (!isRunning) {
        setTimeRemaining(PRESETS[index].focus * 60)
      }
    }
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setNoiseVolume(newVolume)
    if (isRunning && !isPaused && !isBreak) {
      setBrownNoiseVolume(newVolume)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = () => {
    const total = isBreak ? breakMinutes * 60 : focusMinutes * 60
    return ((total - timeRemaining) / total) * 100
  }

  const getStatusColor = () => {
    if (isBreak) return '#22C55E'
    return '#60a5fa'
  }

  const getStatusText = () => {
    if (!isRunning) return 'アイドル'
    if (isPaused) return '一時停止中'
    if (isBreak) return '休憩中'
    return ''
  }

  // キーボードショートカット
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleStartPause()
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        handleReset()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isRunning, isPaused])

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <div className="container">
        {/* ヘッダー */}
        <div className="header">
          <h1>Brown Noise Timer</h1>
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={`${darkMode ? 'ライト' : 'ダーク'}モードに切り替え`}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* ステータスバー */}
        {(isRunning || isPaused) && (
          <div className="status-bar" style={{ backgroundColor: getStatusColor() }}>
            {isRunning && !isPaused && (
              <div className="status-pulse"></div>
            )}
          </div>
        )}

        {/* メインタイマー表示 */}
        <div className="timer-display">
          <div className="timer-circle" style={{ borderColor: getStatusColor() }}>
            <svg className="progress-ring" viewBox="0 0 100 100" role="img" aria-label={`残り時間: ${formatTime(timeRemaining)}`}>
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="progress-bg"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={getStatusColor()}
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - getProgressPercentage() / 100)}`}
                strokeLinecap="round"
                className="progress-fill"
              />
            </svg>
            <div className="timer-text">{formatTime(timeRemaining)}</div>
          </div>
        </div>

        {/* ポモドーロカウント */}
        <div className="pomodoro-count">
          本日: <span className="count-value">{pomodoroCount}</span> ポモドーロ完了
        </div>

        {/* コントロールボタン */}
        <div className="controls">
          <button
            className="btn btn-primary"
            onClick={handleStartPause}
            aria-label={isRunning && !isPaused ? '一時停止' : '開始'}
          >
            {!isRunning ? '開始' : isPaused ? '再開' : '一時停止'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            aria-label="リセット"
          >
            リセット
          </button>
        </div>

        {/* ノイズ音量コントロール */}
        {!isBreak && (
          <div className="noise-control">
            <label htmlFor="volume-slider">ブラウンノイズ音量</label>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={noiseVolume}
              onChange={handleVolumeChange}
              className="volume-slider"
              aria-label="音量"
            />
            <div className="volume-value">{Math.round(noiseVolume * 100)}%</div>
          </div>
        )}

        {/* 設定ボタン */}
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="設定を開く"
          aria-expanded={showSettings}
        >
          ⚙️
        </button>

        {/* 設定パネル */}
        {showSettings && (
          <div className="settings-panel" role="dialog" aria-label="設定">
            <div className="settings-header">
              <h2>設定</h2>
              <button
                className="close-btn"
                onClick={() => setShowSettings(false)}
                aria-label="設定を閉じる"
              >
                ✕
              </button>
            </div>

            <div className="settings-content">
              {/* プリセット */}
              <div className="setting-item">
                <label>プリセット</label>
                <div className="preset-buttons">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      className={`preset-btn ${selectedPreset === idx ? 'active' : ''}`}
                      onClick={() => handlePresetChange(idx)}
                      disabled={isRunning}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 集中時間 */}
              <div className="setting-item">
                <label htmlFor="focus-input">集中時間（分）</label>
                <input
                  id="focus-input"
                  type="number"
                  min="1"
                  max="60"
                  value={focusMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 25
                    setFocusMinutes(val)
                    if (!isRunning && !isBreak) {
                      setTimeRemaining(val * 60)
                    }
                  }}
                  disabled={isRunning}
                  className="input-number"
                />
              </div>

              {/* 休憩時間 */}
              <div className="setting-item">
                <label htmlFor="break-input">休憩時間（分）</label>
                <input
                  id="break-input"
                  type="number"
                  min="1"
                  max="30"
                  value={breakMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 5
                    setBreakMinutes(val)
                    if (!isRunning && isBreak) {
                      setTimeRemaining(val * 60)
                    }
                  }}
                  disabled={isRunning}
                  className="input-number"
                />
              </div>

              {/* ノイズタイプ */}
              <div className="setting-item">
                <label htmlFor="noise-type">ノイズタイプ</label>
                <select
                  id="noise-type"
                  value={noiseType}
                  onChange={(e) => {
                    const newType = e.target.value
                    setNoiseType(newType)
                    if (isRunning && !isPaused && !isBreak) {
                      changeNoiseType(newType)
                    }
                  }}
                  className="input-select"
                >
                  <option value="brown">ブラウンノイズ</option>
                  <option value="white">ホワイトノイズ</option>
                  <option value="pink">ピンクノイズ</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* アラート */}
        {showAlert && (
          <div className="alert-overlay">
            <div className="alert-content">
              <div className="alert-emoji">🎉</div>
              <div className="alert-text">
                {isBreak ? '休憩終了！' : '集中完了！'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
