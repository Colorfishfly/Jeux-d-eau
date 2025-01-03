// Constants and configuration
const CONFIG = {
  canvas: {
    width: 800,
    height: 600
  },
  particles: {
    count: 200,
    maxSpeed: { min: 2, max: 4 },
    radius: { min: 0.25, max: 1 }
  },
  hands: {
    fingertips: [8, 12, 16, 20],
    maxNumHands: 2,
    confidence: {
      detection: 0.4,
      tracking: 0.5
    }
  },
  audio: {
    defaultVolume: 0.3,
    notes: {
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
      'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25
    }
  },
  theme: {
    colors: ["#0799F2", "#FFFFFF", "#0058a1", "#004B97", "#84C1FF", "#c5afd4"],
    background: "#150832"
  }
};

// Particle class definition
class Particle {
  constructor(theme, scale) {
    this.scale = scale;
    this.pos = new p5.Vector(
      random(-50, CONFIG.canvas.width + 50),
      random(-50, CONFIG.canvas.height + 50)
    );
    this.color = random(theme.colors);
    this.baseRadius = random(CONFIG.particles.radius.min, CONFIG.particles.radius.max);
    this.r = this.baseRadius;
    this.velocity = new p5.Vector(0, 0);
    this.maxSpeed = random(CONFIG.particles.maxSpeed.min, CONFIG.particles.maxSpeed.max);
  }

  update(energy = 0, bass = 0) {
    const energyFactor = map(energy, 0, 255, 0.5, 2);
    this.r = this.baseRadius * energyFactor;
    
    const bassFactor = map(bass, 0, 255, 0.5, 2);
    const noiseValue = noise(this.pos.x / this.scale, this.pos.y / this.scale);
    const dir = noiseValue * TAU * this.scale;
    
    const targetVelocity = p5.Vector.fromAngle(dir).mult(bassFactor);
    this.velocity.lerp(targetVelocity, 0.1);
    this.velocity.limit(this.maxSpeed * bassFactor);
    this.pos.add(this.velocity);

    this.checkBounds();
  }

  checkBounds() {
    const margin = 50;
    if (this.isOutOfBounds(margin)) {
      this.resetPosition(margin);
    }
  }

  isOutOfBounds(margin) {
    return (
      this.pos.x < -margin ||
      this.pos.x > CONFIG.canvas.width + margin ||
      this.pos.y < -margin ||
      this.pos.y > CONFIG.canvas.height + margin
    );
  }

  resetPosition(margin) {
    this.pos.set(
      random(-margin, CONFIG.canvas.width + margin),
      random(-margin, CONFIG.canvas.height + margin)
    );
  }

  draw(graphics) {
    graphics.fill(this.color);
    graphics.circle(this.pos.x, this.pos.y, this.r);
  }
}

// Main sketch class
class WaterRippleSketch {
  constructor() {
    this.reset();
    this.setupHandsfree();
    
    window.addEventListener('error', (e) => {
      if (e.message.includes('audio') || e.message.includes('AudioNode')) {
        console.warn('音頻錯誤，嘗試重新初始化:', e);
        this.initializeAudio().catch(console.error);
      }
    });
  }

  reset() {
    this.ripples = [];
    this.particles = [];
    this.prevPalm = Array(CONFIG.hands.maxNumHands).fill().map(() => ({ x: 0, y: 0 }));
    this.prevPointer = Array(CONFIG.hands.maxNumHands).fill().map(() => 
      Array(CONFIG.hands.fingertips.length).fill().map(() => ({ x: 0, y: 0 }))
    );
    this.movement = { deltaX: 0, deltaY: 0, smoothX: 0, smoothY: 0 };
    this.frameCount = 0;
    this.audioContext = null;
    this.audioInitialized = false;
  }

