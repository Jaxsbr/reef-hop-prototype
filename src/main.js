import Phaser from 'phaser';
import { OceanAudio } from './audio';
import { ACTOR_ANIMATIONS } from './animation/actors.js';
import { attachFrameLoop } from './animation/phaser-frame-loop.js';
import { SharkMouth } from './animation/shark-mouth.js';
import { createSharkRenderer } from './animation/shark-renderer.js';
import shark from '../assets/shark/shark-swim-mouth.json' with { type: 'json' };
const audio=new OceanAudio();
let selectedFish="fish_orange";
const W=960,H=520,YS=[105,215,325,435],PX=190;
class Reef extends Phaser.Scene {
 preload(){for(const k of ['seaweed_green_b','seaweed_green_c','seaweed_pink_a','fish_blue','fish_pink','fish_green','fish_orange','fish_grey_long_a','rock_a','seaweed_green_a','bubble_a'])this.load.image(k,`${import.meta.env.BASE_URL}assets/${k}.png`);
  this.load.spritesheet('shark-swim-mouth',`${import.meta.env.BASE_URL}assets/shark-swim-mouth-sheet.png`,{frameWidth:shark.frameWidth,frameHeight:shark.frameHeight,endFrame:15});
  for(const config of Object.values(ACTOR_ANIMATIONS))this.load.spritesheet(config.texture,config.image,config.sheet);
 }
 create(){
  this.lane=2;this.running=false;this.over=false;this.distance=0;this.spawnClock=0;this.wave=0;this.airUntil=0;this.obstacles=[];this.jump=null;this.turnTilt=0;
  const bg=this.add.graphics().setDepth(0);
  bg.fillStyle(0xabe5f1);bg.fillRect(0,50,W, H-50);
  // Soft bands preserve lane depth cues without hard boundaries.
  const water=this.textures.createCanvas('water-depth-'+this.sys.settings.key+'-'+Date.now(),W,H-150);
  const ctx=water.context,gradient=ctx.createLinearGradient(0,0,0,H-150);
  for(const [stop,color] of [[0,'#2eafbf'],[.23,'#2eafbf'],[.34,'#188399'],[.55,'#188399'],[.66,'#115776'],[.92,'#115776'],[1,'#083447']])gradient.addColorStop(stop,color);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H-150);water.refresh();
  this.waterFill=this.add.image(0,150,water.key).setOrigin(0).setDepth(.1);
  this.waterMask=this.make.graphics({x:0,y:0},false);
  this.waterFill.setMask(this.waterMask.createGeometryMask());

  this.scenery=[];
  this.createDistantReef();
  this.createSeabed();
  let grassX=-30;const grasses=['seaweed_green_a','seaweed_green_b','seaweed_green_c','seaweed_pink_a'];
  while(grassX<W+100){const height=Phaser.Math.Between(32,78),width=Phaser.Math.Between(25,53);this.scenery.push({object:this.add.image(grassX,503,Phaser.Utils.Array.GetRandom(grasses)).setOrigin(.5,1).setDisplaySize(width,height).setFlipX(Math.random()>.5).setAlpha(Phaser.Math.FloatBetween(.45,.8)),rate:1,kind:'grass'});grassX+=Phaser.Math.Between(38,110);}

  let cloudX=30;
  for(let i=0;i<5;i++){const cloud=this.add.container(cloudX,Phaser.Math.Between(70,90));const g=this.add.graphics();cloud.add(g);g.fillStyle(0xe7f3f7,.65);g.fillEllipse(0,8,95,18);g.fillStyle(0xffffff,.88);g.fillEllipse(-25,2,43,23);g.fillEllipse(0,-7,49,37);g.fillEllipse(27,1,40,26);g.fillEllipse(7,8,87,20);cloud.setScale(Phaser.Math.FloatBetween(.65,1.35),Phaser.Math.FloatBetween(.65,1.05));this.scenery.push({object:cloud,rate:Phaser.Math.FloatBetween(.12,.25),kind:'cloud'});cloudX+=Phaser.Math.Between(150,255);}
  this.surface=this.add.graphics().setDepth(4);
  this.drawWaterSurface();
  this.events.once('shutdown',()=>{this.waterFill.clearMask(true);this.waterMask.destroy();this.textures.remove(water.key);});

