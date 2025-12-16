const $ = id => document.getElementById(id);

/* ---------- API BASE (RENDER) ---------- */
const API_BASE = "https://wealthlens-backend.onrender.com";

/* ---------- Helpers ---------- */
const formatINR = num => Number(num).toLocaleString("en-IN");

/* ---------- Animated Numbers ---------- */
function animateValue(el, start, end, duration = 900) {
  let startTime = null;

  function animation(currentTime) {
    if (!startTime) startTime = currentTime;
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    el.textContent = value.toLocaleString("en-IN");

    if (progress < 1) requestAnimationFrame(animation);
  }

  requestAnimationFrame(animation);
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  };
});

/* ---------- Inputs ---------- */
const monthlyAmount = $("monthlyAmount");
const monthlyAmountBox = $("monthlyAmountBox");
const expectedReturn = $("expectedReturn");
const expectedReturnBox = $("expectedReturnBox");
const years = $("years");
const yearsBox = $("yearsBox");
const stepUp = $("stepUp");
const stepUpBox = $("stepUpBox");
const inflation = $("inflation");
const inflationBox = $("inflationBox");

const expenseRatioBox = $("expenseRatioBox");
const exitLoadBox = $("exitLoadBox");

/* ---------- Sync sliders + boxes ---------- */
function sync(range, box) {
  range.oninput = () => box.value = range.value;
  box.oninput = () => range.value = box.value;
}

sync(monthlyAmount, monthlyAmountBox);
sync(expectedReturn, expectedReturnBox);
sync(years, yearsBox);
sync(stepUp, stepUpBox);
sync(inflation, inflationBox);

let chart;

