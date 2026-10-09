// Synthesized ocean/effects with the approved CC0 gull recording.
const BIRD_SOUND_URL=new URL('../assets/audio/gull-call.wav',import.meta.url).href;
export class OceanAudio {
 constructor(){this.muted=false;this.started=false;}
 start(){
  if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.22;this.master.connect(this.ctx.destination);this.birdReady=this.loadBird();}
  this.ctx.resume();if(this.started)return;this.started=true;
  const c=this.ctx,buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);let last=0;
  for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.025)/1.025;data[i]=last;}
  const sea=c.createBufferSource();sea.buffer=buffer;sea.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;const gain=c.createGain();gain.gain.value=.36;sea.connect(filter).connect(gain).connect(this.master);sea.start();
  for(const f of [130.81,196,261.63]){const osc=c.createOscillator(),g=c.createGain();osc.type='sine';osc.frequency.value=f;g.gain.value=.018;osc.connect(g).connect(this.master);osc.start();}
 }
 toggle(){this.muted=!this.muted;if(this.master)this.master.gain.setTargetAtTime(this.muted?0:.22,this.ctx.currentTime,.08);return this.muted;}
 tone(freq,end,duration,delay=0,volume=.35){if(!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(this.master);o.start(t);o.stop(t+duration+.02);}
 splash(){if(!this.ctx)return;const c=this.ctx,buf=c.createBuffer(1,c.sampleRate*.32,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buf;f.type='bandpass';f.frequency.value=1300;g.gain.value=.55;s.connect(f).connect(g).connect(this.master);s.start();this.tone(230,75,.24,0,.2);}
 async loadBird(){
  try{
   const response=await fetch(BIRD_SOUND_URL);
   if(!response.ok)throw new Error(`Gull recording: HTTP ${response.status}`);
   this.birdBuffer=await this.ctx.decodeAudioData(await response.arrayBuffer());
  }catch(error){console.warn('Could not load the gull recording.',error);}
 }
 bird(){
  if(!this.ctx||!this.birdBuffer||this.muted)return;
  // Independent sources preserve each bird's choice even in staggered spawn groups.
  const source=this.ctx.createBufferSource();source.buffer=this.birdBuffer;
  source.connect(this.master);source.onended=()=>source.disconnect();source.start();
 }
 lost(){this.tone(160,45,.18,0,.6);[392,329.63,261.63,196].forEach((f,i)=>this.tone(f,f*.95,.25,.22+i*.19,.28));}
}
