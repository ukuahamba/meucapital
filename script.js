const SUPABASE_URL="https://ozwyxcuhhujnhymwqgjb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_vGMyphDHDA6K1ZoI3anfhQ_rKnM_SzM";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let currentUser=null;
let pendingSignupEmail="";
let pendingSignupPassword="";
let pendingSignupName="";
let KEY="meucapital-v5";
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat("pt-AO").format(Math.round(Number(n)||0));
const money=n=>fmt(n)+" "+(state.currency||"Kz");

/* =========================
   MeuCapital V5 — Auth
   ========================= */
const authScreen=$("authScreen");
const authMessage=$("authMessage");
const setAuthMessage=(msg,error=false)=>{
  authMessage.textContent=msg||"";
  authMessage.classList.toggle("error",!!error);
};
const authView=(view)=>{
  ["authLoginView","authSignupView","authOtpView","authResetView"].forEach(id=>$(id).classList.add("hidden"));
  $(view).classList.remove("hidden");
  setAuthMessage("");
};
const showApp=(user)=>{
  currentUser=user;
  document.body.classList.remove("auth-locked");
  authScreen.classList.add("hidden");
  const email=user?.email||"";
  const suggested=(user?.user_metadata?.full_name||email.split("@")[0]||"Utilizador").trim();
  if(!state || !state.userName || state.userName==="Letal" || state.userName==="Utilizador") state.userName=suggested;
  save();
  const userEl=document.querySelector(".user");
  if(userEl) userEl.innerHTML=`<span class="user-greeting">Olá,</span> <b>${escapeHtml(state.userName)}</b>`;
  renderTopAvatar();
  const greetEl=$("dashboardGreeting");
  if(greetEl) greetEl.textContent=`Bem-vindo, ${state.userName}. Aqui tens uma visão clara do teu capital e do teu mês.`;
  renderDashboard(); renderHistory(); renderProfile();
  void syncWalletFromCloud(user);
};
const showAuth=()=>{
  currentUser=null;
  document.body.classList.add("auth-locked");
  authScreen.classList.remove("hidden");
};
const escapeHtml=(s)=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const withTimeout=(promise,ms)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("TIMEOUT")),ms))]);
function buttonBusy(btn,busy,label){
  if(!btn)return;
  if(busy){
    btn.dataset.originalText=btn.innerHTML;
    btn.disabled=true;
    btn.classList.add("is-loading","is-pressed");
    btn.innerHTML=`<span class="btn-spinner" aria-hidden="true"></span><span>${label||"A processar..."}</span>`;
  }else{
    btn.disabled=false;
    btn.classList.remove("is-loading","is-pressed");
    if(btn.dataset.originalText) btn.innerHTML=btn.dataset.originalText;
  }
}
function flashButton(btn){
  if(!btn)return;
  btn.classList.remove("is-pressed");
  void btn.offsetWidth;
  btn.classList.add("is-pressed");
  setTimeout(()=>btn.classList.remove("is-pressed"),420);
  if(navigator.vibrate) navigator.vibrate(12);
}
const setAccountStorage=(user)=>{
  if(!user)return;
  KEY=`meucapital-v5:${user.id}`;
  const raw=localStorage.getItem(KEY);
  state=raw?JSON.parse(raw):structuredClone(defaults);
  if(user.user_metadata?.full_name && (!state.userName || state.userName==="Letal" || state.userName==="Utilizador")) state.userName=user.user_metadata.full_name;
};
const bootAuth=async()=>{
  await handlePasswordRecovery();
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session){
    setAccountStorage(session.user);
    showApp(session.user);
  } else {
    showAuth();
  }
};

$("showSignup").onclick=()=>authView("authSignupView");
$("showReset").onclick=()=>authView("authResetView");
$("backToLoginFromSignup").onclick=()=>authView("authLoginView");
$("backToLoginFromReset").onclick=()=>authView("authLoginView");

$("loginForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const btn=e.currentTarget.querySelector("button[type=submit]");
  flashButton(btn);
  buttonBusy(btn,true,"A entrar...");
  setAuthMessage("A entrar...");
  const email=$("loginEmail").value.trim();
  const password=$("loginPassword").value;
  try{
    const {error}=await withTimeout(supabaseClient.auth.signInWithPassword({email,password}),12000);
    if(error) setAuthMessage(error.message||"Não foi possível entrar.",true);
  }catch(err){
    setAuthMessage(err?.message==="TIMEOUT"?"O servidor está a demorar. Verifica a ligação e tenta novamente.":"Não foi possível entrar.",true);
  }finally{buttonBusy(btn,false);}
});

$("signupForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const btn=e.currentTarget.querySelector("button[type=submit]");
  flashButton(btn);
  buttonBusy(btn,true,"A criar conta...");
  setAuthMessage("A criar a tua conta...");
  const name=$("signupName").value.trim();
  const email=$("signupEmail").value.trim();
  const password=$("signupPassword").value;
  try{
    const {data,error}=await withTimeout(supabaseClient.auth.signUp({
      email,password,
      options:{data:{full_name:name},emailRedirectTo:window.location.href.split("#")[0]}
    }),12000);
    if(error){ setAuthMessage(error.message||"Não foi possível criar a conta.",true); return; }
    if(data.session){setAuthMessage("Conta criada. A entrar...");return;}
    pendingSignupEmail=email; pendingSignupPassword=password; pendingSignupName=name;
    $("otpEmailLabel").textContent=email; $("signupOtp").value=""; authView("authOtpView");
    setAuthMessage("Código enviado. Verifica o teu e-mail.");
  }catch(err){setAuthMessage(err?.message==="TIMEOUT"?"O servidor está a demorar. Tenta novamente.":"Não foi possível criar a conta.",true);}
  finally{buttonBusy(btn,false);}
});

