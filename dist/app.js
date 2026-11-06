'use strict';
(() => {
 const races=window.MARATHONS, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const svg=$('#world-map'), markers=$('#markers'), dialog=$('#race-dialog');
 const NS='http://www.w3.org/2000/svg';
 const state={region:'',distance:'',query:'',type:'start',date:today(),view:{x:0,y:0,w:1080,h:495},visible:races};
 let dialogChoices=[];
 function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());}
 const day=s=>Date.parse(s+'T00:00:00Z');
 const diff=(a,b)=>Math.round((day(a)-day(b))/86400000);
 const dateText=s=>s.replaceAll('-','.');
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const point=r=>({x:(r.lon+180)*3,y:(85-r.lat)*3});
 function el(tag,attrs){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;}
 for(const path of window.WORLD_PATHS)$('#land').appendChild(el('path',{d:path}));
 const allEvents=races.flatMap(r=>r.registrationEvents.map(event=>({...event,race:r})));
 function inWindow(event){const n=diff(event.date,state.date);return n>=0&&n<=14;}
 function raceColor(r){return r.registrationEvents.some(e=>e.type==='start'&&inWindow(e))?'#e96a4b':r.registrationEvents.some(e=>e.type==='end'&&inWindow(e))?'#d8a647':'#24484f';}
 function groups(){
  const screenScale=svg.getScreenCTM()?.a||.8;
  const items=[];
  for(const race of state.visible){
   const p=point(race);let g=items.find(g=>Math.hypot(g.x-p.x,g.y-p.y)*screenScale<28);
   if(g){g.races.push(race);const n=g.races.length;g.x+=(p.x-g.x)/n;g.y+=(p.y-g.y)/n;}else items.push({...p,races:[race]});
  }return {items,screenScale};
 }
 function drawMarkers(){
  markers.replaceChildren();const {items,screenScale}=groups();const unit=1/screenScale;
  for(const group of items){
   const sameCity=group.races.every(r=>r.city===group.races[0].city),cluster=group.races.length>1&&!sameCity;
   const color=group.races.some(r=>raceColor(r)==='#e96a4b')?'#e96a4b':group.races.some(r=>raceColor(r)==='#d8a647')?'#d8a647':'#24484f';
   const label=cluster?`${group.races.length}개 대회 · ${group.races.map(r=>r.city).join(', ')} · 대회 정보 열기`:`${group.races[0].city} · ${group.races.map(r=>r.name).join(', ')}`;
   const g=el('g',{class:'marker'+(cluster?' cluster':''),transform:`translate(${group.x} ${group.y}) scale(${unit})`,tabindex:0,role:'button','aria-label':label});
   const title=el('title',{});title.textContent=label;g.append(title);
   g.append(el('circle',{r:cluster?18:13,fill:color,class:'halo'}));g.append(el('circle',{r:cluster?12:6,fill:color}));
   if(cluster){const t=el('text',{'text-anchor':'middle',y:4});t.textContent=group.races.length;g.append(t);}
   else if(state.view.w<600||['서울','오아후섬·하와이','뉴욕','시드니','리우데자네이루','케이프타운','두바이'].includes(group.races[0].city)){
    const t=el('text',{x:10,y:4});t.textContent=group.races[0].city;g.append(t);
   }
   const activate=()=>openRace(group.races[0],group.races);
   g.addEventListener('click',()=>{if(!dragMoved)activate();});
   g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
   markers.appendChild(g);
  }
 }
 function setView(v){const w=Math.max(65,Math.min(1080,v.w));const h=w*495/1080;state.view={x:Math.max(-70,Math.min(1150-w,v.x)),y:Math.max(-65,Math.min(560-h,v.y)),w,h};svg.setAttribute('viewBox',`${state.view.x} ${state.view.y} ${w} ${h}`);drawMarkers();$('#zoom-in').disabled=w<=65;$('#zoom-out').disabled=w>=1080;}
 function zoom(factor){const v=state.view,w=v.w*factor,h=w*495/1080;setView({x:v.x+(v.w-w)/2,y:v.y+(v.h-h)/2,w,h});}
 function fit(list,maxWidth=1080){
  if(!list.length)return;
  const ps=list.map(point),xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const w=Math.min(maxWidth,Math.max(120,(Math.max(...xs)-Math.min(...xs))*1.4+70,(Math.max(...ys)-Math.min(...ys))*1080/495*1.4+70));
  setView({x:cx-w/2,y:cy-w*495/1080/2,w});
 }
 function filter(resetView=false){
  state.query=$('#search').value.trim().toLocaleLowerCase();state.distance=$('#distance').value;
  state.visible=races.filter(r=>(!state.region||r.region===state.region)&&(!state.distance||r.events.split(' · ').includes(state.distance))&&(!state.query||[r.name,r.city,r.country,r.events].join(' ').toLocaleLowerCase().includes(state.query)));
  $('#map-count').textContent=`${state.visible.length}개 대회 · ${new Set(state.visible.map(r=>r.city)).size}개 도시`;
  $('#map-empty').hidden=state.visible.length>0;
  renderRaceList();
  if(resetView){if(state.region||state.query)fit(state.visible);else setView({x:0,y:0,w:1080});}else drawMarkers();
 }
 function racePeriod(r){
  const match=r.date.match(/^(\d{4})\.(\d{2})\.(\d{2})(?:~(\d{2}))?/);
  if(!match)return null;
  const [,year,month,start,end]=match;
  return {start:day(`${year}-${month}-${start}`),end:day(`${year}-${month}-${end||start}`)};
 }
 function renderRaceList(){
  const cutoff=day(state.date);
  const upcoming=state.visible.filter(r=>{const period=racePeriod(r);if(period)return period.end>=cutoff;const year=Number(r.date.match(/^\d{4}/)?.[0]);return !year||year>=Number(state.date.slice(0,4));})
   .sort((a,b)=>(racePeriod(a)?.start??Infinity)-(racePeriod(b)?.start??Infinity)||a.id-b.id);
  const shown=upcoming.slice(0,10);
  $('#result-count').textContent=`${shown.length} / ${upcoming.length}`;
  $('#list-empty').hidden=shown.length>0;
  $('#race-list').innerHTML=shown.map((r,index)=>`<button class="race-card" data-race="${r.id}" aria-label="${escape(r.name)} 정보 열기"><span class="race-rank">${String(index+1).padStart(2,'0')}</span><span class="race-summary"><span class="country">${escape(r.country)} · ${escape(r.city)}</span><strong>${escape(r.name)}</strong><span class="race-distances">${escape(r.events)}</span></span><span class="race-timing"><span class="race-date">${escape(r.date)}</span><span class="card-arrow">↗</span></span></button>`).join('');
 }
 function scheduleCard(e){const n=diff(e.date,state.date);return `<button class="schedule-card" data-race="${e.race.id}"><span class="schedule-card-top"><span>${dateText(e.date)}</span><span class="d-day">${n===0?'TODAY':'D−'+n}</span></span><strong>${escape(e.race.name)}</strong><small>${escape(e.race.country)} · ${escape(e.race.city)}</small><div class="schedule-label">${state.type==='start'?'신청 시작':'신청 마감'} · ${escape(e.label)} ↗</div></button>`;}
 function renderSchedule(){
  renderRaceList();
  for(const type of ['start','end'])$(`#${type}-count`).textContent=allEvents.filter(e=>e.type===type&&inWindow(e)).length;
  const events=allEvents.filter(e=>e.type===state.type&&inWindow(e)).sort((a,b)=>day(a.date)-day(b.date));
  const end=new Date(day(state.date)+14*86400000).toISOString().slice(0,10);
  $('#schedule-range').textContent=`${dateText(state.date)} — ${dateText(end)} · 현지 날짜`;
  $('#schedule-list').innerHTML=events.length?events.map(scheduleCard).join(''):`<div class="schedule-empty">2주 이내 확정된 신청 ${state.type==='start'?'시작':'마감'} 일정이 없어요.<br>기준일을 바꾸거나 다른 탭을 확인해보세요.</div>`;
  const next=allEvents.filter(e=>e.type===state.type&&diff(e.date,state.date)>14).sort((a,b)=>day(a.date)-day(b.date)).slice(0,3);
  $('#next-title').textContent=`그다음 신청 ${state.type==='start'?'시작':'마감'}`;
  $('#next-list').innerHTML=next.length?next.map(e=>`<button class="next-item" data-race="${e.race.id}"><span class="next-date">${dateText(e.date).slice(5)}</span><span><strong>${escape(e.race.name)}</strong><small>${escape(e.label)}</small></span></button>`).join(''):'<p class="empty-copy">이후 확정 일정은 아직 없어요.</p>';
  drawMarkers();
 }
 function openRace(r,choices=null){
  if(!r)return;
  const siblings=choices||races.filter(x=>x.city===r.city);
  dialogChoices=siblings;
  $('#dialog-location').textContent=`${r.region} / ${r.country} / ${r.city}`;
  $('#city-choices').innerHTML=siblings.length>1?siblings.map(x=>`<button data-choice="${x.id}" class="${r.id===x.id?'active':''}" aria-pressed="${r.id===x.id}">${escape(x.name)}</button>`).join(''):'';
  const air=r.air[1]?`${r.air[0]}~${r.air[1]}`:'해당 없음';
  $('#dialog-body').innerHTML=`<div class="detail-hero"><div><p class="eyebrow">YOUR NEXT STARTING LINE</p><h2 id="dialog-title">${escape(r.name)}</h2><p class="dialog-feature">${escape(r.fame)}</p><p class="detail-label">대회 일정</p><p class="detail-date">${escape(r.date)}</p></div><div><img class="detail-photo" src="${escape(r.photo.img)}" alt="${escape(r.photo.title||r.name+' 대회 사진')}" referrerpolicy="no-referrer"><a class="photo-credit" target="_blank" rel="noopener" href="${escape(r.photo.source)}">사진 출처 · 과거 회차 참고 ↗</a></div></div><div class="detail-block"><h3>신청 종목·거리</h3><span class="detail-chip">${escape(r.events)}</span><p>${escape(r.eventNote)}</p></div><div class="detail-block"><h3>신청기간·상태·다음 회차</h3><p>${escape(r.registration)}</p><p class="muted">안내 문구는 2026.11.06 기준입니다. 종목별 접수기간과 잔여석은 공식 사이트에서 확인하세요.</p></div><div class="detail-block"><h3>여행 예산 <span class="muted">1인 · 만원</span></h3><div class="budget-grid"><div><small>왕복 항공료</small><strong>${air}</strong></div><div><small>현지 5일·4박</small><strong>${r.stay[0]}~${r.stay[1]}</strong></div><div><small>항공 + 체류</small><strong>${r.air[0]+r.stay[0]}~${r.air[1]+r.stay[1]}</strong></div></div><p class="muted">인천 출발 이코노미 · 중급 호텔 2인 1실 · 식사·현지 교통 포함. 참가비 제외. 실제 평균이 아닌 계획용 추정 범위.${r.air[1]?'':' 국내 이동비 별도.'}</p></div><div class="detail-actions"><a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">공식 안내·신청 ↗</a><a href="${escape(r.eventSource)}" target="_blank" rel="noopener noreferrer" class="secondary">종목 상세 안내 ↗</a></div><p class="detail-epoch">정보 기준 2026.11.06 · 예상·미발표 일정은 변동될 수 있습니다.</p>`;
  const photo=$('.detail-photo');photo.addEventListener('error',()=>{photo.alt='사진을 불러오지 못했습니다. 아래 출처 링크에서 확인하세요.';photo.style.objectFit='contain';});
  if(!dialog.open)dialog.showModal();else dialog.scrollTop=0;
 }
 $('#reference-date').value=state.date;
 $('#reference-date').addEventListener('change',e=>{const value=e.target.value;if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value)){e.target.value=state.date;return;}state.date=value;renderSchedule();});
 $('#today').addEventListener('click',()=>{state.date=today();$('#reference-date').value=state.date;renderSchedule();});
 $$('.schedule-tabs button').forEach(b=>b.addEventListener('click',()=>{state.type=b.dataset.type;$$('.schedule-tabs button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderSchedule();}));
 $$('.region-tabs button').forEach(b=>b.addEventListener('click',()=>{state.region=b.dataset.region;$$('.region-tabs button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});filter(true);}));
 $('#search').addEventListener('input',()=>filter(true));$('#distance').addEventListener('change',()=>filter());
 $('#clear-filters').addEventListener('click',()=>{$('#search').value='';$('#distance').value='';$('[data-region=""]').click();});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-race]');if(b)openRace(races.find(r=>r.id===Number(b.dataset.race)));const c=e.target.closest('[data-choice]');if(c)openRace(races.find(r=>r.id===Number(c.dataset.choice)),dialogChoices);});
 $('#close-dialog').addEventListener('click',()=>dialog.close());$('#close-help').addEventListener('click',()=>$('#help-dialog').close());
 for(const d of [dialog,$('#help-dialog')])d.addEventListener('click',e=>{if(e.target===d){const rect=d.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)d.close();}});
 for(const selector of ['#help-button','#footer-help'])$(selector).addEventListener('click',()=>$('#help-dialog').showModal());
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!dialog.open&&!$('#help-dialog').open){e.preventDefault();$('#search').focus();}});
 $('#zoom-in').addEventListener('click',()=>zoom(.65));$('#zoom-out').addEventListener('click',()=>zoom(1.55));$('#reset-map').addEventListener('click',()=>setView({x:0,y:0,w:1080}));
 let drag=null,dragMoved=false;
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragMoved=false;drag={x:e.clientX,y:e.clientY,view:{...state.view},matrix:svg.getScreenCTM().inverse()};});
 svg.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4){dragMoved=true;svg.classList.add('dragging');const scale=drag.matrix.a;state.view={...drag.view,x:drag.view.x-dx*scale,y:drag.view.y-dy*scale};svg.setAttribute('viewBox',`${state.view.x} ${state.view.y} ${state.view.w} ${state.view.h}`);}});
 const stopDrag=()=>{if(dragMoved)setView(state.view);drag=null;svg.classList.remove('dragging');};
 window.addEventListener('pointerup',stopDrag);svg.addEventListener('pointercancel',stopDrag);svg.addEventListener('pointerleave',stopDrag);
 new ResizeObserver(()=>drawMarkers()).observe(svg);
 $('#download-csv').addEventListener('click',()=>{
  const rows=[['대회명','국가','도시','신청 종목·거리','참가조건','대회일정','신청기간·상태','인지도','왕복 항공료 추정(만원)','5일 체류비 추정(만원)','공식 신청 URL','종목 안내 URL','정보 기준일'],...state.visible.map(r=>[r.name,r.country,r.city,r.events,r.eventNote,r.date,r.registration,r.fame,r.air[1]?r.air.join('~'):'해당 없음',r.stay.join('~'),r.url,r.eventSource,'2026-11-06'])];
  const text='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='marathon-atlas.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 filter();renderSchedule();
})();