/* ---------- SIP CALCULATE ---------- */
$("calculateBtn").onclick = async () => {
  try {
    const payload = {
      monthly_amount: +monthlyAmount.value,
      years: +years.value,
      expected_return: +expectedReturn.value,
      step_up_percent: +stepUp.value,
      inflation_percentage: +inflation.value,
      expense_ratio: +expenseRatioBox.value,
      exit_load: +exitLoadBox.value
    };

    const res = await fetch(`${API_BASE}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    const invested = data.sip.total_invested;
    const finalVal = data.sip.final_value;
    const realVal = data.sip.real_value_after_inflation;
    const returns = finalVal - invested;

    /* ---------- Main Values (Animated) ---------- */
    animateValue($("totalInvested"), 0, invested);
    animateValue($("returnsValue"), 0, returns);
    animateValue($("finalValue"), 0, finalVal);
    animateValue($("realValue"), 0, realVal);

    /* ---------- Hidden Costs ---------- */
    const expenseCost = invested * (payload.expense_ratio / 100) * payload.years;
    const exitCost = finalVal * (payload.exit_load / 100);
    const inflationCost = finalVal - realVal;

    $("expenseCost").textContent = formatINR(expenseCost);
    $("exitCost").textContent = formatINR(exitCost);
    $("inflationCost").textContent = formatINR(inflationCost);

    /* ---------- Total Hidden Cost (ANIMATED) ---------- */
    const totalHiddenCost = expenseCost + exitCost + inflationCost;
    const thcEl = $("totalHiddenCost");

    if (thcEl) {
      const prev = Number(thcEl.dataset.value || 0);
      animateValue(thcEl, prev, totalHiddenCost);
      thcEl.dataset.value = totalHiddenCost;
    }

    /* ---------- Micro animation trigger ---------- */
    document.querySelectorAll(".card").forEach(card => {
      card.classList.remove("fade-slide");
      void card.offsetWidth;
      card.classList.add("fade-slide");
    });

    /* ---------- Chart ---------- */
    if (chart) chart.destroy();

    chart = new Chart($("resultChart"), {
      type: "doughnut",
      data: {
        labels: ["Invested", "Returns"],
        datasets: [{
          data: [invested, returns],
          backgroundColor: [
            getComputedStyle(document.documentElement)
              .getPropertyValue("--chart-invested").trim(),
            getComputedStyle(document.documentElement)
              .getPropertyValue("--chart-returns").trim()
          ],
          hoverBackgroundColor: ["#f1f5f9", "#f5d76e"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.raw.toLocaleString("en-IN");
                return ctx.label === "Invested"
                  ? ` ₹ ${val} (Your money invested)`
                  : ` ₹ ${val} (Profit earned)`;
              }
            }
          }
        }
      }
    });

  } catch (err) {
    alert("Calculation failed. Check backend connection.");
    console.error(err);
  }
};

/* ---------- COMPARE STRATEGIES ---------- */
$("compareBtn").onclick = async () => {
  try {
    const base = {
      monthly_amount: +monthlyAmount.value,
      years: +years.value,
      expected_return: +expectedReturn.value,
      step_up_percent: +stepUp.value,
      inflation_percentage: +inflation.value
    };

    const a = await fetch(`${API_BASE}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...base,
        expense_ratio: +$("a_expense").value,
        exit_load: +$("a_exit").value,
        tax_percentage: +$("a_tax").value
      })
    }).then(r => r.json());

    const b = await fetch(`${API_BASE}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...base,
        expense_ratio: +$("b_expense").value,
        exit_load: +$("b_exit").value,
        tax_percentage: +$("b_tax").value
      })
    }).then(r => r.json());

    const diff = b.sip.final_value - a.sip.final_value;

    $("a_final").textContent = formatINR(a.sip.final_value);
    $("b_final").textContent = formatINR(b.sip.final_value);
    $("difference").textContent = formatINR(diff);
    $("difference").className = diff >= 0 ? "positive" : "negative";

  } catch (err) {
    alert("Comparison failed.");
    console.error(err);
  }
};
document.getElementById("pdfSipBtn").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("WealthLens – SIP Report", 14, y);

  y += 12;

  // Inputs
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  doc.text(`Monthly Investment: Rs ${monthlyAmount.value}`, 14, y); y += 8;
  doc.text(`Years: ${years.value}`, 14, y); y += 8;
  doc.text(`Expected Return: ${expectedReturn.value}%`, 14, y); y += 8;
  doc.text(`Inflation: ${inflation.value}%`, 14, y); y += 12;

  // Results
  doc.setFont("helvetica", "bold");
  doc.text("Results", 14, y); y += 10;

  doc.setFont("helvetica", "normal");
  doc.text(`Final Value: Rs ${finalValue.textContent}`, 14, y); y += 8;
  doc.text(`Returns: Rs ${returnsValue.textContent}`, 14, y); y += 8;
  doc.text(`Total Invested: Rs ${totalInvested.textContent}`, 14, y); y += 8;
  doc.text(`Real Value (After Inflation): Rs ${realValue.textContent}`, 14, y); y += 12;

  // Hidden Costs
  doc.setFont("helvetica", "bold");
  doc.text("Hidden Costs", 14, y); y += 10;

  doc.setFont("helvetica", "normal");
  doc.text(`Expense Ratio Cost: Rs ${expenseCost.textContent}`, 14, y); y += 8;
  doc.text(`Exit Load: Rs ${exitCost.textContent}`, 14, y); y += 8;
  doc.text(`Inflation Erosion: Rs ${inflationCost.textContent}`, 14, y); y += 8;
  doc.text(`Total Hidden Cost: Rs ${totalHiddenCost.textContent}`, 14, y);

  doc.save("WealthLens_SIP_Report.pdf");
};
document.getElementById("pdfCompareBtn").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("WealthLens – Strategy Comparison Report", 14, y);

  y += 14;

  // Common Inputs
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  doc.text(`Monthly Investment: Rs ${monthlyAmount.value}`, 14, y); y += 8;
  doc.text(`Years: ${years.value}`, 14, y); y += 8;
  doc.text(`Expected Return: ${expectedReturn.value}%`, 14, y); y += 8;
  doc.text(`Inflation: ${inflation.value}%`, 14, y); y += 12;

  // Strategy A
  doc.setFont("helvetica", "bold");
  doc.text("Strategy A", 14, y); y += 10;

  doc.setFont("helvetica", "normal");
  doc.text(`Expense Ratio: ${document.getElementById("a_expense").value}%`, 14, y); y += 8;
  doc.text(`Exit Load: ${document.getElementById("a_exit").value}%`, 14, y); y += 8;
  doc.text(`Tax: ${document.getElementById("a_tax").value}%`, 14, y); y += 8;
  doc.text(`Final Value: Rs ${document.getElementById("a_final").textContent}`, 14, y);

  y += 14;

  // Strategy B
  doc.setFont("helvetica", "bold");
  doc.text("Strategy B", 14, y); y += 10;

  doc.setFont("helvetica", "normal");
  doc.text(`Expense Ratio: ${document.getElementById("b_expense").value}%`, 14, y); y += 8;
  doc.text(`Exit Load: ${document.getElementById("b_exit").value}%`, 14, y); y += 8;
  doc.text(`Tax: ${document.getElementById("b_tax").value}%`, 14, y); y += 8;
  doc.text(`Final Value: Rs ${document.getElementById("b_final").textContent}`, 14, y);

  y += 14;

  // Difference
  doc.setFont("helvetica", "bold");
  doc.text("Wealth Difference", 14, y); y += 10;

  doc.setFont("helvetica", "normal");
  doc.text(`Difference: Rs ${document.getElementById("difference").textContent}`, 14, y);

  doc.save("WealthLens_Comparison_Report.pdf");
};
