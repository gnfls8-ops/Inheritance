/** Synthesized ambience. Independent from the simulation RNG and loaded only after a gesture. */
export class WorldAudio {
 private context:AudioContext|null=null;
 private gain:GainNode|null=null;
 private ambient:GainNode|null=null;
 private source:AudioBufferSourceNode|null=null;
 async enable(){
  if(!this.context){
   const c=this.context=new AudioContext(),master=this.gain=c.createGain(),ambient=this.ambient=c.createGain();
   master.gain.value=.35;ambient.gain.value=0;ambient.connect(master);master.connect(c.destination);
   const buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),samples=buffer.getChannelData(0);
   let low=0;for(let i=0;i<samples.length;i++){low=(low+.018*(Math.random()*2-1))/1.018;samples[i]=low*6;}
   const source=this.source=c.createBufferSource();source.buffer=buffer;source.loop=true;
   const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1500;source.connect(filter);filter.connect(ambient);source.start();
  }
  await this.context.resume();
 }
 setPlaying(playing:boolean){if(this.context&&this.ambient)this.ambient.gain.setTargetAtTime(playing?.32:0,this.context.currentTime,.3);}
 async disable(){if(this.context)await this.context.suspend();}
 cue(important=false){
  if(!this.context||this.context.state!=='running'||!this.gain)return;
  const c=this.context,start=c.currentTime;
  for(const [i,freq] of (important?[392,523.25,659.25]:[440,554.37]).entries()){
   const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=freq;
   g.gain.setValueAtTime(0,start+i*.12);g.gain.linearRampToValueAtTime(.09,start+i*.12+.015);g.gain.exponentialRampToValueAtTime(.001,start+i*.12+.65);
   o.connect(g);g.connect(this.gain);o.start(start+i*.12);o.stop(start+i*.12+.7);o.onended=()=>{o.disconnect();g.disconnect();};
  }
 }
 destroy(){this.source?.stop();void this.context?.close();this.context=null;this.gain=null;this.ambient=null;this.source=null;}
}
