/* ========= Sizes ========= */
const STAGE_W = 5000, STAGE_H = 5000;
const RULER_W_BASE = 80, FONT_BASE = 16, TICK_MAJ_BASE = 12, TICK_MIN_BASE = 6;

/* ========= DOM ========= */
const viewport       = document.getElementById('viewport');
const page           = document.getElementById('page');
const stageHolder    = document.getElementById('stage-holder');
const rulerCanvas    = document.getElementById('rulerCanvas');
const konvaHolder    = document.getElementById('konvaHolder');
const konvaContainer = document.getElementById('konvaContainer');

const originSel      = document.getElementById('originSel');

const minInput       = document.getElementById('min');
const maxInput       = document.getElementById('max');
const targetInput    = document.getElementById('target');
const btnGo          = document.getElementById('btnGo');
const uploadsDiv     = document.getElementById('uploads');

const rulerStepInput  = document.getElementById('ruler-step');
const rulerScaleInput = document.getElementById('ruler-scale');
const rulerScaleLabel = document.getElementById('ruler-scale-label');
const scaleDenomInput = document.getElementById('scale-denom');

const btnIn      = document.getElementById('btnZoomIn');
const btnOut     = document.getElementById('btnZoomOut');
const btnReset   = document.getElementById('btnZoomReset');
const zoomSlider = document.getElementById('zoomSlider');
const zoomLabel  = document.getElementById('zoomLabel');
const handle     = document.getElementById('handle');

/* ========= Page-wide Zoom ========= */
let pageScale = 1; // 1 = 100%

function applyPageScale(s) {
  pageScale = Math.max(0.05, Math.min(5, s));
  page.style.transform = `scale(${pageScale})`;
  zoomSlider.value = String(Math.round(pageScale * 100));
  zoomLabel.textContent = `${Math.round(pageScale * 100)}%`;
}
function zoomInPage(){  applyPageScale(pageScale * 1.1); }
function zoomOutPage(){ applyPageScale(pageScale / 1.1); }
function resetZoom(){   applyPageScale(1); }

btnIn.onclick = zoomInPage;
btnOut.onclick = zoomOutPage;
btnReset.onclick = resetZoom;
zoomSlider.addEventListener('input', e => applyPageScale(Number(e.target.value) / 100));

window.addEventListener('keydown', (e)=>{
  if(!e.ctrlKey) return;
  if (e.key==='-' || e.code==='NumpadSubtract'){ e.preventDefault(); zoomOutPage(); }
  if (e.key==='=' || e.key==='+' || e.code==='NumpadAdd'){ e.preventDefault(); zoomInPage(); }
  if (e.key==='0'){ e.preventDefault(); resetZoom(); }
});

/* ========= Drag handle ========= */
(function(){
  let dragging=false, startX=0, startY=0, startScale=1;
  handle.addEventListener('mousedown', e=>{
    dragging=true; startX=e.clientX; startY=e.clientY; startScale=pageScale; e.preventDefault();
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    const delta = (dx+dy)/600;
    applyPageScale(startScale * (1+delta));
  });
  window.addEventListener('mouseup', ()=> dragging=false);
})();

/* ========= Transform origin ========= */
originSel.addEventListener('change', ()=>{
  const map = {
    'Bottom-Right':'bottom right',
    'Bottom-Left':'bottom left',
    'Top-Right':'top right',
    'Top-Left':'top left',
    'Center':'50% 50%',
  };
  page.style.transformOrigin = map[originSel.value] || 'top left';
});

/* ========= Ruler scaling ========= */
let userRulerScale = 1;
rulerScaleInput.addEventListener('input', e=>{
  userRulerScale = Number(e.target.value)/100;
  layoutStage();
  drawGrid();
});

function layoutStage(){
  const RULER_W = Math.round(RULER_W_BASE * userRulerScale);

  stageHolder.style.width  = (RULER_W + STAGE_W) + 'px';
  stageHolder.style.height = STAGE_H + 'px';

  rulerCanvas.width  = RULER_W;
  rulerCanvas.height = STAGE_H;

  konvaHolder.style.left   = RULER_W + 'px';
  konvaHolder.style.width  = STAGE_W + 'px';
  konvaHolder.style.height = STAGE_H + 'px';

  konvaContainer.style.width  = STAGE_W + 'px';
  konvaContainer.style.height = STAGE_H + 'px';

  rulerScaleLabel.textContent = `${Math.round(userRulerScale*100)}%`;
}

