import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (s, root=document) => root.querySelector(s);
const money = n => Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id = () => crypto.randomUUID();
let db = null, session = null, currentPage = 'inicio';

let state = {
  athletes: [],
  teams: [
    {
      id: 'team-a',
      name: 'Time A',
      color: '#75a88a',
      badge: 'A'
    },
    {
      id: 'team-b',
      name: 'Time B',
      color: '#d5b46a',
      badge: 'B'
    }
  ],
  matches: [],
  goals: [],
  cards: [],
  payments: [],
  attendance_confirmations: []
};

const demo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

async function init(){
  $('#year').textContent = new Date().getFullYear();
  if(!demo){
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    db = createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
    const {data:{session:s}} = await db.auth.getSession(); session=s;
    db.auth.onAuthStateChange((event, s) => {
  session = s;
  updateAdminStatus();

  if(event === 'PASSWORD_RECOVERY'){
    showPasswordReset();
  }
});
    await loadRemote();
  } else { loadLocal(); }
  updateAdminStatus(); bindNavigation(); renderPage('inicio');
}
function loadLocal(){try{const saved=JSON.parse(localStorage.getItem('bh-demo-data'));if(saved)state={...state,...saved};}catch{}}
function saveLocal(){localStorage.setItem('bh-demo-data',JSON.stringify(state));}


async function loadRemote(){
  const tables = [
    'athletes',
    'teams',
    'matches',
    'goals',
    'cards',
    'attendance_confirmations'
  ];

  for(const t of tables){
    const orderColumn = t === 'attendance_confirmations'
      ? 'response_at'
      : 'created_at';

    const {data,error} = await db
      .from(t)
      .select('*')
      .order(orderColumn,{ascending:true});

    if(error){
      console.error(error);
      continue;
    }

    state[t] = data || [];
  }

  // Carrega a situação financeira pela consulta pública
  const {data: payments, error: paymentsError} = await db
    .from('public_payment_status')
    .select('*')
    .order('due_date',{ascending:true});

  if(paymentsError){
    console.error('Erro ao carregar situação financeira:',paymentsError);
  }else{
    state.payments = payments || [];
  }
}



  async function save(table,row,remove=false){
  if(demo){
    const arr=state[table];

    if(remove){
      state[table]=arr.filter(x=>x.id!==row.id);
    }else{
      const i=arr.findIndex(x=>x.id===row.id);
      if(i>=0) arr[i]=row;
      else arr.push(row);
    }

    saveLocal();
    return;
  }

  if(!session) throw new Error('Entre como administrador para fazer alterações.');

  const {error}=remove
    ? await db.from(table).delete().eq('id',row.id)
    : await db.from(table).upsert(row);

  if(error) throw error;

  await loadRemote();
}

