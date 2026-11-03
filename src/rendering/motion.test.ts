import {expect,it} from 'vitest';
import {MotionTrack} from './motion';
it('moves continuously along corners, pauses and reaches the exact endpoint',()=>{
 const m=new MotionTrack({x:0,y:0});m.retarget([{x:1,y:0},{x:1,y:1}],1);
 expect(m.advance(.25)).toEqual({x:.5,y:0});expect(m.advance(5,true)).toEqual({x:.5,y:0});
 expect(m.advance(.5)).toEqual({x:1,y:.5});expect(m.advance(.25)).toEqual({x:1,y:1});expect(m.moving).toBe(false);
});
it('retargeting preserves the displayed position and frame partitioning preserves distance',()=>{
 const a=new MotionTrack({x:0,y:0}),b=new MotionTrack({x:0,y:0});
 for(const m of [a,b]){m.retarget([{x:1,y:0}],1);m.advance(.25);m.retarget([{x:2,y:0}],1);expect(m.position.x).toBe(.25);}
 a.advance(.5);for(let i=0;i<30;i++)b.advance(1/60);expect(a.position.x).toBeCloseTo(b.position.x);
});
