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
  if(!state || !state.userName || state.userName==="Letal") state.userName=suggested;
  save();
  const userEl=document.querySelector(".user");
  if(userEl) userEl.innerHTML=`Olá, <b>${escapeHtml(state.userName)}</b> 👋`;
  renderDashboard(); renderHistory();
};
const showAuth=()=>{
  currentUser=null;
  document.body.classList.add("auth-locked");
  authScreen.classList.remove("hidden");
};
const escapeHtml=(s)=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const setAccountStorage=(user)=>{
  if(!user)return;
  KEY=`meucapital-v5:${user.id}`;
  const raw=localStorage.getItem(KEY);
  state=raw?JSON.parse(raw):structuredClone(defaults);
  if(user.user_metadata?.full_name && (!state.userName || state.userName==="Letal")) state.userName=user.user_metadata.full_name;
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
  setAuthMessage("A entrar...");
  const email=$("loginEmail").value.trim();
  const password=$("loginPassword").value;
  const {error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error) setAuthMessage(error.message||"Não foi possível entrar.",true);
});

$("signupForm").addEventListener("submit",async(e)=>{
  e.preventDefault();
  setAuthMessage("A criar a tua conta...");
  const name=$("signupName").value.trim();
  const email=$("signupEmail").value.trim();
  const password=$("signupPassword").value;
  const {data,error}=await supabaseClient.auth.signUp({
    email,password,
    options:{data:{full_name:name},emailRedirectTo:window.location.href.split("#")[0]}
  });
  if(error){ setAuthMessage(error.message||"Não foi possível criar a conta.",true); return; }
  if(data.session){
    setAuthMessage("Conta criada. A entrar...");
    return;
  }
  pendingSignupEmail=email;
  pendingSignupPassword=password;
  pendingSignupName=name;
  $("otpEmailLabel").textContent=email;
  $("signupOtp").value="";
  authView("authOtpView");
  setAuthMessage("Código enviado. Verifica o teu e-mail.");
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
    if(pendingSignupName && (!state.userName || state.userName==="Letal")){state.userName=pendingSignupName;save();}
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
  await supabaseClient.auth.signOut();
  localStorage.removeItem(KEY);
  setAuthMessage("");
  authView("authLoginView");
};

const toast=t=>{const el=$("toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)};
const defaults={
  userName:"Letal",currency:"Kz",targetPct:20,
  budget:{salary:400000,fixed:150000,variable:110000,debt:0,saving:80000},
  goal:{name:"Minha meta",target:500000,saved:120000},
  sim:{initial:100000,monthly:50000,rate:5,years:5},
  investments:[],
  history:[
    {date:"Maio 2025",salary:400000,expenses:260000,saving:80000,left:60000,total:320000},
    {date:"Abril 2025",salary:400000,expenses:255000,saving:75000,left:70000,total:240000},
    {date:"Março 2025",salary:400000,expenses:250000,saving:80000,left:70000,total:165000}
  ],
  goals:[{name:"Minha meta",target:500000,saved:120000,monthly:40000}]
};
let state=JSON.parse(localStorage.getItem(KEY)||"null")||structuredClone(defaults);
function save(){if(currentUser) localStorage.setItem(KEY,JSON.stringify(state))}
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
  renderGoalMini();renderSim();
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
function navigate(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$("page-"+page).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  $("sidebar").classList.remove("open");
  if(page==="calculator")renderCalculator();if(page==="goals")renderGoals();if(page==="investments")renderInvestments();if(page==="history")renderHistory();if(page==="reports")renderReports();if(page==="settings")renderSettings();
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
function recordHistory(){
  const b=calcBudget();const last=state.history[0]?.total||0;state.history.unshift({date:new Date().toLocaleDateString("pt-AO",{month:"long",year:"numeric"}),salary:b.salary,expenses:b.expenses,saving:b.saving,left:b.left,total:last+b.saving});save();renderHistory();
}
document.querySelectorAll(".nav-item,[data-page]").forEach(el=>el.addEventListener("click",e=>{const p=e.currentTarget.dataset.page;if(p)navigate(p)}));
$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
$("calculate").onclick=()=>{syncBudgetInputs();recordHistory();toast("Orçamento guardado!");};
["salary","fixed","variable","debt","saving"].forEach(id=>$(id).addEventListener("input",()=>{state.budget[id]=+$(id).value||0;save();renderDashboard()}));
["initial","monthly","rate","years"].forEach(id=>$(id).addEventListener("input",()=>{state.sim[id]=+$(id).value||0;save();renderSim()}));
$("calcSave").onclick=()=>{state.budget={salary:+$("calcSalary").value||0,fixed:+$("calcFixed").value||0,variable:+$("calcVariable").value||0,debt:+$("calcDebt").value||0,saving:+$("calcSaving").value||0};save();recordHistory();renderCalculator();renderDashboard();toast("Orçamento guardado!");};
$("addGoal").onclick=()=>{const name=prompt("Nome da meta","Nova meta");if(!name)return;const target=Number(prompt("Valor da meta em Kz","100000"));if(!target)return;state.goals.push({name,target,saved:0,monthly:state.budget.saving});save();renderGoals();toast("Meta criada!");};
$("addInvestment").onclick=()=>{const name=$("invName").value.trim();const amount=+$("invAmount").value||0;const rate=+$("invRate").value||0;if(!name||!amount)return toast("Preenche nome e valor do investimento.");state.investments.push({name,amount,rate});save();$("invName").value="";$("invAmount").value="";$("invRate").value="";renderInvestments();renderDashboard();toast("Investimento adicionado!")};
$("saveSettings").onclick=()=>{state.userName=$("userName").value||"Letal";state.targetPct=+$("targetPct").value||20;state.currency=$("currency").value||"Kz";save();document.querySelector(".user").innerHTML=`Olá, <b>${state.userName}</b> 👋`;renderDashboard();toast("Definições guardadas!")};
$("resetData").onclick=()=>{if(!confirm("Isto apaga os dados guardados neste dispositivo. Continuar?"))return;state=structuredClone(defaults);save();renderDashboard();toast("Dados repostos.")};
$("tipBtn").onclick=()=>alert("Uma boa regra inicial é guardar pelo menos 20% do rendimento. Ajusta a percentagem à tua realidade e mantém uma reserva para emergências.");
$("ruleLink").onclick=e=>{e.preventDefault();alert("A regra 50/30/20 é uma referência: cerca de 50% para necessidades, 30% para desejos e 20% para poupança/investimento. Não é uma regra obrigatória.")};
$("notifyBtn").onclick=()=>toast("Não tens novas notificações.");
document.querySelector(".user").innerHTML=`Olá, <b>${state.userName}</b> 👋`;
renderDashboard();renderHistory();

// Start authentication only after the app state/defaults are initialized.
bootAuth();