function notify(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
let isAdmin = false;
let currentAthlete = null;

async function updateAdminStatus(){
  if(session && db){
    const { data, error } = await db.rpc('is_admin');
    isAdmin = !error && data === true;
  } else {
    isAdmin = false;
  }

  $('#adminStatus').textContent = isAdmin
    ? 'Sair'
    : session
      ? 'Atleta conectado'
      : 'Entrar →';

  $('#adminButton').firstChild.textContent = isAdmin
    ? '⚙ Administração'
    : '⚙ Área administrativa';
}


function bindNavigation(){
  $('#navigation').addEventListener('click',e=>{
    const b=e.target.closest('[data-page]');
    if(b) renderPage(b.dataset.page);
  });

  $('#appContent').addEventListener('click',e=>{
    const b=e.target.closest('[data-goto]');
    if(b) renderPage(b.dataset.goto);
  });

  $('#mobileMenu').onclick=()=>{
    $('#sidebar').classList.toggle('open');
  };

  $('#adminButton').onclick=adminAction;

  if($('#athleteButton')){
    $('#athleteButton').onclick=athleteAction;
  }
}

function setTitle(title){$('#pageTitle').textContent=title;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===currentPage));$('#sidebar').classList.remove('open');}
function renderPage(page){currentPage=page;const titles={inicio:'Visão geral',atletas:'Atletas',times:'Times',partidas:'Partidas',estatisticas:'Estatísticas',financeiro:'Financeiro'};setTitle(titles[page]||'Visão geral');if(page==='inicio')renderHome();else if(page==='atletas')renderAthletes();else if(page==='times')renderTeams();else if(page==='partidas')renderMatches();else if(page==='estatisticas')renderStats();else if(page==='financeiro')renderFinance();}
function pageHeader(kicker,title,desc,action=''){return `<div class="page-header"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;}
function adminOnly(){if(!demo&&!session){notify('Faça login como administrador.');return false;}if(demo){notify('Modo demonstração: configure o Supabase para proteger a administração.');return false;}return true;}


function renderHome(){
 const teams=state.teams||[];
 const teamA=teams[0];
 const teamB=teams[1];

 const teamLogo=(t)=>{
   if(!t) return '';
   return t.logo_url
     ? `<img src="${esc(t.logo_url)}" alt="Escudo ${esc(t.name)}">`
     : `<span>${esc(t.badge||t.name.slice(0,1))}</span>`;
 };

 // Próximas partidas agendadas
 const upcomingMatches=[...(state.matches||[])]
   .filter(m=>m.status==='Agendada' && m.date)
   .sort((a,b)=>a.date.localeCompare(b.date))
   .slice(0,3);

 // Últimas partidas finalizadas
 const recentResults=[...(state.matches||[])]
   .filter(m=>m.status==='Finalizada' && m.date)
   .sort((a,b)=>b.date.localeCompare(a.date))
   .slice(0,3);

 // Monta cada confronto
 const matchCard=(m,finished=false)=>{
   const a=teams.find(t=>t.id===m.team_a);
   const b=teams.find(t=>t.id===m.team_b);
   const scoreA=Number(m.score_a??0);
   const scoreB=Number(m.score_b??0);
   const winnerA=finished && scoreA>scoreB;
   const winnerB=finished && scoreB>scoreA;

   const date=new Date(m.date+'T12:00:00')
     .toLocaleDateString('pt-BR');

   return `
     <div class="home-match-card">
       <div class="home-match-date">
         ${date}${m.time?' • '+esc(m.time):''}
       </div>

       <div class="home-match-teams">
         <div class="home-match-side ${winnerA?'is-winner':''}">
           <div class="home-match-logo">${teamLogo(a)}</div>
           <span>${esc(a?.name||'Time A')}</span>
         </div>

         <div class="home-match-center">
           <strong>
             ${finished
               ? `${scoreA} <small>×</small> ${scoreB}`
               : 'VS'}
           </strong>
           <span>${finished
             ? scoreA===scoreB?'EMPATE':'FINALIZADA'
             : 'AGENDADA'}</span>
         </div>

         <div class="home-match-side ${winnerB?'is-winner':''}">
           <div class="home-match-logo">${teamLogo(b)}</div>
           <span>${esc(b?.name||'Time B')}</span>
         </div>
       </div>
     </div>`;
 };

 $('#appContent').innerHTML=`
 <section class="hero hero-modern">
   <div class="hero-copy">
     <div class="hero-kicker">BABA HUMILDES • PALESTINA - BA</div>
     <h1>O futebol nos une.<br><em>A resenha nos fortalece.</em></h1>
     <p>Dois times, uma paixão e uma comunidade que se encontra todo domingo.</p>
     <div class="hero-actions">
       <button class="btn btn-gold" data-goto="partidas">Ver partidas <span>↗</span></button>
       <button class="btn btn-outline" data-goto="atletas">Conhecer atletas</button>
     </div>
   </div>

   
 </section>

 <section class="home-matchup">
   <div class="matchup-heading">
     <span class="eyebrow">NOSSA RIVALIDADE</span>
     <h2>O grande confronto</h2>
     <p>Dois lados. Uma só paixão.</p>
   </div>

   <div class="matchup-teams">
     <div class="matchup-team">
       <div class="matchup-logo">${teamLogo(teamA)}</div>
       <h3>${teamA?esc(teamA.name):'Time A'}</h3>
       <span>TIME A</span>
     </div>

     <div class="matchup-vs">VS</div>

     <div class="matchup-team">
       <div class="matchup-logo">${teamLogo(teamB)}</div>
       <h3>${teamB?esc(teamB.name):'Time B'}</h3>
       <span>TIME B</span>
     </div>
   </div>

   <button class="text-button" data-goto="times">Conhecer as equipes →</button>
 </section>

 <section class="stats-grid">
   <div class="stat-card">
     <div class="stat-label">ATLETAS CADASTRADOS</div>
     <div class="stat-value">${state.athletes.length}</div>
     <div class="stat-icon">♙</div>
   </div>

   <div class="stat-card">
     <div class="stat-label">TIMES</div>
     <div class="stat-value">${state.teams.length}</div>
     <div class="stat-icon">⚑</div>
   </div>

   <div class="stat-card">
     <div class="stat-label">GOLS REGISTRADOS</div>
     <div class="stat-value">${state.goals.length}</div>
     <div class="stat-icon">⚽</div>
   </div>

   <div class="stat-card">
     <div class="stat-label">CONTRIBUIÇÃO</div>
     <div class="stat-value" style="font-size:24px">R$ 25</div>
     <div class="stat-icon">✦</div>
   </div>
 </section>

 <section class="section-grid">
   <div class="panel next-match">
     <div class="panel-heading">
       <div>
         <span class="eyebrow">AGENDA</span>
         <h2>Próximo baba</h2>
       </div>
       <span class="tag tag-green">DOMINGO</span>
     </div>
     ${nextMatch()}
   </div>

   <div class="panel contribution">
     <div class="panel-heading">
       <div>
         <span class="eyebrow">NOSSO COMPROMISSO</span>
         <h2>Todo domingo</h2>
       </div>
       <span class="coin-icon">⚽</span>
     </div>
     <div class="contribution-value">R$ 25<span>,00</span></div>
     <p>Contribuição padrão por atleta para manter nosso baba acontecendo.</p>
   </div>
 </section>

 <section class="home-games-section">
   <div class="home-games-column">
     <div class="panel-heading">
       <div>
         <span class="eyebrow">AGENDA</span>
         <h2>Próximos jogos</h2>
       </div>
       <button class="text-button" data-goto="partidas">Ver todos →</button>
     </div>

     ${upcomingMatches.length
       ? upcomingMatches.map(m=>matchCard(m,false)).join('')
       : '<div class="empty-state compact">Nenhum jogo agendado no momento.</div>'}
   </div>

   <div class="home-games-column">
     <div class="panel-heading">
       <div>
         <span class="eyebrow">HISTÓRICO</span>
         <h2>Últimos resultados</h2>
       </div>
       <button class="text-button" data-goto="partidas">Ver todos →</button>
     </div>

     ${recentResults.length
       ? recentResults.map(m=>matchCard(m,true)).join('')
       : '<div class="empty-state compact">Ainda não temos resultados registrados.</div>'}
   </div>
 </section>

 <section class="section-grid lower-grid">
   <div class="panel">
     <div class="panel-heading">
       <div>
         <span class="eyebrow">DESTAQUE</span>
         <h2>Artilharia</h2>
       </div>
       <button class="text-button" data-goto="estatisticas">Ver ranking →</button>
     </div>
     ${scorerList(5)}
   </div>

   <div class="panel">
     <div class="panel-heading">
       <div>
         <span class="eyebrow">NOSSO GRUPO</span>
         <h2>Times</h2>
       </div>
       <button class="text-button" data-goto="times">Ver times →</button>
     </div>
     ${teamPreview()}
   </div>
 </section>

 <footer>
   © ${new Date().getFullYear()} BABA HUMILDES · Palestina, Salvador - BA
   <span>Feito para a resenha continuar.</span>
 </footer>`;
}



function nextMatch(){
  const m=[...(state.matches||[])]
    .filter(x=>x.date)
    .sort((a,b)=>a.date.localeCompare(b.date))[0];

  if(!m){
    return `<div class="empty-state compact">
      Nenhuma partida cadastrada ainda.<br>
      <small>O administrador poderá adicionar o próximo confronto.</small>
    </div>`;
  }

  const a=state.teams.find(t=>t.id===m.team_a);
  const b=state.teams.find(t=>t.id===m.team_b);

  const teamLogo=(t)=>{
    if(!t) return '<span>?</span>';

    return t.logo_url
      ? `<img src="${esc(t.logo_url)}" alt="Escudo ${esc(t.name)}">`
      : `<span>${esc(t.badge||t.name.slice(0,1))}</span>`;
  };

  return `
    <div class="home-match-teams next-match-teams">

      <div class="home-match-side">
        <div class="home-match-logo">
          ${teamLogo(a)}
        </div>
        <span>${esc(a?.name||'Time A')}</span>
        <small>MANDANTE</small>
      </div>

      <div class="home-match-center">
        <strong>×</strong>
      </div>

      <div class="home-match-side">
        <div class="home-match-logo">
          ${teamLogo(b)}
        </div>
        <span>${esc(b?.name||'Time B')}</span>
        <small>VISITANTE</small>
      </div>

    </div>

    <div class="eyebrow" style="text-align:center;margin-top:16px">
      ${new Date(m.date+'T12:00:00').toLocaleDateString('pt-BR')}
      ${m.time?' • '+esc(m.time):''}
    </div>
  `;
}

function scorerCounts(){const counts={};state.goals.forEach(g=>counts[g.athlete_id]=(counts[g.athlete_id]||0)+1);return Object.entries(counts).map(([athlete_id,goals])=>({athlete:state.athletes.find(a=>a.id===athlete_id),goals})).filter(x=>x.athlete).sort((a,b)=>b.goals-a.goals);}
function scorerList(limit=20){const rows=scorerCounts().slice(0,limit);return rows.length?`<div class="list-wrap">${rows.map((r,i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,'0')}</span><span class="rank-name">${esc(r.athlete.name)}</span><span class="rank-meta">${r.goals} gol(s)</span></div>`).join('')}</div>`:`<div class="empty-state">A artilharia aparecerá aqui quando os gols forem registrados.</div>`;}

function teamPreview(){
 return `<div class="team-preview">
   ${state.teams.map(t=>`
     <div class="team-mini">
       <div class="team-badge">
         ${t.logo_url
           ? `<img src="${esc(t.logo_url)}" alt="Escudo ${esc(t.name)}">`
           : esc(t.badge||t.name.slice(0,1))}
       </div>
       <b>${esc(t.name)}</b>
       <small>${state.athletes.filter(a=>a.team_id===t.id).length} atletas</small>
     </div>
   `).join('')}
 </div>`;
}


function renderAthletes(){
  const action = session
    ? '<button class="btn-primary" id="addAthlete">+ Cadastrar atleta</button>'
    : '';

  $('#appContent').innerHTML =
    pageHeader('ELENCO','Atletas','Jogadores separados por equipe.',action) +
    `
      <div class="filter-row">
        <input id="athleteSearch" placeholder="Buscar atleta pelo nome...">
      </div>

      <div id="athleteGroups"></div>
    `;

  drawAthletes();

  $('#athleteSearch').oninput = drawAthletes;

  if(session){
    $('#addAthlete').onclick = () => athleteForm();
  }
}


function drawAthletes(){
  const q = ($('#athleteSearch')?.value || '').toLowerCase();

  const teams = [...state.teams];

  const groups = teams.map(team => {
    const athletes = state.athletes.filter(a =>
      a.team_id === team.id &&
      (a.name || '').toLowerCase().includes(q)
    );

    return { team, athletes };
  });

  const withoutTeam = state.athletes.filter(a =>
    !teams.some(t => t.id === a.team_id) &&
    (a.name || '').toLowerCase().includes(q)
  );

  const renderRows = athletes => {
    if(!athletes.length){
      return `
        <tr>
          <td colspan="${session ? 6 : 5}" class="empty-table">
            Nenhum atleta nesta equipe.
          </td>
        </tr>
      `;
    }

    return athletes.map(a => `
      <tr>
        <td><b>${esc(a.name)}</b></td>
        <td>${esc(state.teams.find(t => t.id === a.team_id)?.name || '—')}</td>
        <td>${esc(a.position || 'Não informada')}</td>
        <td>${state.goals.filter(g => g.athlete_id === a.id).length}</td>
        <td>
          <small>
            ${a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR') : '—'}
          </small>
        </td>
        ${session ? `
          <td class="row-actions">
            <button data-edit-athlete="${a.id}">Editar</button>
            ·
            <button data-delete-athlete="${a.id}">Excluir</button>
          </td>
        ` : ''}
      </tr>
    `).join('');
  };

  const renderGroup = (team, athletes) => `
    <div class="panel" style="margin-bottom:24px;">
      <div class="panel-heading" style="display:flex;align-items:center;gap:14px;padding:18px;">
        ${
          team.logo_url
            ? `<img src="${esc(team.logo_url)}" alt="Escudo ${esc(team.name)}" style="width:55px;height:55px;object-fit:contain;">`
            : ''
        }
        <div>
          <h2>${esc(team.name)}</h2>
          <span>${athletes.length} atleta(s)</span>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ATLETA</th>
              <th>TIME</th>
              <th>POSIÇÃO</th>
              <th>GOLS</th>
              <th>CADASTRO</th>
              ${session ? '<th>AÇÕES</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${renderRows(athletes)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#athleteGroups').innerHTML =
    groups.map(group =>
      renderGroup(group.team, group.athletes)
    ).join('') +
    (withoutTeam.length ? renderGroup(
      { name: 'Sem time definido', logo_url: null },
      withoutTeam
    ) : '');

  $('#athleteGroups').querySelectorAll('[data-edit-athlete]').forEach(b =>
    b.onclick = () =>
      athleteForm(state.athletes.find(a => a.id === b.dataset.editAthlete))
  );

  $('#athleteGroups').querySelectorAll('[data-delete-athlete]').forEach(b =>
    b.onclick = () => deleteAthlete(b.dataset.deleteAthlete)
  );
}

function athleteForm(a={}){showEdit(`<h2>${a.id?'Editar atleta':'Novo atleta'}</h2><p>Preencha os dados do jogador.</p><form id="athleteForm"><div class="field"><label>Nome completo *</label><input name="name" required value="${esc(a.name||'')}" placeholder="Nome do atleta"></div><div class="form-grid"><div class="field"><label>Posição</label><select name="position"><option value="">Selecione</option>${['Goleiro','Zagueiro','Lateral','Meio-campo','Atacante'].map(x=>`<option ${a.position===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Número da camisa</label><input name="number" type="number" min="0" value="${esc(a.number??'')}"></div><div class="field full"><label>Time</label><select name="team_id"><option value="">Sem time definido</option>${state.teams.map(t=>`<option value="${t.id}" ${a.team_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div></div><div class="modal-actions"><button type="button" class="btn-secondary" data-close>Cancelar</button><button class="btn-primary">Salvar atleta</button></div></form>`);$('#athleteForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await save('athletes',{...a,id:a.id||id(),name:f.get('name').trim(),position:f.get('position'),number:f.get('number')||null,team_id:f.get('team_id')||null,created_at:a.created_at||new Date().toISOString()});$('#editDialog').close();notify('Atleta salvo!');renderPage('atletas');}catch(err){notify(err.message);}};}
async function deleteAthlete(aid){if(!confirm('Excluir este atleta?'))return;try{await save('athletes',{id:aid},true);notify('Atleta excluído.');renderPage('atletas');}catch(e){notify(e.message);}}

function renderTeams(){
  const action=session?'<button class="btn-primary" id="addTeam">+ Novo time</button>':'';

  $('#appContent').innerHTML=pageHeader('EQUIPES','Nossos times','Dois lados, uma só paixão.',action)+
  `<div class="cards-grid">${state.teams.map(t=>`
    <div class="team-card">
      <div class="team-badge">
        ${t.logo_url
          ? `<img src="${esc(t.logo_url)}" alt="Escudo ${esc(t.name)}" style="width:100%;height:100%;object-fit:contain">`
          : esc(t.badge||t.name.slice(0,1))}
      </div>
      <div>
        <h3>${esc(t.name)}</h3>
        <p>${state.athletes.filter(a=>a.team_id===t.id).length} atletas no elenco</p>
        ${session?`<button class="text-button" data-edit-team="${t.id}">Editar time →</button>`:''}
      </div>
    </div>`).join('')}</div>`;

  if(session)$('#addTeam').onclick=()=>teamForm();
  $('#appContent').querySelectorAll('[data-edit-team]').forEach(b=>
    b.onclick=()=>teamForm(state.teams.find(t=>t.id===b.dataset.editTeam))
  );
}


function teamForm(t={}){
  showEdit(`
    <h2>${t.id?'Editar time':'Novo time'}</h2>
    <p>Personalize o nome e a identificação do escudo.</p>

    <form id="teamForm">
      <div class="field">
        <label>Nome do time *</label>
        <input name="name" required value="${esc(t.name||'')}">
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Sigla / escudo</label>
          <input name="badge" maxlength="3" value="${esc(t.badge||'')}">
        </div>

        <div class="field">
          <label>Cor</label>
          <input name="color" type="color" value="${esc(t.color||'#75a88a')}" style="height:39px;padding:4px">
        </div>
      </div>

      <div class="field">
        <label>Imagem do escudo</label>
        <input name="logo" type="file" accept="image/png,image/jpeg,image/webp">
        <small>Formatos PNG, JPG ou WEBP. Máximo de 3 MB.</small>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button class="btn-primary">Salvar time</button>
      </div>
    </form>
  `);

  $('#teamForm').onsubmit=async e=>{
    e.preventDefault();

    const f=new FormData(e.target);
    const file=f.get('logo');
    const teamId=t.id||id();

    try{
      let logoUrl=t.logo_url||null;

      if(file && file.size>0){
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)){
          throw new Error('Escolha uma imagem PNG, JPG ou WEBP.');
        }

        if(file.size>3*1024*1024){
          throw new Error('A imagem deve ter no máximo 3 MB.');
        }

        const ext={
          'image/png':'png',
          'image/jpeg':'jpg',
          'image/webp':'webp'
        }[file.type];

        const path=`${teamId}.${ext}`;

        const {error:uploadError}=await db.storage
          .from('escudos')
          .upload(path,file,{
            upsert:true,
            contentType:file.type
          });

        if(uploadError) throw uploadError;

        const {data:urlData}=db.storage
          .from('escudos')
          .getPublicUrl(path);

        logoUrl=urlData.publicUrl;
      }

      await save('teams',{
        ...t,
        id:teamId,
        name:f.get('name').trim(),
        badge:f.get('badge')||f.get('name').slice(0,1).toUpperCase(),
        color:f.get('color'),
        logo_url:logoUrl
      });

      $('#editDialog').close();
      notify('Time salvo!');
      renderPage('times');

    }catch(err){
      notify(err.message);
    }
  };
}


function renderMatches(){
  const action=session
    ? '<button class="btn-primary" id="addMatch">+ Nova partida</button>'
    : '';

  $('#appContent').innerHTML=
    pageHeader('CAMPO','Partidas','Agenda, placares e eventos dos confrontos.',action)+
    `<div class="list-wrap" id="matchList"></div>`;

  const list=$('#matchList');

  if(!state.matches.length){
    list.innerHTML='<div class="empty-state">Nenhuma partida cadastrada.</div>';
  } else {
    list.innerHTML=[...state.matches]
      .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
      .map(m=>{
        const a=state.teams.find(t=>t.id===m.team_a);
        const b=state.teams.find(t=>t.id===m.team_b);

        const teamLogo=t=>{
          if(!t) return '<span>?</span>';

          return t.logo_url
            ? `<img src="${esc(t.logo_url)}" alt="Escudo ${esc(t.name)}">`
            : `<span>${esc(t.badge||t.name?.slice(0,1)||'?')}</span>`;
        };

        return `
          <div class="panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">
                  ${m.date?new Date(m.date+'T12:00:00').toLocaleDateString('pt-BR'):'Data não definida'}
                  ${m.time?' • '+esc(m.time):''}
                </span>
                <h2>${esc(m.status||'Agendada')}</h2>
              </div>

              ${session?`<button class="text-button" data-events="${m.id}">Registrar evento +</button>`:''}
            </div>

            <div class="home-match-teams">
              <div class="home-match-side">
                <div class="home-match-logo">
                  ${teamLogo(a)}
                </div>
                <span>${esc(a?.name||'Time A')}</span>
              </div>

              <div class="home-match-center">
                <strong>${m.score_a??0} <small>×</small> ${m.score_b??0}</strong>
                <span>PLACAR</span>
              </div>

              <div class="home-match-side">
                <div class="home-match-logo">
                  ${teamLogo(b)}
                </div>
                <span>${esc(b?.name||'Time B')}</span>
              </div>
            </div>

            ${session?`
              <div class="row-actions" style="text-align:right">
                <button data-edit-match="${m.id}">Editar partida</button>
              </div>
            `:''}
          </div>
        `;
      }).join('');
  }

  if(session){
    $('#addMatch').onclick=()=>matchForm();
  }

  list.querySelectorAll('[data-edit-match]').forEach(b=>
    b.onclick=()=>matchForm(state.matches.find(m=>m.id===b.dataset.editMatch))
  );

  list.querySelectorAll('[data-events]').forEach(b=>
    b.onclick=()=>eventForm(b.dataset.events)
  );
}

function matchForm(m={}){showEdit(`<h2>${m.id?'Editar partida':'Nova partida'}</h2><form id="matchForm"><div class="form-grid"><div class="field"><label>Time A</label><select name="team_a">${state.teams.map(t=>`<option value="${t.id}" ${m.team_a===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Time B</label><select name="team_b">${state.teams.map(t=>`<option value="${t.id}" ${m.team_b===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Data</label><input type="date" name="date" required value="${esc(m.date||'')}"></div><div class="field"><label>Horário</label><input type="time" name="time" value="${esc(m.time||'')}"></div><div class="field"><label>Gols Time A</label><input type="number" min="0" name="score_a" value="${m.score_a??0}"></div><div class="field"><label>Gols Time B</label><input type="number" min="0" name="score_b" value="${m.score_b??0}"></div><div class="field full"><label>Status</label><select name="status"><option ${m.status==='Agendada'?'selected':''}>Agendada</option><option ${m.status==='Finalizada'?'selected':''}>Finalizada</option><option ${m.status==='Cancelada'?'selected':''}>Cancelada</option></select></div></div><div class="modal-actions"><button type="button" class="btn-secondary" data-close>Cancelar</button><button class="btn-primary">Salvar partida</button></div></form>`);$('#matchForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(f.get('team_a')===f.get('team_b'))return notify('Escolha dois times diferentes.');try{await save('matches',{...m,id:m.id||id(),team_a:f.get('team_a'),team_b:f.get('team_b'),date:f.get('date'),time:f.get('time'),score_a:+f.get('score_a'),score_b:+f.get('score_b'),status:f.get('status'),created_at:m.created_at||new Date().toISOString()});$('#editDialog').close();notify('Partida salva!');renderPage('partidas');}catch(err){notify(err.message);}};}
function eventForm(matchId){const m=state.matches.find(x=>x.id===matchId);showEdit(`<h2>Registrar evento</h2><p>Adicione gol ou cartão à partida.</p><div class="notice">A pontuação da partida deve ser mantida coerente com os gols registrados. Nesta versão, o placar é editado na partida.</div><div class="form-grid"><button class="btn-secondary" id="addGoal">⚽ Registrar gol</button><button class="btn-secondary" id="addCard">▰ Registrar cartão</button></div>`);$('#addGoal').onclick=()=>eventFormFields('goal',matchId);$('#addCard').onclick=()=>eventFormFields('card',matchId);}
function eventFormFields(type,matchId){const isGoal=type==='goal';showEdit(`<h2>${isGoal?'Registrar gol':'Registrar cartão'}</h2><form id="eventForm"><div class="field"><label>Atleta</label><select name="athlete_id" required>${state.athletes.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div><div class="field"><label>Time</label><select name="team_id">${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>${isGoal?'<div class="field"><label>Minuto</label><input type="number" name="minute" min="1" max="150" placeholder="Ex.: 32"></div>':'<div class="field"><label>Tipo de cartão</label><select name="type"><option value="yellow">Amarelo</option><option value="red">Vermelho</option></select></div>'}<div class="modal-actions"><button type="button" class="btn-secondary" data-close>Cancelar</button><button class="btn-primary">Registrar</button></div></form>`);$('#eventForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const table=isGoal?'goals':'cards';const row={id:id(),match_id:matchId,athlete_id:f.get('athlete_id'),team_id:f.get('team_id'),...(isGoal?{minute:f.get('minute')||null}:{type:f.get('type')}),created_at:new Date().toISOString()};try{await save(table,row);$('#editDialog').close();notify(isGoal?'Gol registrado!':'Cartão registrado!');renderPage('partidas');}catch(err){notify(err.message);}};}

function renderStats(){
  const finished = state.matches
    .filter(m => m.status === 'Finalizada')
    .sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  const totalGoals = finished.reduce(
    (sum,m) => sum + Number(m.score_a || 0) + Number(m.score_b || 0),
    0
  );

  const yellows = state.cards.filter(c => c.type === 'yellow').length;
  const reds = state.cards.filter(c => c.type === 'red').length;

  const standings = state.teams.map(team => {
    const stats = {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    };

    finished.forEach(match => {
      let ownGoals;
      let opponentGoals;

      if(match.team_a === team.id){
        ownGoals = Number(match.score_a || 0);
        opponentGoals = Number(match.score_b || 0);
      }else if(match.team_b === team.id){
        ownGoals = Number(match.score_b || 0);
        opponentGoals = Number(match.score_a || 0);
      }else{
        return;
      }

      stats.played++;
      stats.goalsFor += ownGoals;
      stats.goalsAgainst += opponentGoals;

      if(ownGoals > opponentGoals){
        stats.wins++;
        stats.points += 3;
      }else if(ownGoals === opponentGoals){
        stats.draws++;
        stats.points++;
      }else{
        stats.losses++;
      }
    });

    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
    stats.performance = stats.played
      ? Math.round((stats.points / (stats.played * 3)) * 100)
      : 0;

    return stats;
  });

  standings.sort((a,b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor
  );

  const scorers = scorerCounts();

  const goalMax = Math.max(
    1,
    ...standings.map(s => s.goalsFor),
    ...standings.map(s => s.goalsAgainst)
  );

  const safeColor = color =>
    /^#[0-9a-f]{3,8}$/i.test(color || '')
      ? color
      : '#75a88a';

  const rankingRows = standings.length
    ? standings.map((s,i) => `
        <div class="rank-row">
          <span class="rank-meta">${i + 1}º</span>
          <span class="rank-name">${esc(s.team.name)}</span>
          <b>${s.points} pts</b>
        </div>
      `).join('')
    : '<div class="empty-state">Nenhum time cadastrado.</div>';

  const standingsRows = standings.length
    ? standings.map((s,i) => `
        <tr>
          <td><b>${i + 1}º ${esc(s.team.name)}</b></td>
          <td>${s.played}</td>
          <td>${s.wins}</td>
          <td>${s.draws}</td>
          <td>${s.losses}</td>
          <td>${s.goalsFor}</td>
          <td>${s.goalsAgainst}</td>
          <td>${s.goalDifference > 0 ? '+' : ''}${s.goalDifference}</td>
          <td><b>${s.points}</b></td>
          <td>${s.performance}%</td>
        </tr>
      `).join('')
    : '<tr><td colspan="10">Nenhum time cadastrado.</td></tr>';

  const performanceRows = standings.length
    ? standings.map(s => `
        <div class="rank-row" style="display:block;padding:14px 0">
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px">
            <b>${esc(s.team.name)}</b>
            <b>${s.performance}%</b>
          </div>
          <div style="height:9px;background:var(--border,#e5e5e5);border-radius:20px;overflow:hidden">
            <div style="height:100%;width:${s.performance}%;background:${safeColor(s.team.color)};border-radius:20px"></div>
          </div>
          <div class="rank-meta" style="margin-top:7px">
            ${s.wins} vitórias · ${s.draws} empates · ${s.losses} derrotas
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">Nenhum time cadastrado.</div>';

  const goalRows = standings.length
    ? standings.map(s => `
        <div class="rank-row" style="display:block;padding:14px 0">
          <b>${esc(s.team.name)}</b>

          <div style="display:flex;justify-content:space-between;margin:9px 0 5px">
            <span class="rank-meta">Gols marcados</span>
            <b>${s.goalsFor}</b>
          </div>
          <div style="height:8px;background:var(--border,#e5e5e5);border-radius:20px;overflow:hidden">
            <div style="height:100%;width:${(s.goalsFor / goalMax) * 100}%;background:${safeColor(s.team.color)}"></div>
          </div>

          <div style="display:flex;justify-content:space-between;margin:9px 0 5px">
            <span class="rank-meta">Gols sofridos</span>
            <b>${s.goalsAgainst}</b>
          </div>
          <div style="height:8px;background:var(--border,#e5e5e5);border-radius:20px;overflow:hidden">
            <div style="height:100%;width:${(s.goalsAgainst / goalMax) * 100}%;background:#c77b72"></div>
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">Nenhum time cadastrado.</div>';

  const recentMatches = finished.length
    ? finished.slice(0,6).map(m => {
        const teamA = state.teams.find(t => t.id === m.team_a);
        const teamB = state.teams.find(t => t.id === m.team_b);

        return `
          <div class="rank-row">
            <span class="rank-name">
              ${esc(teamA?.name || 'Time A')}
            </span>
            <b>${Number(m.score_a || 0)} x ${Number(m.score_b || 0)}</b>
            <span class="rank-name">
              ${esc(teamB?.name || 'Time B')}
            </span>
          </div>
          <div class="rank-meta" style="padding:0 0 10px">
            ${m.date ? new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
          </div>
        `;
      }).join('')
    : '<div class="empty-state">Nenhuma partida finalizada ainda.</div>';

  const discipline = state.cards.length
    ? state.cards.map(c => `
        <div class="rank-row">
          <span>${c.type === 'red' ? '🟥' : '🟨'}</span>
          <span class="rank-name">
            ${esc(state.athletes.find(a => a.id === c.athlete_id)?.name || 'Atleta')}
          </span>
          <span class="rank-meta">
            ${c.type === 'red' ? 'Vermelho' : 'Amarelo'}
          </span>
        </div>
      `).join('')
    : '<div class="empty-state">Nenhum cartão registrado.</div>';

  $('#appContent').innerHTML =
    pageHeader(
      'DESEMPENHO',
      'Estatísticas',
      'Números, classificação e destaques do BABA HUMILDES.'
    ) +

    `
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">PARTIDAS</div>
        <div class="stat-value">${finished.length}</div>
        <div class="stat-icon">◷</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">GOLS MARCADOS</div>
        <div class="stat-value">${totalGoals}</div>
        <div class="stat-icon">⚽</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">CARTÕES AMARELOS</div>
        <div class="stat-value">${yellows}</div>
        <div class="stat-icon">🟨</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">CARTÕES VERMELHOS</div>
        <div class="stat-value">${reds}</div>
        <div class="stat-icon">🟥</div>
      </div>
    </section>

    <div class="panel" style="margin-bottom:20px">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">CAMPEONATO</span>
          <h2>Classificação</h2>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TIME</th>
              <th>J</th>
              <th>V</th>
              <th>E</th>
              <th>D</th>
              <th>GP</th>
              <th>GC</th>
              <th>SG</th>
              <th>PTS</th>
              <th>APR.</th>
            </tr>
          </thead>
          <tbody>
            ${standingsRows}
          </tbody>
        </table>
      </div>

      <div class="rank-meta" style="padding:12px">
        Vitória: 3 pontos · Empate: 1 ponto · Derrota: 0 pontos
      </div>
    </div>

    <div class="section-grid">
      <div class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">DESEMPENHO</span>
            <h2>Aproveitamento</h2>
          </div>
        </div>
        ${performanceRows}
      </div>

      <div class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">ATAQUE E DEFESA</span>
            <h2>Gols dos times</h2>
          </div>
        </div>
        ${goalRows}
      </div>
    </div>

    <div class="section-grid" style="margin-top:20px">
      <div class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">RANKING</span>
            <h2>Artilheiros</h2>
          </div>
        </div>
        ${scorerList(50)}
      </div>

      <div class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">RESULTADOS</span>
            <h2>Últimas partidas</h2>
          </div>
        </div>
        ${recentMatches}
      </div>
    </div>

    <div class="panel" style="margin-top:20px">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">DISCIPLINA</span>
          <h2>Cartões</h2>
        </div>
      </div>
      ${discipline}
    </div>
    `;
}




function renderFinance(selectedCompetence = '', searchTerm = ''){
  const monthlyFee = 25;

  const now = new Date();
  const currentMonth =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0');

  const competences = [...new Set([
    '2027-01',
    ...state.payments
      .map(p => p.competence)
      .filter(Boolean),
    ...(currentMonth >= '2027-01' ? [currentMonth] : [])
  ])].sort((a,b) => b.localeCompare(a));

  const competence = competences.includes(selectedCompetence)
    ? selectedCompetence
    : (competences.includes(currentMonth) ? currentMonth : '2027-01');

  const paymentsOfMonth = state.payments.filter(
    p => p.competence === competence
  );

  const paid = paymentsOfMonth.filter(p => p.status === 'paid');

  const pendingPayments = paymentsOfMonth.filter(
    p => p.status !== 'paid'
  );

  const paidTotal = paid.reduce(
    (sum,p) => sum + Number(p.amount || 0), 0
  );

  const pendingTotal = pendingPayments.reduce(
    (sum,p) => sum + Number(p.amount || 0), 0
  );

  const expectedTotal = state.athletes.length * monthlyFee;

  const paidCount = paid.length;

  const awaitingCount = state.athletes.filter(a =>
    !paymentsOfMonth.some(p => p.athlete_id === a.id)
  ).length;

  const percentage = state.athletes.length
    ? Math.round((paidCount / state.athletes.length) * 100)
    : 0;

  const monthLabel = competence.split('-').reverse().join('/');

  const action = session
    ? '<button class="btn-primary" id="addPayment">+ Registrar pagamento</button>'
    : '';

  const athleteRows = state.athletes.map(a => {
    const payment = paymentsOfMonth.find(
      p => p.athlete_id === a.id
    );

    const name = a.name || 'Atleta';
    const dueDate = payment?.due_date || competence + '-10';

    const formattedDate = new Date(
      dueDate + 'T12:00:00'
    ).toLocaleDateString('pt-BR');

    let statusLabel;
    let statusClass;

    if(payment){
      statusLabel = payment.status === 'paid'
        ? 'Pago'
        : 'Pendente';

      statusClass = payment.status === 'paid'
        ? ''
        : 'pending';
    }else if(competence > currentMonth){
      statusLabel = 'Aguardando cobrança';
      statusClass = 'pending';
    }else{
      statusLabel = 'Cobrança não gerada';
      statusClass = 'pending';
    }

    return {
      athlete: a,
      payment,
      name,
      dueDate: formattedDate,
      statusLabel,
      statusClass
    };
  });

  // Organiza os atletas por time.
  const teamGroups = state.teams.map(team => ({
    team,
    rows: athleteRows.filter(
      item => item.athlete.team_id === team.id
    )
  }));

  // Não deixa atletas sem time desaparecerem.
  const unassignedRows = athleteRows.filter(item =>
    !state.teams.some(team => team.id === item.athlete.team_id)
  );

  if(unassignedRows.length){
    teamGroups.push({
      team: {
        id: 'no-team',
        name: 'Sem time',
        color: '#888888',
        badge: '?'
      },
      rows: unassignedRows
    });
  }

  const renderTeamBlock = group => {
    const team = group.team;
    const rows = group.rows;

    const teamColor = /^#[0-9a-f]{3,8}$/i.test(team.color || '')
      ? team.color
      : 'var(--primary,#75a88a)';

    const teamPaid = rows.filter(
      item => item.payment?.status === 'paid'
    );

    const teamPending = rows.filter(
      item => item.payment && item.payment.status !== 'paid'
    );

    const teamAwaiting = rows.filter(
      item => !item.payment
    );

    const teamPaidTotal = teamPaid.reduce(
      (sum,item) => sum + Number(item.payment.amount || 0), 0
    );

    const teamPendingTotal = teamPending.reduce(
      (sum,item) => sum + Number(item.payment.amount || 0), 0
    );

    const teamRowsHTML = rows.length
      ? rows.map(item => `
          <tr data-finance-row>
            <td><b>${esc(item.name)}</b></td>
            <td>${money(item.payment?.amount ?? monthlyFee)}</td>
            <td>${item.dueDate}</td>
            <td>
              <span class="pill ${item.statusClass}">
                ${item.statusLabel}
              </span>
            </td>

            ${session ? `
              <td>
                ${item.payment ? `
                  <button class="btn-secondary"
                    data-edit-payment="${item.payment.id}">
                    Editar
                  </button>

                  <button class="btn-secondary"
                    data-delete-payment="${item.payment.id}">
                    Excluir
                  </button>
                ` : '<span class="rank-meta">—</span>'}
              </td>
            ` : ''}
          </tr>
        `).join('')
      : `
          <tr>
            <td colspan="${session ? 5 : 4}" class="empty-table">
              Nenhum atleta cadastrado neste time.
            </td>
          </tr>
        `;

    return `
      <div class="panel finance-team-block"
        data-finance-team
        style="border-top:4px solid ${teamColor};min-width:0">

        <div class="panel-heading">
          <div>
            <span class="eyebrow">EQUIPE</span>
            <h2 style="color:${teamColor}">
              ${esc(team.name)}
            </h2>
            <div class="rank-meta">
              ${rows.length} atleta(s)
            </div>
          </div>

          <div class="team-badge"
            style="background:${teamColor};color:#fff;width:44px;height:44px">
            ${team.logo_url
              ? `<img src="${esc(team.logo_url)}"
                  alt="Escudo ${esc(team.name)}"
                  style="width:100%;height:100%;object-fit:contain">`
              : esc(team.badge || team.name.slice(0,1))}
          </div>
        </div>

        <div class="stats-grid" style="margin:15px 0">
          <div class="stat-card">
            <div class="stat-label">RECEBIDO</div>
            <div class="stat-value" style="font-size:19px">
              ${money(teamPaidTotal)}
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-label">PENDENTE</div>
            <div class="stat-value" style="font-size:19px">
              ${money(teamPendingTotal)}
            </div>
          </div>
        </div>

        <div class="rank-meta" style="margin-bottom:14px">
          ${teamPaid.length} pagos ·
          ${teamPending.length} pendentes ·
          ${teamAwaiting.length} aguardando cobrança
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ATLETA</th>
                <th>VALOR</th>
                <th>VENCIMENTO</th>
                <th>STATUS</th>
                ${session ? '<th>AÇÕES</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${teamRowsHTML}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  const teamBlocksHTML = teamGroups.length
    ? teamGroups.map(renderTeamBlock).join('')
    : '<div class="notice">Nenhum time ou atleta cadastrado.</div>';

  $('#appContent').innerHTML =
    pageHeader(
      'CONTRIBUIÇÕES',
      'Financeiro',
      'Controle e transparência das mensalidades.',
      action
    ) +

    `
    <section class="stats-grid">

      <div class="stat-card">
        <div class="stat-label">TOTAL RECEBIDO</div>
        <div class="stat-value" style="font-size:24px">
          ${money(paidTotal)}
        </div>
        <div class="stat-icon">💰</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">EM ABERTO</div>
        <div class="stat-value" style="font-size:24px">
          ${money(pendingTotal)}
        </div>
        <div class="stat-icon">◷</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">TOTAL PREVISTO</div>
        <div class="stat-value" style="font-size:24px">
          ${money(expectedTotal)}
        </div>
        <div class="stat-icon">📊</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">ATLETAS EM DIA</div>
        <div class="stat-value">${paidCount}</div>
        <div class="stat-icon">✓</div>
      </div>

    </section>

    <div class="panel" style="margin-bottom:20px">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">ACOMPANHAMENTO</span>
          <h2>Arrecadação de ${monthLabel}</h2>
        </div>
        <b>${percentage}%</b>
      </div>

      <div style="height:12px;background:var(--border,#e5e5e5);border-radius:20px;overflow:hidden">
        <div style="height:100%;width:${percentage}%;background:var(--primary,#75a88a);border-radius:20px"></div>
      </div>

      <div class="rank-meta" style="margin-top:12px">
        ${paidCount} pagos ·
        ${pendingPayments.length} pendentes ·
        ${awaitingCount} aguardando cobrança
      </div>
    </div>

    <div class="notice">
      Mensalidade de R$ 25,00 por atleta, com vencimento todo dia 10.
      Primeira cobrança em janeiro de 2027.
      Todos os atletas aparecem na consulta financeira.
    </div>

    <div class="panel" style="margin-bottom:20px">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">CONSULTA</span>
          <h2>Mensalidades por time</h2>
        </div>
      </div>

      <div class="form-grid" style="margin-bottom:18px">

        <div class="field">
          <label>Competência</label>
          <select id="financeCompetence">
            ${competences.map(c => `
              <option value="${c}" ${c === competence ? 'selected' : ''}>
                ${c.split('-').reverse().join('/')}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="field">
          <label>Buscar atleta</label>
          <input
            type="search"
            id="financeSearch"
            placeholder="Digite o nome do atleta..."
            value="${esc(searchTerm)}"
          >
        </div>

      </div>
    </div>

    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));
      gap:20px;
      align-items:start;
    ">
      ${teamBlocksHTML}
    </div>
    `;

  const competenceSelect = document.querySelector('#financeCompetence');
  const searchInput = document.querySelector('#financeSearch');

  competenceSelect.onchange = () => {
    renderFinance(competenceSelect.value, searchInput.value);
  };

  const applyFinanceSearch = () => {
    const term = searchInput.value.trim().toLowerCase();

    document.querySelectorAll('[data-finance-team]').forEach(teamBlock => {
      const rows = teamBlock.querySelectorAll('[data-finance-row]');
      let visibleRows = 0;

      rows.forEach(row => {
        const matches = row.textContent.toLowerCase().includes(term);
        row.style.display = matches ? '' : 'none';

        if(matches) visibleRows++;
      });

      teamBlock.style.display =
        term && visibleRows === 0 ? 'none' : '';
    });
  };

  searchInput.oninput = applyFinanceSearch;
  applyFinanceSearch();

  if(session){
    $('#addPayment').onclick = () => paymentForm();

    document.querySelectorAll('[data-edit-payment]').forEach(button => {
      button.onclick = () => paymentForm(button.dataset.editPayment);
    });

    document.querySelectorAll('[data-delete-payment]').forEach(button => {
      button.onclick = async () => {
        const paymentId = button.dataset.deletePayment;

        const confirmed = confirm(
          'Tem certeza que deseja excluir esta mensalidade? Essa ação não poderá ser desfeita.'
        );

        if(!confirmed) return;

        try {
          await save('payments', {id: paymentId}, true);
          notify('Mensalidade excluída com sucesso!');
          renderPage('financeiro');
        } catch(err) {
          notify(err.message);
        }
      };
    });
  }
}






function paymentForm(paymentId = ''){
  const existing = paymentId
    ? state.payments.find(p => p.id === paymentId)
    : null;

  if(paymentId && !existing){
    notify('Pagamento não encontrado.');
    return;
  }

  const editing = Boolean(existing);

  const athleteOptions = state.athletes.map(a => `
    <option value="${a.id}"
      ${existing?.athlete_id === a.id ? 'selected' : ''}>
      ${esc(a.name)}
    </option>
  `).join('');

  showEdit(`
    <h2>${editing ? 'Editar pagamento' : 'Registrar pagamento'}</h2>
    <p>${editing
      ? 'Corrija o valor ou o status da mensalidade.'
      : 'Confirme ou atualize a mensalidade do atleta.'
    }</p>

    <form id="paymentForm">
      <div class="field">
        <label>Atleta</label>
        <select name="athlete_id" required ${editing ? 'disabled' : ''}>
          ${athleteOptions}
        </select>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Competência</label>
          <input type="month" name="competence"
            value="${existing?.competence || '2027-01'}"
            min="2027-01" required ${editing ? 'disabled' : ''}>
        </div>

        <div class="field">
          <label>Valor (R$)</label>
          <input type="number" name="amount"
            step="0.01" min="0.01"
            value="${existing?.amount ?? 25}" required>
        </div>

        ${!editing ? `
          <div class="field">
            <label>Forma</label>
            <select name="method">
              <option>Pix</option>
              <option>Dinheiro</option>
              <option>Transferência</option>
              <option>Outro</option>
            </select>
          </div>
        ` : ''}

        <div class="field">
          <label>Status</label>
          <select name="status">
            <option value="paid"
              ${existing?.status === 'paid' ? 'selected' : ''}>
              Pago
            </option>
            <option value="pending"
              ${existing?.status !== 'paid' ? 'selected' : ''}>
              Pendente
            </option>
          </select>
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>
          Cancelar
        </button>
        <button class="btn-primary">
          ${editing ? 'Salvar alterações' : 'Salvar pagamento'}
        </button>
      </div>
    </form>
  `);

  $('#paymentForm').onsubmit = async e => {
    e.preventDefault();

    const f = new FormData(e.target);
    const athleteId = editing
      ? existing.athlete_id
      : f.get('athlete_id');

    const competence = editing
      ? existing.competence
      : f.get('competence');

    const status = f.get('status');

    const duplicate = !editing && state.payments.some(p =>
      p.athlete_id === athleteId &&
      p.competence === competence
    );

    if(duplicate){
      notify('Já existe uma mensalidade para esse atleta e competência.');
      return;
    }

    const payment = {
      id: editing ? existing.id : id(),
      athlete_id: athleteId,
      amount: Number(f.get('amount')),
      status,
      paid_at: status === 'paid'
        ? new Date().toISOString()
        : null,
      competence,
      due_date: competence + '-10'
    };

    if(!editing){
      payment.reference = 'Mensalidade do baba';
      payment.method = f.get('method');
      payment.created_at = new Date().toISOString();
    }

    try {
      await save('payments', payment);

      $('#editDialog').close();
      notify(editing
        ? 'Pagamento atualizado com sucesso!'
        : 'Mensalidade salva com sucesso!'
      );
      renderPage('financeiro');

    } catch(err) {
      notify(err.message);
    }
  };
}


function showEdit(html){$('#editDialogBody').innerHTML=html;$('#editDialog').showModal();$('#editDialogBody').querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#editDialog').close());}

async function adminAction(){
  if(demo){
    showAdminSetup();
    return;
  }

  if(session && isAdmin){
    if(confirm('Deseja sair da área administrativa?')){
      await db.auth.signOut();
    }
    return;
  }

  if(session && !isAdmin){
    notify('Você está conectado como atleta.');
    return;
  }

  showLogin();
}


async function athleteAction(){
  if(demo || !db){
    notify('Configure o Supabase para acessar a Área do Atleta.');
    return;
  }

  if(!session){
    showAthleteOptions();
    return;
  }

  if(!currentAthlete){
    const {data:account, error} = await db
      .from('athlete_accounts')
      .select('athlete_id')
      .eq('user_id', session.user.id)
      .single();

    if(error || !account){
      notify('Não foi possível identificar o atleta conectado.');
      return;
    }

    currentAthlete = state.athletes.find(
      a => a.id === account.athlete_id
    );
  }

  if(!currentAthlete){
    notify('Atleta não encontrado na lista.');
    return;
  }

  renderAthleteDashboard(currentAthlete);
}

function athleteOptionsHtml(selectedId=''){
  return state.athletes.map(a=>`
    <option value="${esc(a.id)}" ${a.id===selectedId?'selected':''}>
      ${esc(a.name)}
    </option>
  `).join('');
}

function showAthleteOptions(){
  showAdmin(`
    <h2>Área do Atleta</h2>
    <p>Bem-vindo ao espaço dos atletas do BABA HUMILDES.</p>

    <div class="modal-actions">
      <button class="btn-primary" id="athleteFirstAccess">
        Primeiro acesso
      </button>
      <button class="btn-primary" id="athleteExistingAccess">
        Já tenho uma conta
      </button>
    </div>
  `);

  $('#athleteFirstAccess').onclick=showAthleteRegister;
  $('#athleteExistingAccess').onclick=()=>showAthleteLogin();
}


function renderAthleteDashboard(athlete){
  const team = state.teams.find(t => t.id === athlete.team_id);

  const goals = state.goals.filter(
    g => g.athlete_id === athlete.id
  ).length;

  const cards = state.cards.filter(
    c => c.athlete_id === athlete.id
  ).length;

  const now = new Date();

  
const upcomingMatches = state.matches
  .filter(match => {
    const matchDate = new Date(
      `${match.date}T${match.time || '00:00:00'}`
    );

    return match.status === 'Agendada' && matchDate >= now;
  })
  .sort((a, b) => {
    return new Date(`${a.date}T${a.time || '00:00:00'}`) -
           new Date(`${b.date}T${b.time || '00:00:00'}`);
  })
  .slice(0, 1);


  currentPage = 'atleta';
  setTitle('Área do Atleta');

  const attendanceHtml = upcomingMatches.length
    ? upcomingMatches.map(match => {
        const response = state.attendance_confirmations.find(
          item =>
            item.athlete_id === athlete.id &&
            item.match_id === match.id
        );

        const teamA = state.teams.find(t => t.id === match.team_a);
        const teamB = state.teams.find(t => t.id === match.team_b);

        const matchDate = new Date(
          `${match.date}T${match.time || '00:00:00'}`
        );

        const dateLabel = matchDate.toLocaleDateString('pt-BR');
        const timeLabel = match.time
          ? String(match.time).slice(0, 5)
          : '';

        return `
          <div class="card" style="padding:18px;margin-bottom:14px;">
            
<div style="display:flex;align-items:center;justify-content:center;gap:28px;margin:18px 0;text-align:center;">

  <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
    ${
      teamA?.logo_url
        ? `<img src="${esc(teamA.logo_url)}" alt="Escudo ${esc(teamA.name)}" style="width:65px;height:65px;object-fit:contain;">`
        : '<span>⚽</span>'
    }
    <strong>${esc(teamA?.name || 'Time A')}</strong>
  </div>

  <strong style="font-size:22px;">×</strong>

  <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
    ${
      teamB?.logo_url
        ? `<img src="${esc(teamB.logo_url)}" alt="Escudo ${esc(teamB.name)}" style="width:65px;height:65px;object-fit:contain;">`
        : '<span>⚽</span>'
    }
    <strong>${esc(teamB?.name || 'Time B')}</strong>
  </div>

</div>


            <p>
              <strong>Data:</strong> ${dateLabel}
              ${timeLabel ? ` às ${timeLabel}` : ''}
            </p>

            <p>
              <strong>Minha resposta:</strong>
              ${
                response?.status === 'confirmed'
                  ? 'Presença confirmada'
                  : response?.status === 'declined'
                    ? 'Não vou comparecer'
                    : 'Ainda não respondi'
              }
            </p>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
              <button
                class="btn-primary"
                data-attendance="confirmed"
                data-match-id="${esc(match.id)}">
                Confirmar presença
              </button>

              <button
                class="btn-primary"
                data-attendance="declined"
                data-match-id="${esc(match.id)}">
                Não vou
              </button>
            </div>
          </div>
        `;
      }).join('')
    : '<p>Não existem partidas futuras agendadas no momento.</p>';

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">BABA HUMILDES</div>
        <h1>Olá, ${esc(athlete.name)}!</h1>
        <p>Bem-vindo à sua área pessoal.</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:20px 0;">
      
<div class="card" style="padding:20px;">
  <h3>Meu time</h3>

  <div style="display:flex;align-items:center;gap:12px;">
    ${
      team?.logo_url
        ? `<img src="${esc(team.logo_url)}" alt="Escudo ${esc(team.name)}" style="width:48px;height:48px;object-fit:contain;">`
        : ''
    }
    <strong>${esc(team?.name || 'Sem time definido')}</strong>
  </div>
</div>


      <div class="card" style="padding:20px;">
        <h3>Camisa</h3>
        <p>${athlete.number ?? 'Não definido'}</p>
      </div>

      <div class="card" style="padding:20px;">
        <h3>Gols</h3>
        <p>${goals}</p>
      </div>

      <div class="card" style="padding:20px;">
        <h3>Cartões</h3>
        <p>${cards}</p>
      </div>
    </div>

    <div class="card" style="padding:20px;margin-top:20px;">
      <h2>Meu perfil</h2>
      <p><strong>Nome:</strong> ${esc(athlete.name)}</p>
      <p><strong>Posição:</strong> ${esc(athlete.position || 'Não definida')}</p>
      <p><strong>Número:</strong> ${athlete.number ?? 'Não definido'}</p>
      <p><strong>Time:</strong> ${esc(team?.name || 'Não definido')}</p>
    </div>

    <div style="margin-top:24px;">
      <h2>Confirmação de presença</h2>
      <p>Informe se você vai participar das próximas partidas.</p>
      ${attendanceHtml}
    </div>

    <div style="margin-top:24px;">
      <button class="btn-primary" id="athleteLogout">
        Sair da minha conta
      </button>
    </div>
  `;

  document.querySelectorAll('[data-attendance]').forEach(button => {
    button.onclick = async () => {
      const matchId = button.dataset.matchId;
      const status = button.dataset.attendance;

      button.disabled = true;

      const { data, error } = await db
        .from('attendance_confirmations')
        .upsert(
          {
            athlete_id: athlete.id,
            match_id: matchId,
            status: status
          },
          {
            onConflict: 'athlete_id,match_id'
          }
        )
        .select()
        .single();

      if(error){
        console.error(error);
        notify('Não foi possível registrar sua resposta.');
        button.disabled = false;
        return;
      }

      const index = state.attendance_confirmations.findIndex(
        item =>
          item.athlete_id === athlete.id &&
          item.match_id === matchId
      );

      if(index >= 0){
        state.attendance_confirmations[index] = data;
      } else {
        state.attendance_confirmations.push(data);
      }

      notify(
        status === 'confirmed'
          ? 'Presença confirmada!'
          : 'Resposta registrada: você não vai.'
      );

      renderAthleteDashboard(athlete);
    };
  });

  $('#athleteLogout').onclick = async () => {
    if(confirm('Deseja sair da sua conta?')){
      await db.auth.signOut();
      await updateAdminStatus();
      renderPage('inicio');
      notify('Você saiu da sua conta.');
    }
  };
}



function showAthleteRegister(){
  if(!state.athletes.length){
    notify('Nenhum atleta cadastrado.');
    return;
  }

  showAdmin(`
    <h2>Primeiro acesso</h2>
    <p>Selecione seu nome e crie uma senha.</p>

    <form id="athleteRegisterForm">
      <div class="field">
        <label>Seu nome</label>
        <select name="athlete_id" required>
          <option value="">Selecione seu nome</option>
          ${athleteOptionsHtml()}
        </select>
      </div>

      <div class="field">
        <label>Crie sua senha</label>
        <input type="password" name="password"
          minlength="8" required>
      </div>

      <div class="field">
        <label>Confirme sua senha</label>
        <input type="password" name="confirmPassword"
          minlength="8" required>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-primary"
          id="backAthleteOptions">Voltar</button>
        <button class="btn-primary">Criar minha conta</button>
      </div>
    </form>
  `);

  $('#backAthleteOptions').onclick=showAthleteOptions;

  $('#athleteRegisterForm').onsubmit=async e=>{
    e.preventDefault();

    const f=new FormData(e.target);
    const athleteId=f.get('athlete_id');
    const password=f.get('password');
    const confirmPassword=f.get('confirmPassword');

    if(password!==confirmPassword){
      notify('As senhas não são iguais.');
      return;
    }

    try{
      const {data,error}=await db.functions.invoke(
        'register-athlete',
        {body:{athlete_id:athleteId,password}}
      );

      if(error){
        console.error(error);
        notify(data?.error||error.message);
        return;
      }

      if(data?.error){
        notify(data.error);
        return;
      }

      notify('Cadastro realizado com sucesso!');
      showAthleteLogin(athleteId);

    }catch(error){
      console.error(error);
      notify('Erro ao realizar cadastro.');
    }
  };
}


function showAthleteLogin(selectedId=''){
  if(!state.athletes.length){
    notify('Nenhum atleta cadastrado.');
    return;
  }

  showAdmin(`
    <h2>Login do Atleta</h2>
    <p>Entre com seu nome e sua senha.</p>

    <form id="athleteLoginForm">
      <div class="field">
        <label>Seu nome</label>
        <select name="athlete_id" required>
          <option value="">Selecione seu nome</option>
          ${athleteOptionsHtml(selectedId)}
        </select>
      </div>

      <div class="field">
        <label>Senha</label>
        <input type="password" name="password" required>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-primary"
          id="backAthleteOptions">Voltar</button>
        <button class="btn-primary">Entrar</button>
      </div>
    </form>
  `);

  $('#backAthleteOptions').onclick=showAthleteOptions;

  $('#athleteLoginForm').onsubmit=async e=>{
    e.preventDefault();

    const f=new FormData(e.target);
    const athleteId=f.get('athlete_id');
    const email=`athlete-${athleteId}@login.babahumildes.com`;

    const {data,error}=await db.auth.signInWithPassword({
      email,
      password:f.get('password')
    });

    if(error){
      notify('Nome ou senha incorretos.');
      return;
    }

    session=data.session;
    await updateAdminStatus();

    const {data:account,error:accountError}=await db
      .from('athlete_accounts')
      .select('athlete_id')
      .eq('user_id',session.user.id)
      .single();

    if(accountError || !account){
      notify('Não foi possível identificar seu cadastro.');
      await db.auth.signOut();
      return;
    }

    const athlete=state.athletes.find(
      a=>a.id===account.athlete_id
    );

    if(!athlete){
      notify('Atleta não encontrado.');
      return;
    }

    $('#adminDialog').close();
    currentAthlete = athlete;
    renderAthleteDashboard(athlete);
  };
}




function showAdmin(html){
  $('#adminDialogBody').innerHTML = html;
  $('#adminDialog').showModal();
}
function showPasswordReset(){
  showAdmin(`
    <h2>Redefinir senha</h2>
    <p>Cadastre uma nova senha para sua conta administrativa.</p>

    <form id="passwordResetForm">
      <div class="field">
        <label>Nova senha</label>
        <input type="password" name="password" minlength="8" required>
      </div>

      <div class="field">
        <label>Confirmar nova senha</label>
        <input type="password" name="confirmPassword" minlength="8" required>
      </div>

      <div class="modal-actions">
        <button type="submit" class="btn-primary">Salvar nova senha</button>
      </div>
    </form>
  `);

  $('#passwordResetForm').onsubmit = async e => {
    e.preventDefault();

    const f = new FormData(e.target);
    const password = f.get('password');
    const confirmPassword = f.get('confirmPassword');

    if(password !== confirmPassword){
      notify('As senhas não são iguais.');
      return;
    }

    const {error} = await db.auth.updateUser({password});

    if(error){
      notify('Não foi possível alterar a senha: ' + error.message);
      return;
    }

    notify('Senha alterada com sucesso!');
    $('#adminDialog').close();
  };
}
function showLogin(){
  showAdmin(`
    <h2>Área administrativa</h2>
    <p>Entre com seu e-mail e sua senha.</p>

    <form id="adminLoginForm">
      <div class="field">
        <label>E-mail</label>
        <input type="email" name="email" autocomplete="username" required>
      </div>

      <div class="field">
        <label>Senha</label>
        <input type="password" name="password" autocomplete="current-password" required>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Entrar</button>
      </div>
    </form>
  `);

  $('#adminLoginForm').onsubmit = async e => {
    e.preventDefault();

    const f = new FormData(e.target);

    const {data, error} = await db.auth.signInWithPassword({
      email: f.get('email'),
      password: f.get('password')
    });

    if(error){
      notify('E-mail ou senha incorretos.');
      return;
    }

    session = data.session;

    const {data:isAdminUser, error:adminError} =
      await db.rpc('is_admin');

    if(adminError || isAdminUser !== true){
      await db.auth.signOut();
      session = null;
      currentAthlete = null;
      await updateAdminStatus();
      notify('Esta conta não possui acesso administrativo.');
      return;
    }

    isAdmin = true;
    currentAthlete = null;
    await updateAdminStatus();
    $('#adminDialog').close();
    renderPage('inicio');
    notify('Login administrativo realizado!');
  };
}


init().catch(e=>{
  console.error(e);
  notify('Não foi possível iniciar o sistema.');
});