  this.bubbles=Array.from({length:22},()=>this.add.image(Phaser.Math.Between(0,W),Phaser.Math.Between(170,490),'bubble_a').setDisplaySize(14,14).setAlpha(.3));
  for(const item of this.scenery)if(item.kind!=='sand')item.object.setDepth(3);
  this.swimPosition={y:YS[this.lane]};
  this.player=this.add.image(PX,YS[this.lane],selectedFish).setDisplaySize(70,70).setDepth(6);
  const animation=ACTOR_ANIMATIONS[selectedFish];
  this.playerAnimation=animation?attachFrameLoop(this.player,animation):null;
  this.events.once('shutdown',()=>{this.playerAnimation?.dispose();this.playerAnimation=null;for(const o of this.obstacles)o.animation?.dispose();});
  this.hud=this.add.text(22,15,'Distance 0 m',{fontSize:'22px',fontFamily:'sans-serif',color:'#ffffff'}).setDepth(8);
  this.input.keyboard.on('keydown-UP',e=>{e.preventDefault();if(!e.repeat)this.move(-1)});this.input.keyboard.on('keydown-DOWN',e=>{e.preventDefault();if(!e.repeat)this.move(1)});this.input.keyboard.on('keydown-SPACE',e=>{e.preventDefault();if(this.over)this.scene.restart()});
  window.reefScene=this;
 }
 createSeabed(){
  // Repeatable foreground sand sections with an irregular upper edge.
  for(let i=0;i<4;i++){
   const sand=this.add.graphics().setPosition(i*320,0).setDepth(2.8);
   sand.fillStyle(0x9d9871);sand.beginPath();sand.moveTo(0,499);
   for(let x=0;x<=320;x+=16)sand.lineTo(x,497+Math.sin(x/41+i)*3);sand.lineTo(320,H);sand.lineTo(0,H);sand.closePath();sand.fillPath();
   for(let j=0;j<34;j++){sand.fillStyle(j%2?0xc1b891:0x797d66,.55);sand.fillCircle(Phaser.Math.Between(0,320),Phaser.Math.Between(504,519),Phaser.Math.FloatBetween(.6,1.4));}
   for(let j=0;j<3;j++){const x=Phaser.Math.Between(20,300),y=Phaser.Math.Between(500,507),w=Phaser.Math.Between(10,27);sand.fillStyle(0x596d70);sand.fillEllipse(x,y,w,Phaser.Math.Between(7,14));sand.fillStyle(0x879494,.65);sand.fillEllipse(x-2,y-3,w*.65,4);}
   this.scenery.push({object:sand,rate:1,kind:'sand'});
  }
 }
 drawWaterSurface(){
  const points=[];for(let x=0;x<=W;x+=8)points.push({x,y:160+Math.sin((x+this.distance*20)/36)*3});
  this.waterMask.clear();this.waterMask.fillStyle(0xffffff);this.waterMask.beginPath();this.waterMask.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))this.waterMask.lineTo(p.x,p.y);this.waterMask.lineTo(W,H);this.waterMask.lineTo(0,H);this.waterMask.closePath();this.waterMask.fillPath();
  this.surface.clear();this.surface.lineStyle(3,0xc8fffa,.8);this.surface.beginPath();this.surface.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))this.surface.lineTo(p.x,p.y);this.surface.strokePath();
 }
 createDistantReef(){
  // Decorative silhouettes only: never included in the obstacle collision list.
  this.distantPlants=[];
  for(let i=0;i<9;i++){
   const plant=this.add.graphics().setPosition(i*145+Phaser.Math.Between(-40,40),493).setDepth(1).setAlpha(.23);
   const tall=i%3!==0,height=Phaser.Math.Between(tall?190:85,tall?315:170);
   const color=tall?0x84b8b1:Phaser.Utils.Array.GetRandom([0xa9a0bf,0x86bcb7,0xb5a6b7]);
   if(tall){
    for(let blade=0;blade<7;blade++){
     const base=Phaser.Math.Between(-35,35),h=height*Phaser.Math.FloatBetween(.55,1),bend=Phaser.Math.Between(-45,45);
     plant.lineStyle(Phaser.Math.Between(4,8),color,1);plant.beginPath();
     for(let step=0;step<=25;step++){const p=step/25,x=base+bend*p+Math.sin(p*7+blade)*14*p,y=-h*p;if(!step)plant.moveTo(x,y);else plant.lineTo(x,y);}plant.strokePath();
    }
   }else{
    const branch=(x,y,length,angle,level)=>{
     const nx=x+Math.cos(angle)*length,ny=y+Math.sin(angle)*length;
     plant.lineStyle(2+level*2,color,1);plant.lineBetween(x,y,nx,ny);plant.fillStyle(color);plant.fillCircle(nx,ny,2+level);
     if(level>0){branch(nx,ny,length*.66,angle-Phaser.Math.FloatBetween(.35,.75),level-1);branch(nx,ny,length*.7,angle+Phaser.Math.FloatBetween(.35,.8),level-1);}
    };
    branch(0,0,height*.42,-Math.PI/2,3);branch(0,-15,height*.4,-2.3,2);branch(0,-12,height*.4,-.8,2);
   }
   this.distantPlants.push({object:plant,rate:Phaser.Math.FloatBetween(.13,.2),phase:Math.random()*6});
  }
  this.backgroundFish=Array.from({length:12},(_,i)=>{
   const size=Phaser.Math.Between(28,43),object=this.add.image(Phaser.Math.Between(0,W),0,Phaser.Utils.Array.GetRandom(['fish_blue','fish_green','fish_pink'])).setDisplaySize(size,size).setTint(0xa2bfc5).setAlpha(.32).setDepth(2);
   return {object,baseX:object.x,baseY:Phaser.Math.Between(220,435),phase:Math.random()*Math.PI*2,period:Phaser.Math.FloatBetween(2.3,4.5),arc:Phaser.Math.Between(13,30),roam:Phaser.Math.Between(20,48)};
  });
 }
 updateDistantReef(t,dt,speed){
  for(const plant of this.distantPlants){plant.object.x-=speed*dt*plant.rate;plant.object.rotation=Math.sin(t/2300+plant.phase)*.018;if(plant.object.x< -170)plant.object.x=W+Phaser.Math.Between(100,240);}
  for(const fish of this.backgroundFish){
   fish.baseX-=speed*dt*.34;if(fish.baseX< -100)fish.baseX=W+Phaser.Math.Between(70,180);
   const phase=t/(fish.period*1000)+fish.phase;
   fish.object.x=fish.baseX+Math.sin(phase)*fish.roam;
   fish.object.y=fish.baseY+Math.sin(phase*1.7)*fish.arc;
   fish.object.setFlipX(Math.cos(phase)<0).setAngle(Math.cos(phase*1.7)*7);
  }
 }
 splash(){audio.splash();for(let i=0;i<10;i++){const drop=this.add.circle(this.player.x+Phaser.Math.Between(-12,12),160,Phaser.Math.Between(2,4),0xd8ffff,.9);this.tweens.add({targets:drop,x:drop.x+Phaser.Math.Between(-38,38),y:Phaser.Math.Between(130,154),alpha:0,duration:400,onComplete:()=>drop.destroy()});}}
 move(dir){if(this.over)return;audio.start();if(!this.running){this.running=true}
  if(this.jump)return;
  const next=Phaser.Math.Clamp(this.lane+dir,0,3);if(next===this.lane)return;
  this.tweens.killTweensOf(this.swimPosition);
  if(next===0){this.lane=0;this.jump={start:this.time.now,duration:780,from:this.player.y};this.splash();return;}
  this.lane=next;this.tweens.add({targets:this.swimPosition,y:YS[next],duration:140,ease:'Cubic.Out'});
  this.turnTilt=dir*-14;this.tweens.add({targets:this,turnTilt:0,duration:200});
 }
 spawn(){const patterns=[[2],[1],[3],[1,3],[2,3],[1,2]];const lanes=patterns[this.wave%patterns.length];this.wave++;
  for(const lane of lanes)this.addHazard(lane,(this.wave+lane)%3===0?'shark':'rubbish',W+55);
  if(this.wave%2===0)this.addHazard(0,'bird',W+150);
 }
 addHazard(lane,key,x){
 const sprite=this.add.container(x,YS[lane]).setDepth(6);const g=this.add.graphics();sprite.add(g);
 if(key==='bird'){
  g.fillStyle(0xf6f3de);g.fillEllipse(0,5,44,22);g.fillCircle(-19,0,12);g.fillStyle(0xf4b84b);g.fillTriangle(-28,-3,-43,4,-28,7);g.fillStyle(0x263d52);g.fillCircle(-23,-3,2);
  const wings=this.add.graphics();wings.fillStyle(0xffffff);wings.fillTriangle(0,6,25,-28,13,13);wings.fillTriangle(0,6,-10,-26,-14,7);sprite.add(wings);this.tweens.add({targets:wings,scaleY:.35,duration:240,yoyo:true,repeat:-1});
 }else if(key==='shark'){
  g.destroy();
  const body=createSharkRenderer(this,shark);sprite.add(body);
  sprite.setData('sharkBody',body);
 }else{
  const trash=Phaser.Utils.Array.GetRandom(['bottle','can','bag','cup','boot']);
  sprite.setData('trashType',trash);
  if(trash==='bottle'){
   g.fillStyle(0xdaf3ed,.88);g.fillRoundedRect(-16,-24,32,51,8);g.fillRect(-8,-33,16,15);g.fillStyle(0xf49c74);g.fillRoundedRect(-9,-39,18,8,2);g.fillStyle(0x519aaa);g.fillRect(-16,-4,32,15);g.lineStyle(2,0xffffff,.8);g.lineBetween(-9,-17,-9,-7);
  }else if(trash==='can'){
   g.fillStyle(0xbdcbd0);g.fillRoundedRect(-19,-27,38,54,5);g.fillStyle(0xf18d71);g.fillRect(-19,-17,38,34);g.fillStyle(0xe1ebed);g.fillEllipse(0,-25,37,9);g.lineStyle(3,0x637a84);g.strokeEllipse(2,-25,12,4);g.lineStyle(2,0xffd9b4);g.lineBetween(-10,-8,9,8);
  }else if(trash==='bag'){
   g.fillStyle(0xe4dbc2,.85);g.fillPoints([{x:-24,y:-17},{x:-17,y:-34},{x:-8,y:-34},{x:-10,y:-17},{x:10,y:-17},{x:8,y:-34},{x:17,y:-34},{x:24,y:-17},{x:28,y:26},{x:2,y:32},{x:-26,y:23}],true);g.lineStyle(2,0xb5b8a8);g.lineBetween(-14,-6,-9,19);g.lineBetween(13,-4,18,23);
  }else if(trash==='cup'){
   g.fillStyle(0xd4a786);g.fillPoints([{x:-23,y:-22},{x:23,y:-22},{x:15,y:28},{x:-15,y:28}],true);g.fillStyle(0xf7e5ce);g.fillRoundedRect(-27,-28,54,9,3);g.lineStyle(4,0xeab275);g.lineBetween(8,-27,15,-43);g.fillStyle(0xf5d6a5);g.fillEllipse(0,4,20,16);
  }else{
   g.fillStyle(0x89758f);g.fillRoundedRect(-16,-30,30,46,4);g.fillRoundedRect(-17,7,53,23,8);g.fillStyle(0x4e5668);g.fillRoundedRect(-18,25,56,7,3);g.lineStyle(2,0xb8a3bb);g.lineBetween(-8,-20,7,-20);g.lineBetween(-7,-11,7,-11);
  }

 }
 const warning=this.add.text(W-35,YS[lane],'!',{fontSize:'26px',fontStyle:'bold',color:'#ffe5a4'}).setOrigin(.5).setDepth(7);this.obstacles.push({sprite,warning,lane,key,animation:key==='shark'?new SharkMouth(shark):null,phase:Math.random()*6,wake:0,disturbed:false});}
 update(t,delta){const dt=Math.min(delta,40)/1000;for(const b of this.bubbles){b.y-=dt*18;b.x-=dt*12;if(b.y<170)b.y=490;if(b.x<0)b.x=W}
 if(!this.over){ const swimPhase=t/430;
 this.player.y=this.swimPosition.y+Math.sin(swimPhase)*9;
 this.player.x=PX+Math.sin(swimPhase*.5)*3;
 this.player.setAngle(Math.cos(swimPhase)*4+(this.turnTilt||0));
 if(this.playerAnimation)this.playerAnimation.update(delta);
 else this.player.setDisplaySize(70+Math.sin(t/105)*3,70-Math.sin(t/105)*2);
 if(this.jump){const p=Phaser.Math.Clamp((t-this.jump.start)/this.jump.duration,0,1);this.player.y=Phaser.Math.Linear(this.jump.from,YS[1],p)-130*4*p*(1-p);this.player.x=PX+Math.sin(Math.PI*p)*24;this.player.setAngle(-38+76*p);if(p>=1){this.jump=null;this.lane=1;this.swimPosition.y=YS[1];this.splash();}}

}
 this.updateDistantReef(t,dt,this.running&&!this.over?165+this.distance*.16:0);
 if(!this.running||this.over)return;
 const speed=165+this.distance*.16;
 for(const item of this.scenery){item.object.x-=speed*dt*item.rate;if(item.kind==='sand'){if(item.object.x< -320)item.object.x+=1280;continue;}if(item.object.x< -100){item.object.x=W+Phaser.Math.Between(50,170);if(item.kind==='grass')item.object.setTexture(Phaser.Utils.Array.GetRandom(['seaweed_green_a','seaweed_green_b','seaweed_green_c','seaweed_pink_a']));}}
 for(const bubble of this.bubbles){bubble.x-=speed*dt*.65;if(bubble.x<0)bubble.x=W;}
 this.drawWaterSurface();this.distance+=dt*speed/20;this.hud.setText(`Distance ${Math.floor(this.distance)} m`);this.spawnClock+=dt;
 if(this.spawnClock>Math.max(.8,1.85*165/speed)){this.spawnClock=0;this.spawn()}
 for(const o of this.obstacles){o.sprite.x-=speed*dt*(o.key==='bird'?1.28:o.key==='shark'?1.12:1);if(o.animation){const state=o.animation.update(delta,o.sprite,this.player);o.sprite.getData('sharkBody').renderPose(state);}
  if(o.key==='rubbish'){
   if(!o.disturbed&&o.sprite.x<this.player.x&&Math.abs(YS[o.lane]-this.player.y)<140){o.disturbed=true;o.wake=1;}
   o.wake=Math.max(0,o.wake-dt*.7);
   const phase=t/900+o.phase,burst=t/100+o.phase;
   o.sprite.y=YS[o.lane]+Math.sin(phase)*6+Math.sin(burst)*18*o.wake;
   o.sprite.angle=Math.sin(phase*.7)*12+Math.sin(burst*.8)*38*o.wake;
  }
  o.warning.setVisible(o.sprite.x>W-100);if(o.key==='bird'&&!o.called&&o.sprite.x<W){o.called=true;audio.bird();}if(Math.abs(o.sprite.x-this.player.x)<44&&Math.abs(o.sprite.y-this.player.y)<37){this.finish();break}}
 this.obstacles=this.obstacles.filter(o=>{if(o.sprite.x< -80){o.animation?.dispose();o.sprite.destroy();o.warning.destroy();return false}return true});
 }
 finish(){for(const o of this.obstacles)o.animation?.dispose();audio.lost();this.over=true;this.playerAnimation?.dispose();this.cameras.main.shake(180,.008);this.player.setTint(0xffa6a6);this.cameras.main.flash(180,255,120,100)}
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#092e49',scene:Reef,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,expandParent:false}});
// Include layout changes (wrapped controls, mobile browser chrome, safe areas),
// as well as window resizing, without changing world coordinates or the run.
const gameResizeObserver=new ResizeObserver(()=>game.scale.refresh());
gameResizeObserver.observe(document.getElementById('game'));
game.events.once('destroy',()=>gameResizeObserver.disconnect());
for(const [id,dir] of [['up',-1],['down',1]])document.getElementById(id).addEventListener('click',()=>game.scene.getScenes(true)[0]?.move(dir));
document.getElementById('restart').addEventListener('click',()=>game.scene.getScenes(true)[0]?.scene.restart());

for(const button of document.querySelectorAll('[data-fish]'))button.addEventListener('click',()=>{
 selectedFish=`fish_${button.dataset.fish}`;
 for(const other of document.querySelectorAll('[data-fish]'))other.setAttribute('aria-pressed',String(other===button));
 game.scene.getScenes(true)[0]?.scene.restart();
});
