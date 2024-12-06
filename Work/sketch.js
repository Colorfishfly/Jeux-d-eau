let particles = [];
let colors = [];
let parNum = 1000; // 總粒子數量
let mySize;
let bgMusic;

function preload() {
  bgMusic = loadSound('assets/background.mp3'); // 載入背景音樂
}

function setup() {
  mySize = min(windowWidth, windowHeight);
  createCanvas(mySize, mySize);
  colorMode(HSB, 360, 100, 100, 100);
  colors[0] = color(15, 90, 90, random(25, 50));
  colors[1] = color(175, 90, 90, random(25, 50));

  // 初始化粒子陣列
  for (let i = 0; i < parNum; i++) {
    particles.push(new Particle(random(width), random(height)));
  }
  background(0, 0, 5, 100);

  // 漢堡按鈕開啟選單
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('menu').classList.add('open');
  });

  // 關閉選單
  document.getElementById('close-menu').addEventListener('click', () => {
    document.getElementById('menu').classList.remove('open');
  });

  // 顯示文字
  document.getElementById('show-text').addEventListener('click', () => {
    fill(255);
    textSize(32);
    textAlign(CENTER, CENTER);
    text('Hello, World!', width / 2, height / 2);
  });

  // 重新整理粒子效果
  document.getElementById('refresh').addEventListener('click', () => {
    particles = [];
    for (let i = 0; i < parNum; i++) {
      particles.push(new Particle(random(width), random(height)));
    }
    background(0, 0, 5, 100);
  });

  // 播放/停止音樂
  document.getElementById('play-music').addEventListener('click', () => {
    if (bgMusic.isPlaying()) {
      bgMusic.stop(); // 停止音樂
    } else {
      bgMusic.loop(); // 循環播放音樂
    }
  });
}

function draw() {
  for (let j = particles.length - 1; j > 0; j--) {
    particles[j].update();
    particles[j].show();
    if (particles[j].finished()) {
      particles.splice(j, 1);
      background(0, 0, 5, 0.1);
    }
  }

  // 補充粒子數量
  for (let i = particles.length; i < parNum; i++) {
    particles.push(new Particle(random(width), random(height)));
  }
}

function windowResized() {
  mySize = min(windowWidth, windowHeight);
  resizeCanvas(mySize, mySize);
}

// 粒子類別
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.pos = createVector(this.x, this.y);
    this.life = random(1);
    this.c = random(colors);
    this.ff = 0;
  }

  update() {
    this.ff = noise(this.pos.x / 100, this.pos.y / 100) * TWO_PI; // Flow Field
    let mainP = 1200;
    let changeDir = TWO_PI / mainP; // 方向改變
    let roundff = round((this.ff / TWO_PI) * mainP); // round ff
    this.ff = changeDir * roundff; // 新方向

    // 判斷方向改變
    if (this.ff < 6 && this.ff > 3) {
      this.c = colors[0];
      stroke(this.c);
      this.pos.add(tan(this.ff) * random(1, 3), tan(this.ff));
    } else {
      this.c = colors[1];
      stroke(this.c);
      this.pos.sub(sin(this.ff) * random(0.1, 1), cos(this.ff));
    }
  }

  finished() {
    this.life -= random(random(random(random()))) / 10;
    this.life = constrain(this.life, 0, 1);
    return this.life === 0;
  }

  show() {
    noFill();
    strokeWeight(random(1.25));
    let lx = 20;
    let ly = 20;
    let px = constrain(this.pos.x, lx, width - lx);
    let py = constrain(this.pos.y, ly, height - ly);
    point(px, py);
  }
}
