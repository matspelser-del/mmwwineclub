'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { shortDate } from '@/lib/format';

const STATUSES = ['planning','confirmed','packing','shipped','done'];
const statusTone = { planning:'grey', confirmed:'blue', packing:'amber', shipped:'amber', done:'green' };

export default function Boxes(){
  const [token,setToken]=useState(null);
  const [boxes,setBoxes]=useState([]);
  const [timeline,setTimeline]=useState([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(null);         // box id expanded
  const [nt,setNt]=useState({});               // new timeline inputs per box

  async function load(){
    const { data:s }=await supabase.auth.getSession(); const t=s.session?.access_token; setToken(t);
    const res=await fetch('/api/admin/boxes',{headers:{Authorization:`Bearer ${t}`}});
    const j=await res.json();
    setBoxes(j.boxes||[]); setTimeline(j.timeline||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function patchBox(id,patch){
    await fetch('/api/admin/boxes',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,...patch})});
    setBoxes(bs=>bs.map(b=>b.id===id?{...b,...patch}:b));
  }
  async function addMilestone(boxId){
    const v=nt[boxId]||{}; if(!v.title) return;
    const res=await fetch('/api/admin/box-timeline',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({box_id:boxId,title:v.title,due_date:v.due_date||null})});
    const j=await res.json(); setTimeline(t=>[...t,j.item]); setNt(n=>({...n,[boxId]:{}}));
  }
  async function toggleMilestone(m){
    await fetch('/api/admin/box-timeline',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:m.id,done:!m.done})});
    setTimeline(t=>t.map(x=>x.id===m.id?{...x,done:!m.done}:x));
  }
  async function delMilestone(id){
    await fetch(`/api/admin/box-timeline?id=${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    setTimeline(t=>t.filter(x=>x.id!==id));
  }

  if(loading) return <div className="head"><p className="empty">Loading…</p></div>;

  return (
    <>
      <div className="head"><h1>Boxes & Events</h1><p>The release schedule and what has to happen before each one goes out.</p></div>
      <div className="boxgrid">
        {boxes.map(b=>{
          const mine=timeline.filter(t=>t.box_id===b.id);
          const done=mine.filter(m=>m.done).length;
          const isOpen=open===b.id;
          return (
            <div className="boxcard" key={b.id}>
              <div className="boxcard-top" onClick={()=>setOpen(isOpen?null:b.id)}>
                <div>
                  <div className="boxcard-label">{b.label}</div>
                  <div className="sub">{b.release_date?`Release ${shortDate(b.release_date)}`:'No date set'}{mine.length?` · ${done}/${mine.length} steps done`:''}</div>
                </div>
                <span className={`badge ${statusTone[b.status]||'grey'}`}><span className="dot"/>{b.status}</span>
              </div>

              {isOpen && (
                <div className="boxcard-body">
                  <div className="r2">
                    <label><span className="field">Status</span>
                      <select className="select" value={b.status} onChange={e=>patchBox(b.id,{status:e.target.value})}>
                        {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                      </select></label>
                    <label><span className="field">Release date</span>
                      <input className="input" type="date" value={b.release_date||''} onChange={e=>patchBox(b.id,{release_date:e.target.value})} /></label>
                  </div>
                  <label style={{display:'block',marginTop:10}}><span className="field">Note shown to members (no spoilers / no prices)</span>
                    <textarea className="input" rows="2" defaultValue={b.member_note||''} onBlur={e=>patchBox(b.id,{member_note:e.target.value})} /></label>

                  <div className="grp">Timeline</div>
                  <div className="timeline">
                    {mine.length===0 && <p className="hint">No steps yet. Add the first one below.</p>}
                    {mine.map(m=>(
                      <div className="tl-row" key={m.id}>
                        <input type="checkbox" checked={m.done} onChange={()=>toggleMilestone(m)} />
                        <span style={{textDecoration:m.done?'line-through':'none',color:m.done?'var(--muted)':'var(--ink)'}}>{m.title}</span>
                        <span className="sub" style={{marginLeft:'auto'}}>{m.due_date?shortDate(m.due_date):''}</span>
                        <button className="x" onClick={()=>delMilestone(m.id)}>×</button>
                      </div>
                    ))}
                  </div>
                  <div className="tl-add">
                    <input className="input" placeholder="Step (e.g. Send email, Finish box, Delivery)" value={(nt[b.id]||{}).title||''} onChange={e=>setNt(n=>({...n,[b.id]:{...(n[b.id]||{}),title:e.target.value}}))} />
                    <input className="input" type="date" value={(nt[b.id]||{}).due_date||''} onChange={e=>setNt(n=>({...n,[b.id]:{...(n[b.id]||{}),due_date:e.target.value}}))} />
                    <button className="btn sm" onClick={()=>addMilestone(b.id)}>Add</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
