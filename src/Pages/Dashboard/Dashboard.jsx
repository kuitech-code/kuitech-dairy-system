import React, { useState, useEffect } from 'react';
import './Dashboard.css';

function Dashboard() {
  // --- STATE 1: CORE DATA TABLES STATES ---
  const [herd, setHerd] = useState([]);
  const [milkLogs, setMilkLogs] = useState([]);
  const [feedLogs, setFeedLogs] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [breedingEvents, setBreedingEvents] = useState([]);
  const [pregnancies, setPregnancies] = useState([]);
  const [manualIncomes, setManualIncomes] = useState([]);
  const [manualExpenses, setManualExpenses] = useState([]);

  const milkPriceSetting = parseFloat(localStorage.getItem('dairy_global_milk_price')) || 40;

  useEffect(() => {
    setHerd(JSON.parse(localStorage.getItem('dairy_herd') || '[]'));
    setMilkLogs(JSON.parse(localStorage.getItem('dairy_milk_logs') || '[]'));
    setFeedLogs(JSON.parse(localStorage.getItem('dairy_feed_receipts') || '[]'));
    setHealthLogs(JSON.parse(localStorage.getItem('dairy_health_logs') || '[]'));
    setBreedingEvents(JSON.parse(localStorage.getItem('dairy_breeding_events') || '[]'));
    setPregnancies(JSON.parse(localStorage.getItem('dairy_pregnancies') || '[]'));
    setManualIncomes(JSON.parse(localStorage.getItem('dairy_manual_incomes') || '[]'));
    setManualExpenses(JSON.parse(localStorage.getItem('dairy_manual_expenses') || '[]'));
  }, []);

  // --- ENGINE 1: DATE WINDOW INDICATORS ---
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonthKey = today.toISOString().slice(0, 7); // e.g. "2026-07"
  
  const lastMonthDate = new Date(); lastMonthDate.setMonth(today.getMonth() - 1);
  const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // --- ENGINE 2: REVENUE ACCUMULATION CIRCUITS ---
  let thisMonthIncome = 0; let thisMonthExpense = 0; let thisMonthMilkLiters = 0;
  let lastMonthIncome = 0; let lastMonthExpense = 0; let lastMonthMilkLiters = 0;
  let monthlyMilkTotal = 0; let monthlySaleTotal = 0; let monthlyOtherIncome = 0;

  let cowProductionTotals = {}; // Tracks which cow produced how much for leaderboard
  let daily30DayMilk = {}; // Tracks milk over last 30 days
  let trend3Months = {};

  // Setup past 3 months trend map frames
  for (let i = 2; i >= 0; i--) {
    const d = new Date(); d.setMonth(today.getMonth() - i);
    trend3Months[d.toISOString().slice(0, 7)] = { income: 0, expense: 0, name: monthNames[d.getMonth()] };
  }

  // Setup last 30 days keys for the production graph chart lines
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(today.getDate() - i);
    daily30DayMilk[d.toISOString().split('T')[0]] = 0;
  }

  // A. Process Milk logs
  milkLogs.forEach(log => {
    const mKey = log.record_date.slice(0, 7);
    const rate = log.milkPriceAtLogging || milkPriceSetting;
    const revenue = log.total_daily_milk * rate;

    // Accumulate Leaderboard values
    if (log.total_daily_milk > 0) {
      cowProductionTotals[log.cowName] = (cowProductionTotals[log.cowName] || 0) + log.total_daily_milk;
    }

    // Accumulate 30 Day Graph lines
    if (daily30DayMilk[log.record_date] !== undefined) {
      daily30DayMilk[log.record_date] += log.total_daily_milk;
    }

    if (mKey === currentMonthKey) {
      thisMonthIncome += revenue;
      thisMonthMilkLiters += log.total_daily_milk;
      monthlyMilkTotal += revenue;
    }
    if (mKey === lastMonthKey) {
      lastMonthIncome += revenue;
      lastMonthMilkLiters += log.total_daily_milk;
    }
    if (trend3Months[mKey]) trend3Months[mKey].income += revenue;
  });

  // B. Process Cow sales
  let calvesBornThisMonth = 0; let cowsAcquiredThisMonth = 0;
  herd.forEach(cow => {
    const regMonth = cow.dob ? cow.dob.slice(0, 7) : '';
    if (regMonth === currentMonthKey) {
      if (cow.status === 'Calf') calvesBornThisMonth++;
      else cowsAcquiredThisMonth++;
    }

    if (cow.status.startsWith('Archived (Sold)')) {
      const notesText = cow.notes || '';
      const matchKSh = notesText.match(/KSh\s*(\d+)/) || notesText.match(/\$(\d+)/);
      const saleValue = matchKSh ? parseFloat(matchKSh[1]) : 45000;

      thisMonthIncome += saleValue;
      monthlySaleTotal += saleValue;
      if (trend3Months[currentMonthKey]) trend3Months[currentMonthKey].income += saleValue;
    }
  });

  // C. Process Manual Incomes (Other Income)
  manualIncomes.forEach(inc => {
    const mKey = inc.date.slice(0, 7);
    if (mKey === currentMonthKey) {
      thisMonthIncome += inc.amount;
      monthlyOtherIncome += inc.amount;
    }
    if (mKey === lastMonthKey) lastMonthIncome += inc.amount;
    if (trend3Months[mKey]) trend3Months[mKey].income += inc.amount;
  });

  // D. Process Feed Costs
  feedLogs.forEach(f => {
    const mKey = f.purchaseDate.slice(0, 7);
    if (mKey === currentMonthKey) thisMonthExpense += f.cost;
    if (mKey === lastMonthKey) lastMonthExpense += f.cost;
    if (trend3Months[mKey]) trend3Months[mKey].expense += f.cost;
  });

  // E. Process Medical Costs
  healthLogs.forEach(h => {
    const mKey = h.treatmentDate.slice(0, 7);
    if (mKey === currentMonthKey) thisMonthExpense += h.cost;
    if (mKey === lastMonthKey) lastMonthExpense += h.cost;
    if (trend3Months[mKey]) trend3Months[mKey].expense += h.cost;
  });

  // F. Process Breeding Costs
  breedingEvents.forEach(b => {
    if (b.eventType === 'Insemination' && b.cost > 0) {
      const mKey = b.eventDate.slice(0, 7);
      if (mKey === currentMonthKey) thisMonthExpense += b.cost;
      if (mKey === lastMonthKey) lastMonthExpense += b.cost;
      if (trend3Months[mKey]) trend3Months[mKey].expense += b.cost;
    }
  });

  // G. Process Manual Expenses
  manualExpenses.forEach(e => {
    const mKey = e.date.slice(0, 7);
    if (mKey === currentMonthKey) thisMonthExpense += e.amount;
    if (mKey === lastMonthKey) lastMonthExpense += e.amount;
    if (trend3Months[mKey]) trend3Months[mKey].expense += e.amount;
  });

  // Summary Math Cards Calculations
  const thisMonthProfit = thisMonthIncome - thisMonthExpense;
  const lastMonthProfit = lastMonthIncome - lastMonthExpense;
  const profitMarginPct = thisMonthIncome > 0 ? Math.round((thisMonthProfit / thisMonthIncome) * 100) : 0;
  
  const currentDayCount = today.getDate() || 1;
  const avgMilkPerDay = Math.round((thisMonthMilkLiters / currentDayCount) * 10) / 10;

  // Percentage Variance Trackers for Top Banner
  const incVar = lastMonthIncome > 0 ? Math.round(((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100) : 12;
  const expVar = lastMonthExpense > 0 ? Math.round(((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100) : -4;
  const prfVar = lastMonthProfit > 0 ? Math.round(((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 100) : 18;

  // --- ENGINE 3: LEADERBOARD COWS EVALUATOR ---
  let topProducerName = "None"; let topProducerQty = 0;
  let lowProducerName = "None"; let lowProducerQty = 99999;

  Object.keys(cowProductionTotals).forEach(name => {
    if (cowProductionTotals[name] > topProducerQty) {
      topProducerQty = cowProductionTotals[name]; topProducerName = name;
    }
    if (cowProductionTotals[name] < lowProducerQty) {
      lowProducerQty = cowProductionTotals[name]; lowProducerName = name;
    }
  });
  if (lowProducerQty === 99999) lowProducerQty = 0;

  // --- ENGINE 4: HERD COUNT SEPARATOR DECK ---
  const activeMilkingCount = herd.filter(a => a.status === 'Milking').length;
  const dryRestingCount = herd.filter(a => a.status === 'Dry').length;
  const heifersCount = herd.filter(a => a.status === 'Heifer').length;
  const calvesCount = herd.filter(a => a.status === 'Calf').length;
  const totalHeadCount = herd.filter(a => !a.status.startsWith('Archived')).length;

  // --- ENGINE 5: UPCOMING CALVING ALERTS MATRICES ---
  // Filter out pregnancies whose expected due date has not passed yet, sorted by nearest date
  const upcomingCalvingsList = pregnancies
    .filter(p => !p.isDry && p.expectedDueDate && p.expectedDueDate >= todayStr)
    .sort((a, b) => new Date(a.expectedDueDate) - new Date(b.expectedDueDate));

  // --- ENGINE 6: HEALTH EXAMINATIONS WEEKLY DECK ---
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(today.getDate() - 7);
  const activeSickLogs = healthLogs.filter(log => {
    const treatDate = new Date(log.treatmentDate);
    // Active if treated this week OR has an ongoing withdrawal period running
    const isWithdrawalRunning = log.withdrawalDays > 0 && 
      (new Date(log.treatmentDate).setDate(new Date(log.treatmentDate).getDate() + log.withdrawalDays) > today);
    return (treatDate >= oneWeekAgo || log.treatmentStatus === 'Chronic' || isWithdrawalRunning);
  });

  return (
    <div className="dashboard-viewport-wrapper">
      
      {/* 🚀 TOP BANNER: HERO STATS MARQUEE BOARDS */}
      <div className="dashboard-marquee-banner-container">
        <div className="marquee-badge badge-gold">
          <strong>Top Producer:</strong> {topProducerName} ({topProducerQty}L)
        </div>
        <div className="marquee-badge badge-blue">
          <strong>Lowest Producer:</strong> {lowProducerName} ({lowProducerQty}L)
        </div>
        <div className="marquee-badge badge-purple">
          <strong>New Additions:</strong> +{calvesBornThisMonth} Calves Born • +{cowsAcquiredThisMonth} Cows Acquired
        </div>
        <div className="marquee-badge badge-green">
          <strong>Finance:</strong> Income {incVar >= 0 ? '↑' : '↓'} {Math.abs(incVar)}% • Expenses {expVar >= 0 ? '↑' : '↓'} {Math.abs(expVar)}% • Profit {prfVar >= 0 ? '↑' : '↓'} {Math.abs(prfVar)}%
        </div>
      </div>
      {/* 📅 CARD 1: DENSE MONTHLY SUMMARY MATRICES CHANNELS */}
      <div className="dashboard-card-box">
        <div className="dashboard-section-header">Summary: This Month</div>
        <div className="dense-summary-flexbox-row">
          <div className="dense-node">
            <span>Milk</span>
            <p>{thisMonthMilkLiters} L</p>
          </div>
          <div className="dense-node">
            <span>Profit</span>
            <p>{profitMarginPct}%</p>
          </div>
        </div> 
        <div className="dense-summary-flexbox-row"> 
          <div className="dense-node">
            <span>Avg Daily Milk</span>
            <p>{avgMilkPerDay} L/Day</p>
          </div>
          <div className="dense-node highlighted-node">
            <span>Net Profit</span>
            <p>KES {thisMonthProfit.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 📊 CARD 2: RE-ENGINEERED SMOOTH BEZIER SPLINE CARDS */}
      <div className="dashboard-card-box">
        <h2>Milk Yield Trend</h2>
        <div className="chart-wrapper-frame">
          <div className="svg-chart-container-with-y-axis">
            
            <div className="y-axis-labels-gutter-column milk-only-axis">
              <span>220L</span>
              <span>165L</span>
              <span>110L</span>
              <span>55L</span>
              <span>0L</span>
            </div>

            {/* Core Vector Chart Grid Frame Viewport window */}
            <div className="svg-canvas-viewport-window">
              <svg viewBox="0 0 500 150" className="svg-chart-canvas" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="milkAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2ecc71" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2ecc71" stopOpacity="0.03" />
                  </linearGradient>
                  <linearGradient id="milkLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#2ecc71" />
                  </linearGradient>
                </defs>
                {/* Horizontal reference grid sheets */}
                <line x1="0" y1="10" x2="500" y2="10" className="grid-line" />
                <line x1="0" y1="42.5" x2="500" y2="42.5" className="grid-line" />
                <line x1="0" y1="75" x2="500" y2="75" className="grid-line" />
                <line x1="0" y1="107.5" x2="500" y2="107.5" className="grid-line" />
                <line x1="0" y1="140" x2="500" y2="140" className="grid-line baseline" />
                
                {(() => {
                  const dataSlice = Object.keys(daily30DayMilk).slice(-6);
                  const pointsCoordinatesList = dataSlice.map((dateKey, index) => {
                    const liters = daily30DayMilk[dateKey];
                    const x = (index * (500 / (dataSlice.length - 1 || 1)));
                    const y = 140 - Math.min((liters * (130 / 220)), 130);
                    return { x, y, liters, dateKey };
                  });

                  let bezierCurvePathString = "";
                  if (pointsCoordinatesList.length > 0) {
                    bezierCurvePathString = `M ${pointsCoordinatesList[0].x} ${pointsCoordinatesList[0].y}`;
                    for (let i = 0; i < pointsCoordinatesList.length - 1; i++) {
                      const currentPoint = pointsCoordinatesList[i];
                      const nextPoint = pointsCoordinatesList[i + 1];
                      const controlPointX1 = currentPoint.x + (nextPoint.x - currentPoint.x) / 2;
                      const controlPointY1 = currentPoint.y;
                      const controlPointX2 = currentPoint.x + (nextPoint.x - currentPoint.x) / 2;
                      const controlPointY2 = nextPoint.y;
                      bezierCurvePathString += ` C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${nextPoint.x} ${nextPoint.y}`;
                    }
                  }

                  const milkAreaPath = bezierCurvePathString && pointsCoordinatesList.length > 0
                    ? `${bezierCurvePathString} L ${pointsCoordinatesList[pointsCoordinatesList.length - 1].x} 140 L ${pointsCoordinatesList[0].x} 140 Z`
                    : "";

                  return (
                    <>
                      {milkAreaPath && <path d={milkAreaPath} className="svg-area-fill" fill="url(#milkAreaGradient)" />}
                      {bezierCurvePathString && (
                        <path d={bezierCurvePathString} className="svg-smooth-curve-line milk-line" stroke="url(#milkLineGradient)" />
                      )}
                      {pointsCoordinatesList.map((pt) => (
                        <g key={pt.dateKey} className="chart-marker-group">
                          <circle cx={pt.x} cy={pt.y} r="4.5" className="marker-dot milk-dot" />
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          <div className="x-axis-dates-row-scale-deck milk-simple-axis">
            {Object.keys(daily30DayMilk).slice(-6).map(dateKey => (
              <span key={dateKey}>{dateKey.slice(5)}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-card-box">
        <h2>3-Month Net Profit</h2>
        <div className="chart-wrapper-frame">
          <div className="svg-chart-container-with-y-axis">
            
            <div className="y-axis-labels-gutter-column">
              <span>120k</span>
              <span>90k</span>
              <span>60k</span>
              <span>30k</span>
              <span>0k</span>
            </div>

            <div className="svg-canvas-viewport-window">
              <svg viewBox="0 0 500 150" className="svg-chart-canvas" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="profitAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3498db" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#3498db" stopOpacity="0.03" />
                  </linearGradient>
                  <linearGradient id="profitLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5dade2" />
                    <stop offset="100%" stopColor="#3498db" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="10" x2="500" y2="10" className="grid-line" />
                <line x1="0" y1="42.5" x2="500" y2="42.5" className="grid-line" />
                <line x1="0" y1="75" x2="500" y2="75" className="grid-line" />
                <line x1="0" y1="107.5" x2="500" y2="107.5" className="grid-line" />
                <line x1="0" y1="140" x2="500" y2="140" className="grid-line baseline" />

                {(() => {
                  const trendKeys = Object.keys(trend3Months);
                  const points = trendKeys.map((key, index) => {
                    const info = trend3Months[key];
                    const profitValue = info.income - info.expense;
                    const x = index * (500 / (trendKeys.length - 1 || 1));
                    const y = 140 - Math.min((profitValue * (130 / 120000)), 130);
                    return { x, y, profitValue, name: info.name };
                  });

                  let profitBezierPath = "";
                  if (points.length > 0) {
                    profitBezierPath = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 0; i < points.length - 1; i++) {
                      const cpX1 = points[i].x + (points[i+1].x - points[i].x) / 2;
                      const cpX2 = points[i].x + (points[i+1].x - points[i].x) / 2;
                      profitBezierPath += ` C ${cpX1} ${points[i].y}, ${cpX2} ${points[i+1].y}, ${points[i+1].x} ${points[i+1].y}`;
                    }
                  }

                  const profitAreaPath = profitBezierPath && points.length > 0
                    ? `${profitBezierPath} L ${points[points.length - 1].x} 140 L ${points[0].x} 140 Z`
                    : "";

                  return (
                    <>
                      {profitAreaPath && <path d={profitAreaPath} className="svg-area-fill" fill="url(#profitAreaGradient)" />}
                      {profitBezierPath && (
                        <path d={profitBezierPath} className="svg-smooth-curve-line profit-line" stroke="url(#profitLineGradient)" />
                      )}
                      {points.map((pt, i) => (
                        <g key={i} className="chart-marker-group">
                          {pt.profitValue > 0 && (
                            <text x={pt.x} y={pt.y - 12} className="marker-label-text active-data-bubble bold">KSh {Math.round(pt.profitValue/1000)}k</text>
                          )}
                          <circle cx={pt.x} cy={pt.y} r="6" className="marker-dot profit-dot" />
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          <div className="x-axis-dates-row-scale-deck monthly">
            {Object.keys(trend3Months).map(key => (
              <span key={key}>{trend3Months[key].name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 📋 CARD 3: TOTAL HERD INVENTORY & MONTHLY FINANCIAL STATEMENT MATRIX */}
      <div className="dashboard-card-box split-grid-card">
        <div className="split-panel">
          <h2>Total Herd Inventory ({totalHeadCount} Cows)</h2>
          <ul className="inventory-list-stack">
            <li>Active Milking: <strong>{activeMilkingCount}</strong></li>
            <li>Dry Cows: <strong>{dryRestingCount}</strong></li>
            <li>Heifers: <strong>{heifersCount}</strong></li>
            <li>Calves: <strong>{calvesCount}</strong></li>
          </ul>
        </div>
        <div className="split-panel layout-border-left">
          <h2>Monthly Financial Totals</h2>
          <ul className="inventory-list-stack">
            <li className="text-red">Total Expenses Cost: <strong>-KES {thisMonthExpense.toLocaleString()}</strong></li>
            <li className="text-green">Milk Sales: <strong>+KES {monthlyMilkTotal.toLocaleString()}</strong></li>
            <li className="text-green">Livestock Sales: <strong>+KES {monthlySaleTotal.toLocaleString()}</strong></li>
            <li className="text-green">Other Income: <strong>+KES {monthlyOtherIncome.toLocaleString()}</strong></li>
          </ul>
        </div>
      </div>

      {/* 🤰 CARD 4: UPCOMING CALVING MILESTONES ALERT DESK */}
      <div className="dashboard-card-box calving-desk-card">
        <h2>Upcoming Calving Watch List</h2>
        {upcomingCalvingsList.length === 0 ? (
          <p className="clean-empty-label-notice">✅ No active pregnancies due inside the current upcoming timeline windows.</p>
        ) : (
          <div className="calving-alerts-stack">
            {upcomingCalvingsList.slice(0, 3).map((p) => (
              <div key={p.id} className="calving-alert-item-row-card">
                <span>🔔</span>
                <p><strong>{p.cowName}</strong> (Tag: {p.cowTag}) is due to calve on <strong>{new Date(p.expectedDueDate).toLocaleDateString()}</strong> (Sire: {p.semenTag})</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🩺 CARD 5: WEEKLY MEDICAL & WITHDRAWAL SAFETY DESK */}
      <div className="dashboard-card-box health-desk-card">
        <h2>Weekly Medical Records</h2>
        {activeSickLogs.length === 0 ? (
          <p className="clean-empty-label-notice-green">Excellent: No cows under medical treatment or active milk withdrawal restrictions this week.</p>
        ) : (
          <div className="health-alerts-stack-deck">
            <div className="critical-headline-warn">{activeSickLogs.length} Cow/s records to monitor this week:</div>
            {activeSickLogs.slice(0, 4).map((log) => {
              const treatDate = new Date(log.treatmentDate);
              const todayNoHours = new Date(); todayNoHours.setHours(0,0,0,0);
              const releaseDate = new Date(treatDate); releaseDate.setDate(releaseDate.getDate() + log.withdrawalDays);
              const remainingDays = Math.max(Math.ceil((releaseDate - todayNoHours) / (1000 * 60 * 60 * 24)), 0);

              return (
                <div key={log.id} className="medical-alert-row-card-item">
                  <span className="med-bullet-dot">💊</span>
                  <div className="med-alert-text-block">
                    <h5>{log.cowName} <small>(Tag: {log.cowTag})</small></h5>
                    <p>Condition: <strong>{log.diagnosis}</strong> • Status: <em>{log.treatmentStatus}</em></p>
                    {log.withdrawalDays > 0 && remainingDays > 0 ? (
                      <span className="critical-dump-badge-pill">DUMP MILK: {remainingDays} Days Left</span>
                    ) : log.withdrawalDays > 0 ? (
                      <span className="safe-release-badge-pill">Released to Tank Lines</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

export default Dashboard;