  setupHandsfree() {
    this.handsfree = new Handsfree({
      showDebug: false,  // 關閉調試視圖
      hands: {
        enabled: true,
        maxNumHands: CONFIG.hands.maxNumHands,
        minDetectionConfidence: CONFIG.hands.confidence.detection,
        minTrackingConfidence: CONFIG.hands.confidence.tracking
      }
    });
    
    this.handsfree.enablePlugins("browser");
    this.handsfree.plugin.pinchScroll.disable();

    // 隱藏攝像頭視頻元素
    this.handsfree.on('ready', () => {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        video.style.display = 'none';
      });
    });
  }

  async initializeAudio() {
    try {
      // 確保音頻上下文存在且運行
      let audioContext = getAudioContext();
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // 先停止所有現有的音頻處理
      if (this.fft) this.fft.dispose();
      if (this.amplitude) this.amplitude.dispose();
      
      // 確保音頻上下文已恢復
      await audioContext.resume();
      
      // 等待一小段時間確保音頻系統準備就緒
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!this.audioInitialized) {
        try {
          // 創建新的分析器，使用更保守的設置
          this.fft = new p5.FFT(0.9, 256);  // 使用較小的FFT大小和較大的平滑因子
          this.amplitude = new p5.Amplitude(0.9);  // 較大的平滑因子
          
          // 確保輸入設置正確
          this.fft.setInput();
          this.amplitude.setInput();
          
          // 初始化音頻處理狀態
          this.audioInitialized = true;
          console.log('音頻系統初始化成功');
        } catch (e) {
          console.error('音頻分析器初始化失敗:', e);
          throw e;
        }
      }
    } catch (error) {
      console.error('音頻初始化錯誤:', error);
      this.audioInitialized = false;
      // 清理現有的音頻資源
      if (this.fft) this.fft.dispose();
      if (this.amplitude) this.amplitude.dispose();
    }
  }

  createSynth(frequency, duration = 150) { // 改為 150ms 使聲音更短促
    try {
      const audioContext = getAudioContext();
      if (!audioContext || audioContext.state !== 'running') {
        console.warn('音頻上下文未就緒');
        return;
      }

      // 創建振盪器
      const osc = new p5.Oscillator();
      osc.setType('sine');
      osc.freq(frequency);
      
      // 創建包絡器並設置 ADSR
      const env = new p5.Envelope();
      // 參數分別是：attack時間, decay時間, sustain電平, release時間
      env.setADSR(0.01, 0.05, 0.2, 0.1); // 更短的音符設置
      env.setRange(0.5, 0); // 音量範圍保持不變
      
      // 連接並開始播放
      osc.amp(env);
      osc.start();
      env.triggerAttack();
      
      // 設置釋放
      setTimeout(() => {
        env.triggerRelease();
        setTimeout(() => {
          osc.stop();
          osc.dispose();
        }, 500); // 縮短清理等待時間
      }, duration);
      
    } catch (error) {
      console.error('合成器創建錯誤:', error);
    }
  }

  playNote(x, y) {
    if (!this.audioInitialized) {
      this.initializeAudio().then(() => {
        this._playNoteWithFreq(x, y);
      }).catch(console.error);
      return;
    }
    this._playNoteWithFreq(x, y);
  }

  _playNoteWithFreq(x, y) {
    const noteFreqs = Object.values(CONFIG.audio.notes);
    const noteIndex = floor(map(y, 0, height, 0, noteFreqs.length));
    const frequency = noteFreqs[constrain(noteIndex, 0, noteFreqs.length - 1)];
    
    this.createSynth(frequency);
  }

  createParticles() {
    this.scale = random(800, 2000);
    this.graphics = createGraphics(CONFIG.canvas.width, CONFIG.canvas.height);
    this.graphics.background(CONFIG.theme.background);
    this.graphics.noStroke();

    for (let i = 0; i < CONFIG.particles.count; i++) {
      this.particles.push(new Particle(CONFIG.theme, this.scale));
    }
  }

  createUI() {
    // 創建菜單容器
    const menu = document.createElement('div');
    menu.id = 'control-menu';
    menu.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 5, 0.8);
      padding: 15px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 1000;
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(menu);

    // 按鈕樣式
    const buttonStyle = `
      background: rgba(15, 90, 90, 0.3);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      transition: all 0.3s ease;
      text-align: left;
      width: 150px;
      &:hover {
        background: rgba(175, 90, 90, 0.5);
        border-color: rgba(255, 255, 255, 0.4);
      }
    `;

    // 創建按鈕函數
    const createButton = (label, action) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.style.cssText = buttonStyle;
      button.addEventListener('mouseover', () => {
        button.style.background = 'rgba(175, 90, 90, 0.5)';
      });
      button.addEventListener('mouseout', () => {
        button.style.background = 'rgba(15, 90, 90, 0.3)';
      });
      button.addEventListener('click', action);
      menu.appendChild(button);
      return button;
    };

    // 創建各個按鈕
    createButton('Start Audio', () => this.initializeAudio());
    
    createButton('Volume -', () => {
      if (this.bgm) {
        this.bgm.setVolume(Math.max(0, this.bgm.getVolume() - 0.1));
      }
    });
    
    createButton('Volume +', () => {
      if (this.bgm) {
        this.bgm.setVolume(Math.min(1, this.bgm.getVolume() + 0.1));
      }
    });

    // Webcam 控制按鈕
    const startButton = createButton('Start Webcam', () => this.handsfree.start());
    startButton.className = "handsfree-show-when-stopped handsfree-hide-when-loading";

    const loadingButton = document.createElement('button');
    loadingButton.textContent = "...loading...";
    loadingButton.style.cssText = buttonStyle;
    loadingButton.className = "handsfree-show-when-loading";
    menu.appendChild(loadingButton);

    const stopButton = createButton('Stop Webcam', () => this.handsfree.stop());
    stopButton.className = "handsfree-show-when-started";

    this.buttonStart = startButton;
    this.buttonLoading = loadingButton;
    this.buttonStop = stopButton;
  }

  init() {
    try {
      this.sketch = createCanvas(CONFIG.canvas.width, CONFIG.canvas.height);
      this.centerCanvas();
      
      getAudioContext().suspend();
      
      this.createParticles();
      this.createUI();
      this.loadBGM();
    } catch (error) {
      console.error('初始化失敗:', error);
    }
  }

  centerCanvas() {
    const x = (windowWidth - CONFIG.canvas.width) / 2;
    const y = (windowHeight - CONFIG.canvas.height) / 2;
    this.sketch.position(x, y);
  }

  async loadBGM() {
    try {
      const audioContext = getAudioContext();
      if (!audioContext || audioContext.state !== 'running') {
        console.warn('音頻上下文未就緒，稍後將重試加載BGM');
        setTimeout(() => this.loadBGM(), 1000);
        return;
      }

      // 如果已經存在BGM，先停止並斷開連接
      if (this.bgm) {
        this.bgm.stop();
        this.bgm.disconnect();
      }

      this.bgm = await new Promise((resolve, reject) => {
        loadSound("bgm.mp3", 
          (bgm) => {
            console.log('BGM加載成功');
            
            if (this.audioInitialized) {
              try {
                // 創建緩衝區
                const bufferSize = audioContext.sampleRate * 2;  // 2秒緩衝
                const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate);
                
                // 設置音頻節點
                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(CONFIG.audio.defaultVolume, audioContext.currentTime);
                
                bgm.disconnect();
                bgm.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                bgm.loop();
              } catch (e) {
                console.error('BGM 設置錯誤:', e);
              }
            }
            
            resolve(bgm);
          },
          (error) => {
            console.error('BGM加載失敗:', error);
            reject(error);
          }
        );
      });

    } catch (error) {
      console.error('BGM初始化錯誤:', error);
      setTimeout(() => this.loadBGM(), 5000);
    }
  }

  update() {
    this.frameCount = (this.frameCount + 1) % 50;

    let energy = 0;
    let bass = 0;
    
    if (this.audioInitialized && this.fft) {
      const spectrum = this.fft.analyze();
      energy = this.fft.getEnergy("mid");
      bass = this.fft.getEnergy("bass");
    }

    this.particles.forEach(p => {
      p.update(energy, bass);
      p.draw(this.graphics);
    });
  }

  draw() {
    background(0);
    this.update();
    image(this.graphics, 0, 0);

    const hands = this.handsfree.data?.hands;
    if (hands) {
      this.updateHandPosition(hands);
      this.handlePinchGestures(hands);
    }
    
    this.drawRipples();
  }

  updateHandPosition(hands) {
    if (!hands?.landmarks || !Array.isArray(hands.landmarks)) {
      return;
    }

    hands.landmarks.forEach((hand, index) => {
      // 首先驗證手部數據的基本有效性
      if (!this.isValidHandData(hand, index)) {
        return;
      }

      const currentPalm = {
        x: width - hand[0].x * width,
        y: hand[0].y * height
      };

      if (!this.prevPalm[index]) {
        this.prevPalm[index] = currentPalm;
        return;
      }

      // 驗證移動的有效性
      if (!this.isValidMovement(currentPalm, this.prevPalm[index])) {
        return;
      }

      // 更新移動數據
      this.movement.smoothX = lerp(this.prevPalm[index].x, currentPalm.x, 0.05);
      this.movement.smoothY = lerp(this.prevPalm[index].y, currentPalm.y, 0.05);
      this.movement.deltaX = this.movement.smoothX - this.prevPalm[index].x;
      this.movement.deltaY = this.movement.smoothY - this.prevPalm[index].y;

      this.prevPalm[index] = { 
        x: this.movement.smoothX, 
        y: this.movement.smoothY 
      };
    });
  }

  // 驗證手部數據的有效性
  isValidHandData(hand, index) {
    // 基本數據檢查
    if (!hand || !hand[0] || typeof hand[0].x !== 'number' || 
        typeof hand[0].y !== 'number' || index >= CONFIG.hands.maxNumHands) {
      return false;
    }

    // 檢查關鍵點數量
    if (hand.length < 21) {
      return false;
    }

    // 檢查手掌特徵
    const palmWidth = this.getDistance(hand[0], hand[5]);
    const palmHeight = this.getDistance(hand[0], hand[17]);
    const ratio = palmWidth / palmHeight;

    // 手掌比例檢查
    return (ratio >= 0.5 && ratio <= 2.0);
  }

  // 驗證移動的有效性
  isValidMovement(current, prev) {
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 過濾過大的移動
    return distance <= 100;
  }

  // 計算兩點間距離
  getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }


  handlePinchGestures(hands) {
    if (!hands.pinchState) return;

    hands.pinchState.forEach((hand, handIndex) => {
      hand.forEach((state, finger) => {
        const landmark = hands.landmarks?.[handIndex]?.[CONFIG.hands.fingertips[finger]];
        if (!landmark) return;

        const x = width - landmark.x * width;
        const y = landmark.y * height;

        if (state === "start") {
          this.prevPointer[handIndex][finger] = { x, y };
          this.ripples.push([x, y, this.frameCount % 50]);
          this.playNote(x, y);
        }

        this.prevPointer[handIndex][finger] = { x, y };
      });
    });
  }

  drawRipples() {
    this.ripples = this.ripples.filter(p => p[2] < 150);

    this.ripples.forEach(p => {
      const speedFactor = 0.1;
      p[0] += this.movement.deltaX * speedFactor;
      p[1] += this.movement.deltaY * speedFactor;

      const rippleStyles = [
        { weight: 0.8, alpha: 1.87, scale: 1.25 },
        { weight: 1.45, alpha: 1.65, scale: 0.8 },
        { weight: 2, alpha: 1.34, scale: 0.6 }
      ];

      rippleStyles.forEach(({ weight, alpha, scale }) => {
        noFill();
        strokeWeight(weight);
        stroke(255, 255 - p[2] * alpha);
        circle(p[0], p[1], p[2] * scale);
      });

      p[2]++;
    });
  }

  windowResized() {
    this.centerCanvas();
  }
}

// Global instance and p5.js functions
let waterRipples;

function setup() {
  waterRipples = new WaterRippleSketch();
  waterRipples.init();
}

function draw() {
  waterRipples.draw();
}

function windowResized() {
  waterRipples.windowResized();
}