$("otpForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const token=$("signupOtp").value.trim().replace(/\D/g,"");
  if(!pendingSignupEmail || token.length!==6){setAuthMessage("Introduz o código de 6 dígitos.",true);return;}
  setAuthMessage("A confirmar o código...");
  const {data,error}=await supabaseClient.auth.verifyOtp({email:pendingSignupEmail,token,type:"email"});
  if(error){setAuthMessage(error.message||"Código inválido ou expirado.",true);return;}
  if(data.session){
    const user=data.session.user;
    setAccountStorage(user);
    if(pendingSignupName && (!state.userName || state.userName==="Letal" || state.userName==="Utilizador")){state.userName=pendingSignupName;save();}
    pendingSignupEmail="";pendingSignupPassword="";pendingSignupName="";
    showApp(user);
  } else {
    setAuthMessage("E-mail confirmado. Já podes entrar com a tua palavra-passe.");
    authView("authLoginView");
  }
});

$("resendOtp").onclick=async()=>{
  if(!pendingSignupEmail){authView("authSignupView");return;}
  setAuthMessage("A reenviar o código...");
  const {error}=await supabaseClient.auth.resend({type:"signup",email:pendingSignupEmail,options:{emailRedirectTo:window.location.href.split("#")[0]}});
  if(error)setAuthMessage(error.message||"Não foi possível reenviar o código.",true);
  else setAuthMessage("Novo código enviado. Verifica o teu e-mail.");
};

$("backToLoginFromOtp").onclick=()=>authView("authLoginView");

const RECOVERY_REDIRECT="https://ukuahamba.github.io/meucapital/";

$("resetForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  setAuthMessage("A enviar o e-mail de recuperação...");
  const email=$("resetEmail").value.trim();
  const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{
    redirectTo:RECOVERY_REDIRECT
  });
  if(error) setAuthMessage(error.message||"Não foi possível enviar o e-mail.",true);
  else setAuthMessage("E-mail enviado. Abre-o e toca em “Reset your password” para escolher uma nova palavra-passe.");
});

const openPasswordRecovery=()=>{
  $("passwordUpdateModal").classList.remove("hidden");
  $("newPassword").focus();
};

$("updatePasswordForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const p=$("newPassword").value;
  const c=$("newPasswordConfirm").value;
  const msg=$("updatePasswordMessage");
  msg.classList.remove("error");
  if(p.length<8){msg.textContent="A nova palavra-passe deve ter pelo menos 8 caracteres.";msg.classList.add("error");return;}
  if(p!==c){msg.textContent="As palavras-passe não coincidem.";msg.classList.add("error");return;}
  msg.textContent="A atualizar a palavra-passe...";
  const {error}=await supabaseClient.auth.updateUser({password:p});
  if(error){msg.textContent=error.message||"Não foi possível atualizar a palavra-passe.";msg.classList.add("error");return;}
  msg.textContent="Palavra-passe atualizada com sucesso! 🎉";
  $("newPassword").value="";
  $("newPasswordConfirm").value="";
  setTimeout(()=>{
    $("passwordUpdateModal").classList.add("hidden");
    window.history.replaceState({},document.title,RECOVERY_REDIRECT);
  },1200);
});

const handlePasswordRecovery=async()=>{
  const query=new URLSearchParams(window.location.search);
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
  const hasRecoveryHash=hash.get("type")==="recovery";
  const hasRecoveryFlag=query.get("reset-password")==="1";
  const code=query.get("code");

  if(code){
    const {error}=await supabaseClient.auth.exchangeCodeForSession(code);
    if(error){
      setAuthMessage(error.message||"O link de recuperação expirou ou já foi utilizado.",true);
      authView("authLoginView");
      return;
    }
    window.history.replaceState({},document.title,RECOVERY_REDIRECT);
    openPasswordRecovery();
    return;
  }

  if(hasRecoveryHash || hasRecoveryFlag){
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session){
      setAccountStorage(session.user);
      showApp(session.user);
      openPasswordRecovery();
      return;
    }
    setAuthMessage("O link de recuperação não é válido ou já expirou. Pede uma nova recuperação.",true);
  }
};

supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY" && session){
    setAccountStorage(session.user);
    showApp(session.user);
    openPasswordRecovery();
  }
});
window.addEventListener("hashchange",()=>{void handlePasswordRecovery();});

$("logoutBtn").onclick=async()=>{
  const btn=$("logoutBtn");
  flashButton(btn);
  btn.disabled=true;
  btn.classList.add("is-loading");
  const original=btn.innerHTML;
  btn.innerHTML=`<span class="btn-spinner" aria-hidden="true"></span><span>A sair...</span>`;
  // A interface termina a sessão imediatamente; o pedido à rede continua em segundo plano.
  currentUser=null;
  document.body.classList.add("auth-locked");
  authScreen.classList.remove("hidden");
  authView("authLoginView");
  setAuthMessage("Sessão terminada.");
  try{await withTimeout(supabaseClient.auth.signOut(),5000);}catch(_){}
  btn.disabled=false; btn.classList.remove("is-loading"); btn.innerHTML=original;
};

