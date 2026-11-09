(()=>{
 const names=['Marwar Demo XI','Jodhpur Demo XI','Barmer Demo XI','Ajmer Demo XI','Rajasthan Demo XI'];
 const roles=['Batsman','Batsman','All-rounder','Bowler','Wicketkeeper'];
 const teams=names.map((name,t)=>({name,players:Array.from({length:5},(_,i)=>({name:`${name.split(' ')[0]} Player ${i+1}`,role:roles[(i+t)%roles.length]}))}));
 let selected=0,runs=0,wickets=0,balls=0,striker=0,bowler=3,events=[];
 const $=id=>document.getElementById(id);
 function render(){ $('teams').innerHTML=teams.map((t,i)=>`<button class="teamBtn ${i===selected?'active':''}" data-team="${i}">${t.name}</button>`).join('');$('players').innerHTML=teams[selected].players.map((p,i)=>`<div class="playerRow"><b>${p.name}</b><span class="tag">${p.role}</span></div>`).join('');$('matchTitle').textContent=`${teams[0].name} vs ${teams[1].name}`;$('score').textContent=`${runs}/${wickets}`;$('overs').textContent=`${Math.floor(balls/6)}.${balls%6} overs · Demo innings`;$('striker').textContent=teams[0].players[striker%5].name;$('bowler').textContent=teams[1].players[bowler%5].name;$('recent').innerHTML=events.slice(-18).map(x=>`<span>${x}</span>`).join('')||'<span>Waiting for first ball</span>';}
 document.addEventListener('click',e=>{const team=e.target.closest('[data-team]');if(team){selected=Number(team.dataset.team);render();return}const run=e.target.closest('[data-run]');if(run){const n=Number(run.dataset.run);runs+=n;balls++;events.push(n===4?'4':n===6?'6':String(n));if(n%2)striker=(striker+1)%5;if(balls%6===0)striker=(striker+1)%5;render();return}if(e.target.id==='demoWicket'){wickets++;balls++;events.push('W');striker=(striker+1)%5;render();return}if(e.target.id==='demoOver'){balls=Math.ceil(balls/6)*6;bowler=(bowler+1)%5;striker=(striker+1)%5;render();return}if(e.target.id==='demoReset'){runs=0;wickets=0;balls=0;striker=0;bowler=3;events=[];render();}});
 render();
})();