/* ========= Konva ========= */
const stage = new Konva.Stage({ container:'konvaContainer', width: STAGE_W, height: STAGE_H });
const staticLayer = new Konva.Layer();
const contentLayer= new Konva.Layer();
const contentGroup= new Konva.Group();
contentLayer.add(contentGroup);
stage.add(contentLayer);
stage.add(staticLayer);

const nodeByInput = new Map();

/* ========= Grid & Ruler ========= */
function drawGrid(){
  const min = parseInt(minInput.value,10);
  const max = parseInt(maxInput.value,10);
  if(isNaN(min)||isNaN(max)||min>=max) return;

  const total = max - min;
  const py = STAGE_H / total;

  contentGroup.find('.grid').forEach(n=>n.destroy());
  for(let i=0;i<=total;i++){
    const y=i*py;
    contentGroup.add(new Konva.Line({
      name:'grid', points:[0,y, STAGE_W, y],
      stroke:'#ddd', strokeWidth:1
    }));
  }
  contentLayer.draw();

  drawRuler();
}

function drawRuler(){
  const ctx = rulerCanvas.getContext('2d');
  const min = parseInt(minInput.value,10);
  const max = parseInt(maxInput.value,10);
  if(isNaN(min)||isNaN(max)||min>=max){ ctx.clearRect(0,0,rulerCanvas.width,rulerCanvas.height); return; }

  const total = max - min;
  const py = STAGE_H / total;

  const RULER_W = rulerCanvas.width;
  const fontPx   = Math.max(10, Math.round(FONT_BASE * userRulerScale));
  const tickMaj  = Math.max(6,  Math.round(TICK_MAJ_BASE * userRulerScale));
  const tickMin  = Math.max(3,  Math.round(TICK_MIN_BASE * userRulerScale));
  const interval = Math.max(1, parseInt(rulerStepInput.value,10) || 10);

  ctx.clearRect(0,0,RULER_W,STAGE_H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,RULER_W,STAGE_H);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RULER_W-1.5, 0);
  ctx.lineTo(RULER_W-1.5, STAGE_H);
  ctx.stroke();

  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';

  function drawLabel(val,y,em=false){
    const safeY = Math.min(Math.max(y, fontPx/2), STAGE_H - fontPx/2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = em ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(RULER_W - (em?tickMaj:tickMin), y);
    ctx.lineTo(RULER_W, y);
    ctx.stroke();
    ctx.font = `${em?'bold':'normal'} ${fontPx}px system-ui, Arial`;
    if (em || (val % interval === 0 && val!==min && val!==max)) {
      ctx.fillText(String(val), 6, safeY);
    }
  }

  for(let i=0;i<=total;i++){
    const y=i*py, val=min+i;
    if(val%interval!==0) drawLabel(val, y, false);
  }
  for(let i=0;i<=total;i++){
    const val=min+i;
    if(val%interval!==0 || val===min || val===max) continue;
    drawLabel(val, i*py, true);
  }
  drawLabel(min, 0, true);
  drawLabel(max, STAGE_H, true);
}

rulerStepInput.addEventListener('input', drawGrid);
minInput.addEventListener('input', drawGrid);
maxInput.addEventListener('input', drawGrid);

/* ========= Go to target ========= */
function scrollToTarget(value){
  const min=parseInt(minInput.value,10), max=parseInt(maxInput.value,10);
  if(isNaN(min)||isNaN(max)||value<min||value>max) return;
  const total=max-min, py=STAGE_H/total, yPos=(value-min)*py;
  viewport.scrollTo({ top: yPos - viewport.clientHeight/2, behavior: "smooth" });
  contentGroup.find('.marker').forEach(n=>n.destroy());
  const line=new Konva.Line({name:'marker',points:[0,yPos,STAGE_W,yPos],stroke:'red',strokeWidth:3,dash:[10,6],opacity:1});
  contentGroup.add(line); line.moveToTop(); contentLayer.draw();
}
btnGo.addEventListener('click', ()=> {
  const v=parseInt(targetInput.value,10);
  if(!isNaN(v)) scrollToTarget(v);
});

