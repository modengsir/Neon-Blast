// Original offline synth loop: A minor / F / C / G, 112 BPM.
// Created only after a user gesture; no audio files or network requests.
export class ArcadeMusic {
  constructor(){this.enabled=true;this.playing=false;this.revision=0;this.offset=0;this.effects=new Set();this.lastEffect=new Map();this.effectBuffers=new Map();}
  create(){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return false;
    this.context=new AudioContext();
    this.output=this.context.createGain();this.output.gain.value=.32;
    this.limiter=this.context.createDynamicsCompressor();
    this.limiter.threshold.value=-16;this.limiter.ratio.value=8;
    this.limiter.connect(this.context.destination);
    this.output.connect(this.limiter);
    const rate=this.context.sampleRate,beat=60/112,length=beat*32;
    this.buffer=this.context.createBuffer(1,Math.ceil(length*rate),rate);
    const data=this.buffer.getChannelData(0);
    const note=(midi,start,duration,volume,type)=>{
      const frequency=440*2**((midi-69)/12),begin=Math.floor(start*rate),count=Math.floor(duration*rate);
      for(let i=0;i<count&&begin+i<data.length;i++){
        const t=i/rate,phase=2*Math.PI*frequency*t;
        const envelope=Math.min(t/.009,1)*Math.max(0,1-t/duration)**2;
        const wave=type==='bass'?Math.sin(phase)+.22*Math.sin(phase*2):Math.sin(phase)+.25*Math.sin(phase*2)+.12*Math.sin(phase*3);
        data[begin+i]+=wave*envelope*volume;
      }
    };
    const chords=[[45,57,60,64],[41,57,60,65],[48,55,60,64],[43,55,59,62]];
    for(let b=0;b<32;b++){
      const chord=chords[Math.floor(b/8)],time=b*beat;
      note(chord[0],time,beat*.7,.25,'bass');
      for(let half=0;half<2;half++)note(chord[1+(b*2+half)%3]+12,time+half*beat/2,beat*.42,.105,'lead');
      // Soft kick and a short, quiet high-frequency tick.
      const begin=Math.floor(time*rate);
      for(let i=0;i<rate*.15&&begin+i<data.length;i++){
        const t=i/rate;data[begin+i]+=Math.sin(2*Math.PI*(48*t+70*.025*(1-Math.exp(-t/.025))))*Math.min(t/.003,1)*Math.exp(-t*32)*.28;
      }
      note(102,time+beat/2,.045,.035,'lead');
    }
    return true;
  }
  async update(playing=this.playing){
    this.playing=playing;const revision=++this.revision;
    if(!this.enabled||!playing){
      if(this.source){this.offset=(this.offset+this.context.currentTime-this.started)%this.buffer.duration;this.source.stop();this.source.disconnect();this.source=null;}
      return;
    }
    try{
      if(!this.context&&!this.create())return;
      await this.context.resume();
      if(revision!==this.revision||!this.playing||!this.enabled||this.source)return;
      this.source=this.context.createBufferSource();this.source.buffer=this.buffer;this.source.loop=true;
      this.source.connect(this.output);this.started=this.context.currentTime;
      this.source.start(0,this.offset);
    }catch(error){console.warn('背景音乐暂不可用',error);}
  }
  stopEffects(){for(const source of this.effects){source.stop();source.disconnect();}this.effects.clear();}
  effect(kind){
    if(!this.enabled)return;
    try{
      if(!this.context&&!this.create())return;
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
      const now=this.context.currentTime;
      // Coalesce simultaneous chain explosions; avoid overwhelming the mix.
      if(now-(this.lastEffect.get(kind)??-10)<(kind==='blast'?.08:.045))return;
      this.lastEffect.set(kind,now);
      let buffer=this.effectBuffers.get(kind);
      if(!buffer){
        const durations={step:.075,enemyStep:.055,place:.16,tick:.065,urgent:.08,blast:.65,crate:.22,enemy:.4,won:1.2,lost:.85,start:.4,click:.065,exit:.6,warning:.16};
        const duration=durations[kind]??.1,rate=this.context.sampleRate;
        buffer=this.context.createBuffer(1,Math.ceil(duration*rate),rate);
        const data=buffer.getChannelData(0);let phase=0,filteredNoise=0;
        for(let i=0;i<data.length;i++){
          const t=i/rate,u=t/duration,noise=Math.random()*2-1;
          let frequency=440,volume=.12,wave=0;
          const decay=Math.min(t/.004,1)*(1-u)**2;
          if(kind==='blast'){
            filteredNoise=filteredNoise*.86+noise*.14;
            frequency=38+110*Math.exp(-t*22);phase+=2*Math.PI*frequency/rate;
            wave=(filteredNoise*2+Math.sin(phase)*.65)*.65;
          }else if(kind==='crate')wave=noise*.26*(.4+.6*Math.abs(Math.sin(t*95)));
          else{
            switch(kind){
              case 'step':frequency=180-90*u;volume=.12;break;
              case 'enemyStep':frequency=100-40*u;volume=.025;break;
              case 'place':frequency=500-350*u;volume=.22;break;
              case 'tick':frequency=920;volume=.085;break;
              case 'urgent':frequency=1350;volume=.1;break;
              case 'enemy':frequency=800*(1-u)+70;volume=.2;break;
              case 'won':frequency=[523,659,784,1047][Math.min(3,Math.floor(t/.19))];volume=.2;break;
              case 'lost':frequency=[392,311,233,130][Math.min(3,Math.floor(t/.17))];volume=.2;break;
              case 'start':frequency=[392,523,784][Math.min(2,Math.floor(t/.1))];volume=.14;break;
              case 'exit':frequency=[659,784,1047][Math.min(2,Math.floor(t/.15))];volume=.14;break;
              case 'warning':frequency=740;volume=.1;break;
              default:frequency=650-220*u;volume=.08;
            }
            phase+=2*Math.PI*frequency/rate;
            wave=(Math.sin(phase)+.2*Math.sin(phase*3))*volume;
          }
          data[i]=wave*decay;
        }
        this.effectBuffers.set(kind,buffer);
      }
      const source=this.context.createBufferSource();source.buffer=buffer;
      source.connect(this.limiter);this.effects.add(source);
      source.onended=()=>{this.effects.delete(source);source.disconnect();};source.start();
    }catch(error){console.warn('音效暂不可用',error);}
  }
  toggle(){this.enabled=!this.enabled;if(!this.enabled)this.stopEffects();this.update();return this.enabled;}
}
