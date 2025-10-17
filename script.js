let rows = 6, cols = 10, size = 56;
let bubbles = [], soundOn = true, audioType = 1;
let customImg = null, useDefaultStyle = true;

const grid = document.getElementById('bubbleGrid');
const counter = document.getElementById('counter');
const soundToggle = document.getElementById('soundToggle');
const audioBtns = document.querySelectorAll('.audio-btn');
const uploadImg = document.getElementById('uploadImg');
const resetBtn = document.getElementById('resetBtn');
const resetStyleBtn = document.getElementById('resetStyleBtn');
const popRandomBtn = document.getElementById('popRandomBtn');

const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');
let imgObj = new Image(), scale = 1, offsetX = 0, offsetY = 0, rotation = 0;
let isDragging = false, dragStart = {x:0,y:0};
let isTouching = false, lastDistance = 0, lastRotation = 0;

// --------------------- 创建泡泡网格 ---------------------
function createGrid() {
    grid.innerHTML = '';
    const screenWidth = window.innerWidth - 32;
    const bubbleSize = Math.min(size, Math.floor(screenWidth / cols) - 6);

    grid.style.gridTemplateColumns = `repeat(${cols}, ${bubbleSize}px)`;
    grid.style.gridAutoRows = `${bubbleSize}px`;

    bubbles = [];
    for (let i = 0; i < rows * cols; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.style.width = bubble.style.height = bubbleSize + 'px';

        if (!useDefaultStyle && customImg) {
            bubble.classList.add('custom-img');
            const img = document.createElement('img');
            img.src = customImg;
            bubble.appendChild(img);
        } else if (useDefaultStyle) {
            bubble.style.setProperty('--texture-size', `${4 + Math.random()*4}px`);
            bubble.style.setProperty('--texture-opacity', `${0.05 + Math.random()*0.05}`);
        }

        bubble.dataset.index = i;
        grid.appendChild(bubble);
        bubbles.push({el: bubble, popped: false});
    }
    updateCounter();
}

// --------------------- 更新计数 ---------------------
function updateCounter() {
    const popped = bubbles.filter(b => b.popped).length;
    counter.textContent = `已捏：${popped}/${bubbles.length}`;
}

// --------------------- 捏泡泡 ---------------------
function popBubble(index) {
    const bubble = bubbles[index];
    if (!bubble) return;
    bubble.el.style.transform = 'scale(0.85)';
    if (!bubble.popped) { bubble.popped = true; if (soundOn) playPopSound(audioType); }
    updateCounter();
}

function popRandom() {
    const available = bubbles.map((b,i)=>!b.popped?i:-1).filter(i=>i>=0);
    if(!available.length) return;
    const idx = available[Math.floor(Math.random()*available.length)];
    popBubble(idx);
}

// --------------------- mp3 音效 ---------------------
const popSounds = {
    1: new Audio('./sounds/菜单按钮点击声_耳聆网_[声音ID：22710].wav'),
    2: new Audio('./sounds/叭一声折断_耳聆网_[声音ID：12691].wav'),
    3: new Audio('./sounds/打一个响指_耳聆网_[声音ID：20468].wav')
};

function playPopSound(type){
    if(!soundOn) return;
    const sound = popSounds[type];
    if(!sound) return;
    sound.currentTime = 0;
    sound.play().catch(e=>console.log('音效播放失败', e));
}

// --------------------- 泡泡长按拖动 (PC + 移动端) ---------------------
let isPointerDown = false, lastBubbleIdx = -1;
grid.addEventListener('pointerdown', e=>{
    isPointerDown = true;
    handlePointer(e);
});
grid.addEventListener('pointermove', e=>{
    if(isPointerDown) handlePointer(e);
});
window.addEventListener('pointerup', ()=>{
    isPointerDown = false;
    lastBubbleIdx = -1;
});
// 移动端 touch 支持滑动戳泡泡
grid.addEventListener('touchmove', e=>{
    const touch = e.touches[0];
    if(!touch) return;
    const target = document.elementFromPoint(touch.clientX,touch.clientY)?.closest('.bubble');
    if(!target) return;
    const idx = parseInt(target.dataset.index);
    if(idx !== lastBubbleIdx){ lastBubbleIdx = idx; popBubble(idx); }
},{passive:false});

function handlePointer(e){
    const target = e.target.closest('.bubble');
    if(!target) return;
    const idx = parseInt(target.dataset.index);
    if(idx !== lastBubbleIdx){
        lastBubbleIdx = idx;
        popBubble(idx);
    }
}

// --------------------- 音效选择 ---------------------
soundToggle.addEventListener('change', e=>{ soundOn = e.target.checked; });
audioBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
        audioBtns.forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        audioType = parseInt(btn.dataset.type);
    });
});