/* ========= Upload ========= */
let nextCharCode = 'C'.charCodeAt(0);
function ensureControls(parent){
  let c=parent.querySelector(".slot-controls");
  if(!c){ c=document.createElement("span"); c.className="slot-controls"; parent.appendChild(c); }
  return c;
}
function addImageToLayer(img,input){
  const old=nodeByInput.get(input);
  if(old){ if(old.konvaImage) old.konvaImage.destroy(); if(old.tr) old.tr.destroy(); }
  const prev=old?.opacityPct ?? 100;
  const scale=STAGE_H/img.height;
  const kimg=new Konva.Image({image:img,x:10,y:0,scaleX:scale,scaleY:scale,opacity:prev/100,draggable:true});
  const tr=new Konva.Transformer({nodes:[kimg]});
  contentGroup.add(kimg); contentGroup.add(tr); contentLayer.draw();

  const parent=input.parentNode, controls=ensureControls(parent);
  let del=controls.querySelector(".delete-btn");
  if(!del){
    del=document.createElement("button"); del.textContent="Delete"; del.className="delete-btn";
    del.onclick=()=>{ kimg.destroy(); tr.destroy(); contentLayer.draw(); input.value=""; nodeByInput.set(input,{konvaImage:null,tr:null,opacityPct:100}); };
    controls.appendChild(del);
  }
  let wrap=controls.querySelector(".opacity-wrapper"), slider,label;
  if(!wrap){
    wrap=document.createElement("span"); wrap.className="opacity-wrapper"; wrap.style.marginLeft='8px';
    const t=document.createElement("span"); t.textContent="Opacity";
    slider=document.createElement("input"); slider.type="range"; slider.min="0"; slider.max="100"; slider.step="1"; slider.className="opacity-slider"; slider.style.width='120px';
    label=document.createElement("span"); label.className="opacity-label";
    wrap.appendChild(t); wrap.appendChild(slider); wrap.appendChild(label); controls.appendChild(wrap);
  } else { slider=wrap.querySelector(".opacity-slider"); label=wrap.querySelector(".opacity-label"); }
  slider.value=String(prev); label.textContent=`${prev}%`;
  slider.oninput=()=>{ const pct=Number(slider.value); kimg.opacity(pct/100); label.textContent=`${pct}%`; contentLayer.batchDraw(); nodeByInput.set(input,{konvaImage:kimg,tr,opacityPct:pct}); };
  nodeByInput.set(input,{konvaImage:kimg,tr,opacityPct:prev});
}
function handleUpload(input){
  if(input.files.length===0) return;
  const file=input.files[0];
  if(file.type==="application/pdf"){
    const url=URL.createObjectURL(file); const task=pdfjsLib.getDocument(url);
    task.promise.then(pdf=>pdf.getPage(1)).then(page=>{
      const vp=page.getViewport({scale:2}); const c=document.createElement("canvas"); const ctx=c.getContext("2d");
      c.width=vp.width; c.height=vp.height;
      return page.render({canvasContext:ctx,viewport:vp}).promise.then(()=>{
        const img=new Image(); img.onload=()=>{ addImageToLayer(img,input); URL.revokeObjectURL(url); };
        img.src=c.toDataURL();
      });
    }).catch(err=>console.error("PDF error:",err));
  } else {
    const r=new FileReader(); r.onload=e=>{ const img=new Image(); img.onload=()=>addImageToLayer(img,input); img.src=e.target.result; };
    r.readAsDataURL(file);
  }
  if(!input.dataset.next){
    const next=String.fromCharCode(nextCharCode++);
    const lbl=document.createElement("label");
    lbl.innerHTML=`Upload Image ${next}: <input type="file" accept="image/*,.pdf" onchange="handleUpload(this)">`;
    uploadsDiv.appendChild(lbl); input.dataset.next="true";
  }
}
window.handleUpload = handleUpload;

/* ========= Init ========= */
function init(){
  originSel.value = 'Top-Left';
  originSel.dispatchEvent(new Event('change'));
  userRulerScale = 1;
  layoutStage();
  drawGrid();
  applyPageScale(1);  // langsung 100%
  viewport.scrollTo({ left: 0, top: 0 });
}
window.addEventListener('DOMContentLoaded', init);