const toast=t=>{const el=$("toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)};
const defaults={
  userName:"Utilizador",currency:"Kz",targetPct:20,
  budget:{salary:0,fixed:0,variable:0,debt:0,saving:0},
  goal:{name:"",target:0,saved:0},
  sim:{initial:0,monthly:0,rate:5,years:5},
  investments:[],
  history:[],
  goals:[],
  cards:[],
  transactions:[]
};
let state=JSON.parse(localStorage.getItem(KEY)||"null")||structuredClone(defaults);
function save(){if(currentUser) localStorage.setItem(KEY,JSON.stringify(state))}

function setCloudStatus(text,kind="idle"){
  const el=$("cloudSyncStatus");
  if(!el)return;
  el.textContent=text;
  el.dataset.state=kind;
}

let cloudSyncInFlight=false;
async function syncWalletFromCloud(user=currentUser){
  if(!user || cloudSyncInFlight)return;
  cloudSyncInFlight=true;
  setCloudStatus("A sincronizar com a tua conta…","syncing");
  try{
    const [{data:cards,error:cardsError},{data:txs,error:txError}]=await Promise.all([
      supabaseClient.from("wallet_cards").select("id,name,issuer,last4,type,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
      supabaseClient.from("wallet_transactions").select("id,description,amount,type,category,occurred_at,card_id,created_at").eq("user_id",user.id).order("occurred_at",{ascending:false}).order("created_at",{ascending:false})
    ]);
    if(cardsError)throw cardsError;
    if(txError)throw txError;

    const localCards=Array.isArray(state.cards)?state.cards:[];
    const localTx=Array.isArray(state.transactions)?state.transactions:[];

    if((cards||[]).length===0 && localCards.length){
      const payload=localCards.map(c=>({user_id:user.id,name:c.name,issuer:c.issuer||null,last4:c.last4,type:c.type||"Débito"}));
      const {data:inserted,error}=await supabaseClient.from("wallet_cards").insert(payload).select("id,name,issuer,last4,type,created_at");
      if(error)throw error;
      state.cards=(inserted||[]).map(c=>({...c}));
    }else{
      state.cards=(cards||[]).map(c=>({...c}));
    }

    if((txs||[]).length===0 && localTx.length){
      const payload=localTx.map(t=>({
        user_id:user.id,description:t.desc||"Movimento",amount:Number(t.amount)||0,type:t.type||"Despesa",
        category:t.category||"Outro",occurred_at:t.isoDate||new Date().toISOString().slice(0,10),card_id:t.card_id||null
      }));
      const {data:inserted,error}=await supabaseClient.from("wallet_transactions").insert(payload).select("id,description,amount,type,category,occurred_at,card_id,created_at");
      if(error)throw error;
      state.transactions=(inserted||[]).map(t=>({...t,desc:t.description,date:new Date(t.occurred_at+"T00:00:00").toLocaleDateString("pt-AO")}));
    }else{
      state.transactions=(txs||[]).map(t=>({...t,desc:t.description,date:new Date(t.occurred_at+"T00:00:00").toLocaleDateString("pt-AO")}));
    }
    save();
    renderCards();
    renderDashboard();
    renderProfile();
    setCloudStatus("Sincronizado com a tua conta ✓","ok");
  }catch(err){
    console.error("MeuCapital wallet sync:",err);
    setCloudStatus("Sincronização indisponível — os dados locais continuam disponíveis.","error");
  }finally{cloudSyncInFlight=false;}
}

async function addCardToCloud(card){
  if(!currentUser)return null;
  const {data,error}=await supabaseClient.from("wallet_cards").insert({
    user_id:currentUser.id,name:card.name,issuer:card.issuer||null,last4:card.last4,type:card.type||"Débito"
  }).select("id,name,issuer,last4,type,created_at").single();
  if(error)throw error;
  return data;
}

async function addTransactionToCloud(tx){
  if(!currentUser)return null;
  const {data,error}=await supabaseClient.from("wallet_transactions").insert({
    user_id:currentUser.id,description:tx.desc,amount:Number(tx.amount),type:tx.type,category:tx.category,
    occurred_at:tx.isoDate,card_id:tx.card_id||null
  }).select("id,description,amount,type,category,occurred_at,card_id,created_at").single();
  if(error)throw error;
  return data;
}

async function deleteCardFromCloud(id){
  if(!currentUser || !id)return;
  const {error}=await supabaseClient.from("wallet_cards").delete().eq("id",id).eq("user_id",currentUser.id);
  if(error)throw error;
}

async function deleteTransactionFromCloud(id){
  if(!currentUser || !id)return;
  const {error}=await supabaseClient.from("wallet_transactions").delete().eq("id",id).eq("user_id",currentUser.id);
  if(error)throw error;
}
function setVal(id,v){if($(id))$(id).value=v}
function calcBudget(b=state.budget){
  const salary=+b.salary||0,fixed=+b.fixed||0,variable=+b.variable||0,debt=+b.debt||0,saving=+b.saving||0;
  const expenses=fixed+variable+debt,left=Math.max(0,salary-expenses-saving),pct=salary?saving/salary*100:0;
  return {salary,fixed,variable,debt,saving,expenses,left,pct};
}
function renderDashboard(){
  const b=calcBudget(); $("salaryCard").textContent=money(b.salary);$("expenseCard").textContent=money(b.expenses);$("savingCard").textContent=money(b.saving);$("leftCard").textContent=money(b.left);
  $("savedCard").textContent=money(state.history.length?Math.max(...state.history.map(x=>+x.total||0)):b.saving);
  $("savingPctCard").textContent=b.pct.toFixed(0)+"% do salário";$("leftPctCard").textContent=(b.salary?b.left/b.salary*100:0).toFixed(0)+"% do salário";
  ["salary","fixed","variable","debt","saving"].forEach(k=>setVal(k,b[k]));
  $("donutTotal").textContent=fmt(b.salary);$("fixedLegend").textContent=fmt(b.fixed);$("variableLegend").textContent=fmt(b.variable);$("savingLegend").textContent=fmt(b.saving);$("legendLeft").textContent=fmt(b.left);
  const ps=[b.fixed,b.variable,b.saving,b.left].map(v=>b.salary?v/b.salary*100:0);ps.forEach((p,i)=>$("p"+(i+1)).textContent=p.toFixed(1));
  $("donut").style.background=`conic-gradient(#3475df 0 ${ps[0]}%,#7747c9 ${ps[0]}% ${ps[0]+ps[1]}%,#39ad63 ${ps[0]+ps[1]}% ${ps[0]+ps[1]+ps[2]}%,#f2942e ${ps[0]+ps[1]+ps[2]}% 100%)`;
  $("ring").textContent=Math.round(b.pct)+"%";$("resultDetail").textContent=`Estás a poupar ${Math.round(b.pct)}% do teu salário.`;
  $("resultText").textContent=b.pct>=state.targetPct?"Estás no caminho certo! 👏":"Podes melhorar a tua poupança.";
  renderGoalMini();renderSim();renderProfessionalDashboard();
}
function renderProfessionalDashboard(){
  const b=calcBudget();
  const invested=state.investments.reduce((sum,x)=>sum+(+x.amount||0),0);
  const savedHistory=state.history.reduce((sum,x)=>sum+(+x.saving||0),0);
  const goal=state.goals[0]||null;
  const goalPct=goal?.target?Math.min(100,(+goal.saved||0)/(+goal.target||1)*100):0;
  const savingPct=b.salary?b.saving/b.salary*100:0;
  const expensePct=b.salary?b.expenses/b.salary*100:0;
  const score=b.salary?Math.max(0,Math.min(100,Math.round(savingPct*1.8 + Math.max(0,100-expensePct)*.35 - (b.debt/b.salary*100)*.35))):0;
  $("healthScore").textContent=score; $("healthMeter").style.width=score+"%";
  $("healthSaving").textContent=savingPct.toFixed(0)+"%"; $("healthExpense").textContent=expensePct.toFixed(0)+"%"; $("healthGoal").textContent=goalPct.toFixed(0)+"%";
  const title=score>=75?"Boa disciplina financeira":score>=50?"Situação equilibrada":b.salary?"Há espaço para melhorar":"Começa por registar o teu mês";
  const text=score>=75?"A tua distribuição de rendimento mostra uma boa margem de controlo.":score>=50?"Mantém o controlo das despesas e protege a tua poupança.":b.salary?"Reveja despesas e aumenta gradualmente a margem de poupança.":"Preenche o teu rendimento e despesas para obteres uma leitura financeira personalizada.";
  $("healthTitle").textContent=title; $("healthText").textContent=text;
  const position=Math.max(0,savedHistory)+invested;
  $("capitalPosition").textContent=money(position); $("capitalSaved").textContent=money(savedHistory); $("capitalInvested").textContent=money(invested);

  const history=[...state.history].slice(0,6).reverse();
  const chart=$("flowChart");
  if(!history.length){chart.innerHTML='<div class="empty-state">Guarda o primeiro orçamento mensal para começar a acompanhar a evolução.</div>';}
  else {
    const max=Math.max(...history.flatMap(x=>[+x.salary||0,+x.expenses||0,+x.saving||0]),1);
    chart.innerHTML=history.map((x)=>{const a=(+x.salary||0)/max*100,e=(+x.expenses||0)/max*100,sv=(+x.saving||0)/max*100;return `<div class="flow-col"><div class="flow-bars"><span class="flow-bar income" style="height:${Math.max(3,a)}%" title="Rendimento ${money(x.salary)}"></span><span class="flow-bar expense" style="height:${Math.max(3,e)}%" title="Despesas ${money(x.expenses)}"></span><span class="flow-bar saving" style="height:${Math.max(3,sv)}%" title="Poupança ${money(x.saving)}"></span></div><small>${escapeHtml(String(x.date||"Mês").replace(/ de /g," "))}</small></div>`}).join('');
  }
  const latest=state.history[0], previous=state.history[1];
  const trend=latest&&previous?((+latest.saving||0)-(+previous.saving||0)):(latest?(+latest.saving||0):0);
  $("trendBadge").textContent=latest?(trend>=0?"↑ Poupança em alta":"↓ Poupança em baixa"):"Sem dados";
  $("trendBadge").className="trend-badge "+(trend>=0&&latest?"positive":"negative");

  const priorities=[];
  if(!b.salary) priorities.push(["01","Registar rendimento","Define o teu rendimento mensal para ativar os indicadores.","calculator"]);
  if(b.salary && savingPct<state.targetPct) priorities.push(["02","Aumentar a poupança",`Estás em ${savingPct.toFixed(0)}% e a tua meta é ${state.targetPct}%.`,"calculator"]);
  if(b.salary && b.expenses>b.salary*.7) priorities.push(["03","Rever despesas","As despesas ocupam uma parte elevada do rendimento.","calculator"]);
  if(!goal) priorities.push(["04","Criar uma meta","Define um objetivo concreto para dar direção ao teu capital.","goals"]);
  if(!invested) priorities.push(["05","Registar investimentos","Acompanha o capital que já está a trabalhar por ti.","investments"]);
  if(!priorities.length) priorities.push(["✓","Manter consistência","Os teus principais indicadores estão equilibrados. Continua a acompanhar o mês.","reports"]);
  $("priorityList").innerHTML=priorities.slice(0,4).map(x=>`<button class="priority-item" data-page="${x[3]}"><span class="priority-num">${x[0]}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><strong>›</strong></button>`).join('');
  $("priorityList").querySelectorAll("[data-page]").forEach(el=>el.onclick=()=>navigate(el.dataset.page));
}

function renderGoalMini(){
  const g=state.goals[0]||state.goal; if(!g)return;
  const pct=g.target?Math.min(100,g.saved/g.target*100):0,left=Math.max(0,g.target-g.saved),monthly=g.monthly||state.budget.saving||0,months=monthly?Math.ceil(left/monthly):0;
  $("goalName").textContent=g.name;$("goalTarget").textContent=money(g.target);$("goalSaved").textContent=fmt(g.saved);$("goalMonthly").textContent=fmt(monthly);
  $("goalPct").textContent=Math.round(pct)+"%";$("goalProgress").style.width=pct+"%";$("goalRemaining").textContent=left?`Faltam ${money(left)} para atingir a meta.`:"Meta atingida! 🎉";
  $("goalMonths").textContent=months?months+" meses":"—";let d=new Date();d.setMonth(d.getMonth()+months);$("goalDate").textContent=months?d.toLocaleDateString("pt-AO",{month:"long",year:"numeric"}):"—";
}
function renderSim(){
  const s=state.sim;["initial","monthly","rate","years"].forEach(k=>setVal(k,s[k]));
  let total=+s.initial||0, mr=(+s.rate||0)/100/12, months=(+s.years||5)*12,values=[total];
  for(let m=1;m<=months;m++){total=total*(1+mr)+(+s.monthly||0);if(m%12===0)values.push(total)}
  $("future").textContent=money(total);$("futurePeriod").textContent=`em ${s.years} anos`;
  const max=Math.max(...values,1);$("bars").innerHTML=values.map((v,i)=>`<div class="bar" style="height:${Math.max(8,v/max*125)}px"><span>Ano ${i}</span></div>`).join("");
}
function syncBudgetInputs(prefix=""){
  const p=prefix;state.budget={salary:+$(p+"salary").value||0,fixed:+$(p+"fixed").value||0,variable:+$(p+"variable").value||0,debt:+$(p+"debt").value||0,saving:+$(p+"saving").value||0};save();renderDashboard();
}
function renderCards(){
  const cards=state.cards||[], tx=state.transactions||[];
  $("cardsList").innerHTML=cards.length?cards.map((c,i)=>`<div class="item-card wallet-card"><div class="wallet-card-main"><div class="wallet-mini-card"><span>MC</span><b>•••• ${escapeHtml(c.last4)}</b></div><div><b>${escapeHtml(c.name)}</b><p>${escapeHtml(c.issuer||"Emissor não indicado")} · ${escapeHtml(c.type)}</p></div></div><button class="danger-btn" onclick="deleteCard(${i})">Remover</button></div>`).join(""):"<div class='empty-state'>Ainda não tens cartões registados.</div>";
  $("transactionsList").innerHTML=tx.length?tx.slice(0,12).map((t,i)=>`<div class="item-card transaction-card"><div><b>${escapeHtml(t.desc||t.description)}</b><p>${escapeHtml(t.category||"Outro")} · ${escapeHtml(t.date||t.occurred_at||"")}</p></div><strong class="${t.type==='Entrada'?'tx-in':'tx-out'}">${t.type==='Entrada'?'+':'-'}${money(t.amount)}</strong><button class="danger-btn" onclick="deleteTransaction(${i})">×</button></div>`).join(""):"<div class='empty-state'>Ainda não existem movimentos.</div>";
}
async function deleteCard(i){
  if(!confirm("Remover este cartão do MeuCapital?"))return;
  const card=state.cards[i];
  state.cards.splice(i,1); save(); renderCards();
  try{await deleteCardFromCloud(card?.id);setCloudStatus("Cartão removido e sincronizado ✓","ok");toast("Cartão removido.");}
  catch(err){console.error(err);toast("Foi removido no ecrã, mas não foi possível sincronizar.");setCloudStatus("Erro de sincronização","error");}
}
async function deleteTransaction(i){
  const tx=state.transactions[i];
  state.transactions.splice(i,1); save(); renderCards(); renderDashboard();
  try{await deleteTransactionFromCloud(tx?.id);setCloudStatus("Movimento removido e sincronizado ✓","ok");toast("Movimento removido.");}
  catch(err){console.error(err);toast("Foi removido no ecrã, mas não foi possível sincronizar.");setCloudStatus("Erro de sincronização","error");}
}
function navigate(page){
  const target=$("page-"+page);
  if(!target)return;
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  target.classList.remove("hidden");
  document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  $("sidebar")?.classList.remove("open");
  if(page==="calculator")renderCalculator();
  if(page==="cards")renderCards();
  if(page==="goals")renderGoals();
  if(page==="investments")renderInvestments();
  if(page==="history")renderHistory();
  if(page==="reports")renderReports();
  if(page==="profile")renderProfile();
  if(page==="settings")renderSettings();
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderCalculator(){
  const b=calcBudget();["Salary","Fixed","Variable","Debt","Saving"].forEach((k,i)=>setVal("calc"+k,[b.salary,b.fixed,b.variable,b.debt,b.saving][i]));
  $("calcSummary").innerHTML=[["Despesas totais",b.expenses],["Poupança",b.saving],["Sobra",b.left]].map(x=>`<div class="report-card"><small>${x[0]}</small><strong>${money(x[1])}</strong></div>`).join("");
}
function renderGoals(){
  $("goalsList").innerHTML=state.goals.map((g,i)=>{const p=g.target?Math.min(100,g.saved/g.target*100):0;return `<div class="item-card"><b>${g.name}</b><p><strong>${money(g.saved)}</strong> de ${money(g.target)} — ${p.toFixed(0)}%</p><div class="progress"><span style="width:${p}%"></span></div><div class="actions"><button class="secondary-btn" onclick="addGoalMoney(${i})">+ Adicionar poupança</button><button class="danger-btn" onclick="deleteGoal(${i})">Apagar</button></div></div>`}).join("");
}
function addGoalMoney(i){const amount=Number(prompt("Quanto queres adicionar?","10000"));if(!amount||amount<0)return;state.goals[i].saved+=amount;save();renderGoals();renderDashboard();toast("Poupança adicionada!")}
function deleteGoal(i){if(!confirm("Apagar esta meta?"))return;state.goals.splice(i,1);save();renderGoals();renderDashboard()}
function renderInvestments(){
  $("investmentsList").innerHTML=state.investments.length?state.investments.map((x,i)=>`<div class="item-card"><b>${x.name}</b><p>Investido: <strong>${money(x.amount)}</strong> · Rendimento: ${x.rate}%/ano</p><button class="danger-btn" onclick="deleteInvestment(${i})">Apagar</button></div>`).join(""):"<p class='muted'>Ainda não tens investimentos registados.</p>";
}
function deleteInvestment(i){state.investments.splice(i,1);save();renderInvestments();toast("Investimento removido")}
function renderHistory(){
  $("historyBody").innerHTML=state.history.map(x=>`<tr><td>${x.date}</td><td>${fmt(x.salary)}</td><td>${fmt(x.expenses)}</td><td>${fmt(x.saving)}</td><td>${fmt(x.left)}</td><td>${fmt(x.total)}</td></tr>`).join("");
}
function renderReports(){
  const b=calcBudget(), totalSaved=state.history.reduce((s,x)=>s+(+x.saving||0),0),avg=state.history.length?state.history.reduce((s,x)=>s+(+x.saving||0),0)/state.history.length:0;
  $("reportGrid").innerHTML=[["Salário atual",money(b.salary)],["Poupança atual",money(b.saving)],["Média poupada",money(avg)],["Meses registados",state.history.length],["Investimentos",money(state.investments.reduce((s,x)=>s+(+x.amount||0),0))],["Total poupado nos registos",money(totalSaved)]].map(x=>`<div class="report-card"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("");
}
function renderSettings(){setVal("userName",state.userName);setVal("targetPct",state.targetPct);setVal("currency",state.currency)}
function formatDateTime(value){
  if(!value)return "—";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return "—";
  return d.toLocaleDateString("pt-AO",{day:"2-digit",month:"long",year:"numeric"});
}
function getUserDisplayName(){
  return (currentUser?.user_metadata?.full_name||state.userName||currentUser?.email?.split("@")[0]||"Utilizador").trim();
}
function initials(name){
  const parts=String(name||"U").trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0,2).map(x=>x[0]).join("")||"U").toUpperCase();
}

function renderTopAvatar(){
  const el=$("topAvatar"); if(!el)return;
  const name=getUserDisplayName(); const saved=state.avatar||"";
  el.innerHTML=saved
    ? `<img src="${escapeHtml(saved)}" alt="Foto de perfil" class="top-avatar-img">`
    : `<span class="top-avatar-initials">${escapeHtml(initials(name))}</span>`;
  el.classList.toggle("has-photo",!!saved);
  el.title=saved?`Perfil de ${name}`:"Abrir meu perfil";
}
function renderClientOverview(){
  const b=calcBudget();
  const invested=state.investments.reduce((sum,x)=>sum+(+x.amount||0),0);
  const saved=state.history.reduce((sum,x)=>sum+(+x.saving||0),0);
  const capital=Math.max(0,saved)+invested;
  const goals=state.goals.length;
  const score=+($('healthScore')?.textContent||0);
  let level="Inicial", text="Começa por registar o teu primeiro mês.";
  if(score>=80){level="Excelente";text="Disciplina financeira forte e consistente.";}
  else if(score>=65){level="Avançado";text="Boa organização. Mantém a consistência.";}
  else if(score>=45){level="Em evolução";text="Já tens uma base. Agora melhora a margem.";}
  else if(b.salary){level="Em construção";text="O próximo passo é aumentar a margem de poupança.";}
  $("profileCapital").textContent=money(capital);
  $("profileGoals").textContent=goals;
  $("profileInvestments").textContent=money(invested);
  $("clientLevel").textContent=level;
  $("clientLevelText").textContent=text;
  $("clientWelcomeTitle").textContent=`Olá, ${getUserDisplayName().split(/\s+/)[0]}.`;
  $("clientWelcomeText").textContent=score>=65?"O teu perfil mostra uma boa evolução. Continua a construir capital com consistência.":"Mantém o perfil atualizado e usa os indicadores para tomar decisões melhores.";
  $("securityText").textContent=currentUser?.email_confirmed_at?"E-mail confirmado e conta ativa.":"Confirma o teu e-mail para reforçar a segurança.";
}

function renderProfile(){
  const name=getUserDisplayName();
  const email=currentUser?.email||"—";
  const avatar=$("profileAvatar");
  const savedAvatar=state.avatar||"";
  avatar.innerHTML="";
  avatar.style.backgroundImage=savedAvatar?`url("${savedAvatar}")`:"";
  avatar.style.backgroundSize="cover";
  avatar.style.backgroundPosition="center";
  avatar.style.backgroundRepeat="no-repeat";
  if(savedAvatar){avatar.textContent="";avatar.classList.add("has-photo");}
  else{avatar.textContent=initials(name);avatar.classList.remove("has-photo");avatar.style.backgroundImage="";}
  $("profileName").textContent=name;
  $("profileEmail").textContent=email;
  $("profileFullName").textContent=name;
  $("profileEmailDetail").textContent=email;
  $("profileCreatedAt").textContent=formatDateTime(currentUser?.created_at);
  $("profileConfirmedAt").textContent=formatDateTime(currentUser?.email_confirmed_at);
  $("profileStatus").textContent=currentUser?.email_confirmed_at?"✓ E-mail confirmado":"E-mail por confirmar";
  $("profileStatus").classList.toggle("pending",!currentUser?.email_confirmed_at);
  $("profileEditName").value=name;
  renderTopAvatar();
  renderClientOverview();
}

async function saveProfileAvatar(file){
  if(!file)return;
  if(!file.type.startsWith("image/")){toast("Escolhe uma imagem válida.");return;}
  if(file.size>5*1024*1024){toast("A foto deve ter no máximo 5 MB.");return;}
  try{
    const dataUrl=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          const max=420,scale=Math.min(1,max/Math.max(img.width,img.height));
          const canvas=document.createElement("canvas");
          canvas.width=Math.max(1,Math.round(img.width*scale));
          canvas.height=Math.max(1,Math.round(img.height*scale));
          const ctx=canvas.getContext("2d");
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL("image/jpeg",0.82));
        };
        img.onerror=()=>reject(new Error("Imagem inválida"));
        img.src=reader.result;
      };
      reader.onerror=()=>reject(new Error("Não foi possível ler a imagem"));
      reader.readAsDataURL(file);
    });
    state.avatar=dataUrl;
    save();
    renderTopAvatar();
    renderProfile();
    toast("Foto de perfil atualizada! ✓");
  }catch(e){toast("Não foi possível atualizar a foto.");}
}

function recordHistory(){
  const b=calcBudget();const last=state.history[0]?.total||0;state.history.unshift({date:new Date().toLocaleDateString("pt-AO",{month:"long",year:"numeric"}),salary:b.salary,expenses:b.expenses,saving:b.saving,left:b.left,total:last+b.saving});save();renderHistory();
}
// Reconhecimento local do banco pelo BIN (não guardamos o BIN).
const ANGOLA_BIN_BANKS={
  "401839":"BPC","402533":"BNI","402842":"BAI","403195":"BNI","403209":"Banco Económico","403267":"BAI","403640":"Banco Económico","403938":"BNI","404904":"Banco Sol","405827":"BAI","406183":"BIC","406184":"BIC","408174":"Banco Económico","408390":"Banco Comercial Angolano","408391":"Banco Comercial Angolano","410227":"BAI","410228":"BAI","410318":"BAI","412575":"BCGA","412660":"Standard Bank Angola","413727":"BNI","415157":"BFA","417045":"BAI","417066":"BAI","417981":"Banco Económico","417983":"Banco Económico","417984":"Banco Económico","417985":"Banco Económico","418888":"Banco Valor","422036":"BAI","424128":"BAI","424129":"BAI","424130":"BPC","424590":"Millennium Atlântico","424591":"Millennium Atlântico","424592":"Millennium Atlântico","428457":"Banco Comercial do Huambo","428480":"Banco Comercial do Huambo","431824":"Standard Bank Angola","437578":"BNI","439951":"Access Bank Angola","439952":"Access Bank Angola","443840":"BPC","443841":"BPC","443842":"BPC","443843":"BPC","443844":"BPC","443963":"BFA","444467":"Millennium Angola","446150":"BIC","446384":"Banco Sol","446385":"BCGA","446577":"Banco Sol","446907":"Banco Keve","446908":"Banco Keve","446909":"Millennium Angola","447353":"BCGA","447354":"BCGA","447842":"Banco Sol","447843":"Banco Sol","447886":"BNI","447887":"BNI","447888":"BNI","455666":"Finibanco Angola","455668":"BCGA","457260":"BPC","457286":"Millennium Atlântico","457287":"Millennium Atlântico","457313":"Millennium Angola","457397":"BFA","457398":"BFA","457797":"BPC","457853":"Standard Bank Angola","458286":"BFA","458287":"BFA","462119":"BAI","465962":"BFA","471224":"BCGA","471330":"BNI","471421":"BIC","472297":"BIC","472298":"BIC","472299":"BIC","472907":"Banco Sol","475160":"Banco Económico","475178":"BPC","475179":"Millennium Atlântico","476711":"BAI","476716":"BAI","476829":"Standard Bank Angola","479329":"Access Bank Angola","481687":"BAI","484636":"BCGA","484898":"BFA","511212":"BAI","511745":"Banco de Crédito do Sul","513252":"Banco Sol","514946":"BAI","516307":"BCI","518102":"Banco Sol","518297":"BAI","519516":"Banco de Investimento Rural","520022":"BNI","520226":"Banco de Investimento Rural","520230":"Banco Valor","524622":"BCI","524725":"Banco Yetu","526486":"Banco de Crédito do Sul","526767":"Banco de Investimento Rural","529238":"Banco Sol","529521":"Banco de Crédito do Sul","529592":"Banco Valor","530634":"Banco Sol","530819":"BNI","532052":"Banco Sol","533780":"Banco Sol","534197":"BNI","534642":"Banco Sol","534650":"Banco Valor","536096":"Banco Angolano de Negócios e Comércio","537698":"BCI","538012":"Banco de Crédito do Sul","538138":"Banco Valor","539790":"Banco Sol","539809":"Banco Sol","539815":"Banco Sol","539839":"Banco Sol","540988":"Banco Sol","541342":"Banco Sol","541397":"Banco Sol","545897":"BNI","550071":"Banco Sol","551397":"Banco Sol","553522":"Banco Sol","555647":"Banco Yetu","555879":"BCI","556679":"BNI","557662":"BNI","604613":"Millennium Atlântico","623384":"UnionPay","623385":"UnionPay","626276":"UnionPay","626423":"UnionPay","629226":"UnionPay","629287":"UnionPay"
};
function detectCardBank(bin){
  const key=String(bin||"").replace(/\D/g,"").slice(0,6);
  return ANGOLA_BIN_BANKS[key]||"";
}
function updateCardBank(){
  const bin=$("cardBin")?.value.replace(/\D/g,"").slice(0,6)||"";
  if($("cardBin")) $("cardBin").value=bin;
  const bank=detectCardBank(bin);
  if($("cardIssuer")) $("cardIssuer").value=bank;
  if($("cardBankStatus")){
    $("cardBankStatus").textContent=bank?`Banco reconhecido automaticamente: ${bank} ✓`:(bin.length===6?"BIN não encontrado na base local. Verifica os dígitos.":"O banco será reconhecido automaticamente.");
    $("cardBankStatus").dataset.state=bank?"ok":(bin.length===6?"error":"idle");
  }
}

document.addEventListener("click",e=>{
  const el=e.target.closest("[data-page]");
  if(!el)return;
  const p=el.dataset.page;
  if(p){e.preventDefault();navigate(p);}
});
$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
const dashboardSaveBtn=$("calculate"); if(dashboardSaveBtn) dashboardSaveBtn.onclick=()=>{syncBudgetInputs();recordHistory();toast("Orçamento guardado!");};
["salary","fixed","variable","debt","saving"].forEach(id=>$(id).addEventListener("input",()=>{state.budget[id]=+$(id).value||0;save();renderDashboard()}));
["initial","monthly","rate","years"].forEach(id=>$(id).addEventListener("input",()=>{state.sim[id]=+$(id).value||0;save();renderSim()}));
$("calcSave").onclick=()=>{state.budget={salary:+$("calcSalary").value||0,fixed:+$("calcFixed").value||0,variable:+$("calcVariable").value||0,debt:+$("calcDebt").value||0,saving:+$("calcSaving").value||0};save();recordHistory();renderCalculator();renderDashboard();toast("Orçamento guardado!");};
$("addGoal").onclick=()=>{const name=prompt("Nome da meta","Nova meta");if(!name)return;const target=Number(prompt("Valor da meta em Kz","100000"));if(!target)return;state.goals.push({name,target,saved:0,monthly:state.budget.saving});save();renderGoals();toast("Meta criada!");};
$("addInvestment").onclick=()=>{const name=$("invName").value.trim();const amount=+$("invAmount").value||0;const rate=+$("invRate").value||0;if(!name||!amount)return toast("Preenche nome e valor do investimento.");state.investments.push({name,amount,rate});save();$("invName").value="";$("invAmount").value="";$("invRate").value="";renderInvestments();renderDashboard();toast("Investimento adicionado!")};
$("cardBin")?.addEventListener("input",updateCardBank);
$("addCard").onclick=async()=>{
  const btn=$("addCard"),name=$("cardName").value.trim(),bin=$("cardBin").value.trim(),issuer=detectCardBank(bin),last4=$("cardLast4").value.trim(),type=$("cardType").value;
  if(!name||!/^[0-9]{6}$/.test(bin)||!issuer||!/^[0-9]{4}$/.test(last4)){toast("Indica o nome, um BIN angolano válido e os últimos 4 dígitos.");return;}
  buttonBusy(btn,true,"A guardar…");
  const card={name,issuer,last4,type};
  try{
    const saved=await addCardToCloud(card);
    state.cards=state.cards||[]; state.cards.unshift(saved||card); save(); renderCards();
    $("cardName").value="";$("cardBin").value="";$("cardIssuer").value="";$("cardLast4").value=""; updateCardBank();
    setCloudStatus("Cartão sincronizado com a tua conta ✓","ok");toast(`${issuer} reconhecido e cartão adicionado com segurança.`);
  }catch(err){
    console.error(err);
    state.cards=state.cards||[];state.cards.unshift(card);save();renderCards();
    setCloudStatus("Não foi possível sincronizar o cartão.","error");toast("Cartão guardado localmente. Verifica a configuração da base de dados.");
  }finally{buttonBusy(btn,false);}
};
$("addTransaction").onclick=async()=>{
  const btn=$("addTransaction"),desc=$("txDesc").value.trim(),amount=+$ ("txAmount").value||0,type=$("txType").value,category=$("txCategory").value;
  if(!desc||amount<=0){toast("Indica a descrição e um valor válido.");return;}
  buttonBusy(btn,true,"A guardar…");
  const now=new Date(); const tx={desc,amount,type,category,date:now.toLocaleDateString("pt-AO"),isoDate:now.toISOString().slice(0,10)};
  try{
    const saved=await addTransactionToCloud(tx);
    const normalized=saved?{...saved,desc:saved.description,date:new Date(saved.occurred_at+"T00:00:00").toLocaleDateString("pt-AO")} : tx;
    state.transactions=state.transactions||[];state.transactions.unshift(normalized);save();renderCards();renderDashboard();
    $("txDesc").value="";$("txAmount").value="";
    setCloudStatus("Movimento sincronizado com a tua conta ✓","ok");toast("Movimento registado.");
  }catch(err){
    console.error(err);
    state.transactions=state.transactions||[];state.transactions.unshift(tx);save();renderCards();renderDashboard();
    setCloudStatus("Não foi possível sincronizar o movimento.","error");toast("Movimento guardado localmente. Verifica a configuração da base de dados.");
  }finally{buttonBusy(btn,false);}
};
$("saveSettings").onclick=()=>{state.userName=$("userName").value.trim()||"Utilizador";state.targetPct=+$("targetPct").value||20;state.currency=$("currency").value||"Kz";save();document.querySelector(".user").innerHTML=`<span class="user-greeting">Olá,</span> <b>${escapeHtml(state.userName)}</b>`;renderDashboard();toast("Definições guardadas!")};
$("resetData").onclick=()=>{if(!confirm("Isto apaga os dados guardados neste dispositivo. Continuar?"))return;state=structuredClone(defaults);save();renderDashboard();toast("Dados repostos.")};
$("topAvatar").onclick=()=>navigate("profile");

$("profileAvatarInput").addEventListener("change",e=>{
  const file=e.target.files?.[0];
  saveProfileAvatar(file);
  e.target.value="";
});
$("saveProfile").onclick=async()=>{
  const btn=$("saveProfile"); flashButton(btn);
  const name=$("profileEditName").value.trim();
  if(!name){toast("Introduz o teu nome.");return;}
  buttonBusy(btn,true,"A guardar...");
  try{
    const {data,error}=await withTimeout(supabaseClient.auth.updateUser({data:{full_name:name}}),10000);
    if(error){toast(error.message||"Não foi possível guardar os dados.");return;}
    state.userName=name;save();currentUser=data.user||currentUser;
    document.querySelector(".user").innerHTML=`<span class="user-greeting">Olá,</span> <b>${escapeHtml(name)}</b>`;
    renderProfile();renderSettings();toast("Dados do cliente atualizados! ✓");
  }catch(err){toast(err?.message==="TIMEOUT"?"O servidor demorou. Tenta novamente.":"Não foi possível guardar os dados.");}
  finally{buttonBusy(btn,false);}
};
$("profileChangePassword").onclick=()=>openPasswordRecovery();
$("profileLogout").onclick=()=>$("logoutBtn").click();
$("tipBtn").onclick=()=>alert("Uma boa regra inicial é guardar pelo menos 20% do rendimento. Ajusta a percentagem à tua realidade e mantém uma reserva para emergências.");
$("ruleLink").onclick=e=>{e.preventDefault();alert("A regra 50/30/20 é uma referência: cerca de 50% para necessidades, 30% para desejos e 20% para poupança/investimento. Não é uma regra obrigatória.")};
$("notifyBtn").onclick=()=>{
  const panel=$("mc17Notifications");
  if(!panel)return;
  const open=!panel.classList.contains("is-open");
  panel.classList.toggle("is-open",open);
  $("notifyBtn").setAttribute("aria-expanded",String(open));
};
if($("mc17CloseNotif")) $("mc17CloseNotif").onclick=()=>{ $("mc17Notifications")?.classList.remove("is-open"); $("notifyBtn")?.setAttribute("aria-expanded","false"); };
if($("mc17SeeNotifications")) $("mc17SeeNotifications").onclick=()=>toast("Estas são as notificações recentes da tua conta.");
document.querySelector(".user").innerHTML=`<span class="user-greeting">Olá,</span> <b>${escapeHtml(state.userName)}</b>`;
renderDashboard();renderHistory();

// Feedback táctil/visual global para todos os botões.
document.addEventListener("pointerdown",e=>{
  const btn=e.target.closest("button,[role=button]");
  if(!btn || btn.disabled)return;
  btn.classList.add("is-pressed");
});
document.addEventListener("pointerup",e=>{
  const btn=e.target.closest("button,[role=button]");
  if(!btn)return;
  setTimeout(()=>btn.classList.remove("is-pressed"),120);
});
document.addEventListener("pointercancel",e=>{
  const btn=e.target.closest("button,[role=button]");
  if(btn)btn.classList.remove("is-pressed");
});
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ") && document.activeElement?.matches("button,[role=button]")) document.activeElement.classList.add("is-pressed");
});
document.addEventListener("keyup",e=>{
  if(e.key==="Enter"||e.key===" "){const btn=document.activeElement?.matches("button,[role=button]")?document.activeElement:null;if(btn)btn.classList.remove("is-pressed");}
});

// Start authentication only after the app state/defaults are initialized.
bootAuth();
