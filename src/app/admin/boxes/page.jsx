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
  const [items,setItems]=useState([]);
  const [skips,setSkips]=useState([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(null);         // box id expanded
  const [nt,setNt]=useState({});               // new timeline inputs per box
  const [notifying,setNotifying]=useState(null);
  const [notifyMsg,setNotifyMsg]=useState({}); // per-box result

  async function load(){
    const { data:s }=await supabase.auth.getSession(); const t=s.session?.access_token; setToken(t);
    const res=await fetch('/api/admin/boxes',{headers:{Authorization:`Bearer ${t}`}});
    const j=await res.json();
    setBoxes(j.boxes||[]); setTimeline(j.timeline||[]); setItems(j.items||[]); setSkips(j.skips||[]); setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function patchItem(id,patch){
    setItems(it=>it.map(x=>x.id===id?{...x,...patch}:x));
    await fetch('/api/admin/box-items',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,...patch})});
  }
  async function notifyShipped(boxId){
    if(!window.confirm('Tag every active member so your "Box On Its Way" email sends? Members who skipped this box are left out.')) return;
    setNotifying(boxId);
    const res=await fetch('/api/admin/notify-box',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({box_id:boxId})});
    const j=await res.json().catch(()=>({}));
    setNotifying(null);
    setNotifyMsg(m=>({...m,[boxId]: res.ok ? `Tagged ${j.sent} member${j.sent===1?'':'s'}.${j.failed?.length?` ${j.failed.length} failed.`:''}` : (j.error||'Could not notify')}));
  }

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

  if(loading) return <div className="loader-full" style={{minHeight:'50vh'}}><div className="session-spinner" /></div>;

  return (
    <>
      <div className="head"><h1>Boxes & Events</h1><p>The release schedule and what has to happen before each one goes out.</p></div>
      <div className="boxgrid">
        {boxes.map(b=>{
          const mine=timeline.filter(t=>t.box_id===b.id);
          const done=mine.filter(m=>m.done).length;
          const wines=items.filter(i=>i.box_id===b.id);
          const bottles=wines.filter(w=>w.kind==='wine').reduce((s,w)=>s+Number(w.qty||0),0);
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
                        {STATUSES.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}
                      </select></label>
                    <label><span className="field">Release date</span>
                      <input className="input" type="date" value={b.release_date||''} onChange={e=>patchBox(b.id,{release_date:e.target.value})} /></label>
                  </div>
                  <label style={{display:'block',marginTop:10}}><span className="field">Note shown to members (no spoilers / no prices)</span>
                    <textarea className="input" rows="2" defaultValue={b.member_note||''} onBlur={e=>patchBox(b.id,{member_note:e.target.value})} /></label>

                  <div className="grp" style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                    <span>The line-up{bottles?` · ${bottles} ${bottles===1?'bottle':'bottles'}`:''}</span>
                    <a href="/admin/builder" className="hint" style={{color:'var(--red)',fontWeight:600,textTransform:'none',letterSpacing:0}}>Edit in Box Builder →</a>
                  </div>
                  {wines.length===0
                    ? <p className="hint">Nothing built yet. Add wines in the Box Builder and they show here.</p>
                    : <div className="lineup">{wines.map(w=>(
                        <div key={w.id} style={{padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
                          <div style={{display:'flex',justifyContent:'space-between',gap:10}}>
                            <span style={{fontWeight:600}}>{w.name}{w.kind==='extra'?' (extra)':''}{w.vintage?` · ${w.vintage}`:''}</span>
                            <span className="sub">×{w.qty}</span>
                          </div>
                          <input className="input" style={{marginTop:6,fontSize:13,padding:'7px 10px'}} placeholder="Tasting note (shown to members on the reveal)" defaultValue={w.tasting_note||''} onBlur={e=>patchItem(w.id,{tasting_note:e.target.value})} />
                        </div>
                      ))}</div>}

                  {(b.status==='shipped'||b.status==='done') && (
                    <div style={{marginTop:14,padding:'14px 16px',background:'var(--bg)',border:'1px solid var(--line)',borderRadius:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:14}}>Tell members it's on its way</div>
                          <div className="hint">Tags active members so your "Box On Its Way" email sends.{skips.filter(s=>s.box_id===b.id).length?` ${skips.filter(s=>s.box_id===b.id).length} skipped this box.`:''}</div>
                        </div>
                        <button className="btn sm" onClick={()=>notifyShipped(b.id)} disabled={notifying===b.id}>{notifying===b.id?'Sending…':'Notify members'}</button>
                      </div>
                      {notifyMsg[b.id] && <p className="hint" style={{marginTop:8,color:'var(--green)'}}>{notifyMsg[b.id]}</p>}
                    </div>
                  )}

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