// --------------------- 上传裁剪 ---------------------
uploadImg.addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
        imgObj.src = ev.target.result;
        scale = 1; offsetX=0; offsetY=0; rotation=0;
        cropModal.style.display='flex';
    };
    reader.readAsDataURL(file);
});

// --------------------- 裁剪操作 ---------------------
cropCanvas.addEventListener('pointerdown', e=>{ 
    if(e.pointerType==='touch') return; 
    isDragging=true; dragStart={x:e.offsetX,y:e.offsetY}; 
});
cropCanvas.addEventListener('pointermove', e=>{ 
    if(isDragging){ 
        offsetX += e.offsetX - dragStart.x; 
        offsetY += e.offsetY - dragStart.y; 
        dragStart={x:e.offsetX,y:e.offsetY}; 
        drawCropCanvas(); 
    }
});
cropCanvas.addEventListener('pointerup', ()=>{ isDragging=false; });

// --------------------- PC 端滚轮缩放 ---------------------
cropCanvas.addEventListener('wheel', e => {
    e.preventDefault(); // 阻止页面滚动
    const delta = e.deltaY < 0 ? 1.1 : 0.9; // 向上滚轮放大，向下缩小
    scale *= delta;
    if (scale < 0.1) scale = 0.1; // 限制最小缩放
    if (scale > 10) scale = 10;   // 限制最大缩放
    drawCropCanvas();
}, { passive: false });

// --------------------- 移动端手势: 捏合缩放+旋转 ---------------------
cropCanvas.addEventListener('touchstart', e=>{
    if(e.touches.length===2){
        isTouching=true;
        lastDistance = getTouchDistance(e.touches[0], e.touches[1]);
        lastRotation = getTouchAngle(e.touches[0], e.touches[1]);
    } else if(e.touches.length===1){
        isDragging=true;
        dragStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
    }
    e.preventDefault();
},{passive:false});

cropCanvas.addEventListener('touchmove', e=>{
    if(isTouching && e.touches.length===2){
        const curDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scaleChange = curDistance/lastDistance;
        scale *= Math.pow(scaleChange, 1.2); // 提升灵敏度，但更平滑
        scale = Math.min(Math.max(scale, 0.3), 8); // 限制缩放范围（避免过大或消失）
        lastDistance = curDistance;

        const curAngle = getTouchAngle(e.touches[0], e.touches[1]);
        rotation += curAngle - lastRotation;
        lastRotation = curAngle;

        drawCropCanvas();
    } else if(isDragging && e.touches.length===1){
        offsetX += e.touches[0].clientX - dragStart.x;
        offsetY += e.touches[0].clientY - dragStart.y;
        dragStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
        drawCropCanvas();
    }
    e.preventDefault();
},{passive:false});

cropCanvas.addEventListener('touchend', e=>{
    if(e.touches.length<2) isTouching=false;
    if(e.touches.length===0) isDragging=false;
});

function getTouchDistance(t1,t2){
    return Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
}
function getTouchAngle(t1,t2){
    return Math.atan2(t2.clientY-t1.clientY, t2.clientX-t1.clientX)*180/Math.PI;
}

// --------------------- 绘制裁剪 ---------------------
function drawCropCanvas(){
    cropCtx.clearRect(0,0,cropCanvas.width,cropCanvas.height);
    const cw=cropCanvas.width,ch=cropCanvas.height;
    cropCtx.save();
    cropCtx.translate(cw/2,ch/2);
    cropCtx.rotate(rotation*Math.PI/180);
    cropCtx.beginPath();
    cropCtx.arc(0,0,cw/2,0,Math.PI*2);
    cropCtx.closePath();
    cropCtx.clip();
    cropCtx.drawImage(imgObj, offsetX - cw/2, offsetY - ch/2, imgObj.width*scale, imgObj.height*scale);
    cropCtx.restore();
}

// --------------------- 裁剪确认 ---------------------
document.getElementById('cropConfirm').addEventListener('click', ()=>{
    const data = cropCanvas.toDataURL();
    customImg = data; useDefaultStyle=false;
    cropModal.style.display='none';
    createGrid();
});
document.getElementById('cropCancel').addEventListener('click', ()=>{ cropModal.style.display='none'; });

// --------------------- 重置按钮 ---------------------
resetBtn.addEventListener('click', ()=>{
    bubbles.forEach(b=>{ b.popped=false; b.el.style.transform='scale(1)'; });
    updateCounter();
});
resetStyleBtn.addEventListener('click', ()=>{
    if(customImg){
        customImg=null; useDefaultStyle=true;
        createGrid();
    }
});

// --------------------- 随机捏 ---------------------
popRandomBtn.addEventListener('click', popRandom);

// --------------------- 窗口缩放 ---------------------
window.addEventListener('resize', createGrid);

// --------------------- 初始化 ---------------------
createGrid();
