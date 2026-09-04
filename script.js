const fmt = n => new Intl.NumberFormat("pt-AO").format(Math.round(n));
const $ = id => document.getElementById(id);

function calculate(){
  const salary=Number($("salary").value)||0;
  const fixed=Number($("fixed").value)||0;
  const variable=Number($("variable").value)||0;
  const debt=Number($("debt").value)||0;
  const saving=Number($("saving").value)||0;
  const expenses=fixed+variable+debt;
  const left=Math.max(0,salary-expenses-saving);
  const savingPct=salary?Math.round(saving/salary*100):0;
  $("salaryCard").textContent=fmt(salary)+" Kz";
  $("expenseCard").textContent=fmt(expenses)+" Kz";
  $("savingCard").textContent=fmt(saving)+" Kz";
  $("leftCard").textContent=fmt(left)+" Kz";
  $("donutTotal").textContent=fmt(salary);
  $("legendLeft").textContent=fmt(left);
  $("ring").textContent=savingPct+"%";
  $("resultDetail").textContent=`Estás a poupar ${savingPct}% do teu salário.`;
  $("resultText").textContent=savingPct>=20?"Estás no caminho certo! 👏":"Podes melhorar a tua poupança.";
  const vals=[fixed,variable,saving,left];
  vals.forEach((v,i)=>$("p"+(i+1)).textContent=salary?(v/salary*100).toFixed(1):"0");
  const a=salary?fixed/salary*100:0,b=salary?variable/salary*100:a,c=salary?saving/salary*100:0;
  $("donut").style.background=`conic-gradient(#3475df 0 ${a}%,#7747c9 ${a}% ${a+b}%,#39ad63 ${a+b}% ${a+b+c}%,#f2942e ${a+b+c}% 100%)`;
}
$("calculate").addEventListener("click",calculate);
["salary","fixed","variable","debt","saving"].forEach(id=>$(id).addEventListener("input",calculate));

function simulate(){
  let principal=Number($("initial").value)||0, monthly=Number($("monthly").value)||0, rate=(Number($("rate").value)||0)/100;
  const months=60, monthlyRate=rate/12;
  const values=[];
  let total=principal;
  for(let m=0;m<=months;m++){
    if(m>0) total=total*(1+monthlyRate)+monthly;
    if(m%12===0) values.push(total);
  }
  $("future").textContent=fmt(values.at(-1))+" Kz";
  const max=Math.max(...values);
  $("bars").innerHTML=values.map((v,i)=>`<div class="bar" style="height:${Math.max(5,v/max*125)}px"><span>Ano ${i}</span></div>`).join("");
}
["initial","monthly","rate"].forEach(id=>$(id).addEventListener("input",simulate));
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
calculate(); simulate();