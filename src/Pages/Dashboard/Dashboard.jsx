import React, { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';

const DATA_KEYS = {
  herd: 'dairy_herd',
  milk: 'dairy_milk_logs',
  feed: 'dairy_feed_receipts',
  health: 'dairy_health_logs',
  breeding: 'dairy_breeding_events',
  pregnancies: 'dairy_pregnancies',
  incomes: 'dairy_manual_incomes',
  expenses: 'dairy_manual_expenses',
};

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

/* UTC conversion. */
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  return localDateString(date).slice(0, 7);
}

function formatDate(dateString) {
  if (!dateString) return '—';

  const parts = dateString.split('-');

  if (parts.length !== 3) {
    return new Date(dateString).toLocaleDateString();
  }

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  ).toLocaleDateString();
}

function Dashboard() {
  const [herd, setHerd] = useState([]);
  const [milkLogs, setMilkLogs] = useState([]);
  const [feedLogs, setFeedLogs] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [breedingEvents, setBreedingEvents] = useState([]);
  const [pregnancies, setPregnancies] = useState([]);
  const [manualIncomes, setManualIncomes] = useState([]);
  const [manualExpenses, setManualExpenses] = useState([]);

  const [currentTime, setCurrentTime] = useState(new Date());

  const milkPriceSetting =
    parseFloat(localStorage.getItem('dairy_global_milk_price')) || 40;

  useEffect(() => {
    setHerd(readStorage(DATA_KEYS.herd));
    setMilkLogs(readStorage(DATA_KEYS.milk));
    setFeedLogs(readStorage(DATA_KEYS.feed));
    setHealthLogs(readStorage(DATA_KEYS.health));
    setBreedingEvents(readStorage(DATA_KEYS.breeding));
    setPregnancies(readStorage(DATA_KEYS.pregnancies));
    setManualIncomes(readStorage(DATA_KEYS.incomes));
    setManualExpenses(readStorage(DATA_KEYS.expenses));

    /*
     * Keeps the dashboard's "today" information fresh if the
     * application stays open across midnight.
     */
    const clock = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(clock);
  }, []);

  const dashboardData = useMemo(() => {
    const today = currentTime;
    const todayStr = localDateString(today);
    const currentMonthKey = monthKey(today);

    const lastMonthDate = new Date(today);
    lastMonthDate.setMonth(today.getMonth() - 1);
    const lastMonthKey = monthKey(lastMonthDate);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    let todayMilkLiters = 0;

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    let thisMonthMilkLiters = 0;

    let lastMonthIncome = 0;
    let lastMonthExpense = 0;

    let monthlyMilkTotal = 0;
    let monthlySaleTotal = 0;
    let monthlyOtherIncome = 0;

    const cowProductionTotals = {};

    /*
     * Build the last 30 calendar days.
     */
    const daily30DayMilk = {};

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      daily30DayMilk[localDateString(date)] = 0;
    }

    /*
     * Build the last 3 months.
     */
    const trend3Months = {};

    for (let i = 2; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(today.getMonth() - i);

      const key = monthKey(date);

      trend3Months[key] = {
        income: 0,
        expense: 0,
        name: monthNames[date.getMonth()],
      };
    }

    /*
     * ---------------------------------------------------------
     * MILK
     * ---------------------------------------------------------
     */
    milkLogs.forEach((log) => {
      if (!log.record_date) return;

      const liters = Number(log.total_daily_milk) || 0;
      const rate =
        Number(log.milkPriceAtLogging) || milkPriceSetting;

      const revenue = liters * rate;
      const logMonth = log.record_date.slice(0, 7);

      if (log.record_date === todayStr) {
        todayMilkLiters += liters;
      }

      if (liters > 0) {
        const cowName = log.cowName || 'Unknown Cow';

        cowProductionTotals[cowName] =
          (cowProductionTotals[cowName] || 0) + liters;
      }

      if (daily30DayMilk[log.record_date] !== undefined) {
        daily30DayMilk[log.record_date] += liters;
      }

      if (logMonth === currentMonthKey) {
        thisMonthIncome += revenue;
        thisMonthMilkLiters += liters;
        monthlyMilkTotal += revenue;
      }

      if (logMonth === lastMonthKey) {
        lastMonthIncome += revenue;
      }

      if (trend3Months[logMonth]) {
        trend3Months[logMonth].income += revenue;
      }
    });

    /*
     * ---------------------------------------------------------
     * HERD / LIVESTOCK SALES
     * ---------------------------------------------------------
     */
    let calvesBornThisMonth = 0;
    let cowsAcquiredThisMonth = 0;

    herd.forEach((cow) => {
      /*
       * Keeping your existing data structure here.
       * We do not invent a new acquiredDate field.
       */
      const regMonth = cow.dob ? cow.dob.slice(0, 7) : '';

      if (regMonth === currentMonthKey) {
        if (cow.status === 'Calf') {
          calvesBornThisMonth++;
        } else {
          cowsAcquiredThisMonth++;
        }
      }

      const status = String(cow.status || '');

      if (status.startsWith('Archived (Sold)')) {
        const notesText = cow.notes || '';

        const matchKSh =
          notesText.match(/KSh\s*([\d,]+)/i) ||
          notesText.match(/KES\s*([\d,]+)/i) ||
          notesText.match(/\$([\d,]+)/);

        const saleValue = matchKSh
          ? parseFloat(matchKSh[1].replace(/,/g, ''))
          : 45000;

        /*
         * Preserve the existing dashboard behavior.
         * Sale date is not currently stored consistently enough
         * to safely redesign this calculation here.
         */
        thisMonthIncome += saleValue;
        monthlySaleTotal += saleValue;

        if (trend3Months[currentMonthKey]) {
          trend3Months[currentMonthKey].income += saleValue;
        }
      }
    });

    /*
     * ---------------------------------------------------------
     * MANUAL INCOME
     * ---------------------------------------------------------
     */
    manualIncomes.forEach((income) => {
      if (!income.date) return;

      const amount = Number(income.amount) || 0;
      const incomeMonth = income.date.slice(0, 7);

      if (incomeMonth === currentMonthKey) {
        thisMonthIncome += amount;
        monthlyOtherIncome += amount;
      }

      if (incomeMonth === lastMonthKey) {
        lastMonthIncome += amount;
      }

      if (trend3Months[incomeMonth]) {
        trend3Months[incomeMonth].income += amount;
      }
    });

    /*
     * ---------------------------------------------------------
     * FEED
     * ---------------------------------------------------------
     */
    feedLogs.forEach((feed) => {
      if (!feed.purchaseDate) return;

      const amount = Number(feed.cost) || 0;
      const feedMonth = feed.purchaseDate.slice(0, 7);

      if (feedMonth === currentMonthKey) {
        thisMonthExpense += amount;
      }

      if (feedMonth === lastMonthKey) {
        lastMonthExpense += amount;
      }

      if (trend3Months[feedMonth]) {
        trend3Months[feedMonth].expense += amount;
      }
    });

    /*
     * ---------------------------------------------------------
     * MEDICAL
     * ---------------------------------------------------------
     */
    healthLogs.forEach((health) => {
      if (!health.treatmentDate) return;

      const amount = Number(health.cost) || 0;
      const healthMonth = health.treatmentDate.slice(0, 7);

      if (healthMonth === currentMonthKey) {
        thisMonthExpense += amount;
      }

      if (healthMonth === lastMonthKey) {
        lastMonthExpense += amount;
      }

      if (trend3Months[healthMonth]) {
        trend3Months[healthMonth].expense += amount;
      }
    });

    /*
     * ---------------------------------------------------------
     * BREEDING / AI COSTS
     * ---------------------------------------------------------
     */
    breedingEvents.forEach((event) => {
      if (
        event.eventType !== 'Insemination' ||
        Number(event.cost) <= 0 ||
        !event.eventDate
      ) {
        return;
      }

      const amount = Number(event.cost) || 0;
      const eventMonth = event.eventDate.slice(0, 7);

      if (eventMonth === currentMonthKey) {
        thisMonthExpense += amount;
      }

      if (eventMonth === lastMonthKey) {
        lastMonthExpense += amount;
      }

      if (trend3Months[eventMonth]) {
        trend3Months[eventMonth].expense += amount;
      }
    });

    /*
     * ---------------------------------------------------------
     * MANUAL EXPENSES
     * ---------------------------------------------------------
     */
    manualExpenses.forEach((expense) => {
      if (!expense.date) return;

      const amount = Number(expense.amount) || 0;
      const expenseMonth = expense.date.slice(0, 7);

      if (expenseMonth === currentMonthKey) {
        thisMonthExpense += amount;
      }

      if (expenseMonth === lastMonthKey) {
        lastMonthExpense += amount;
      }

      if (trend3Months[expenseMonth]) {
        trend3Months[expenseMonth].expense += amount;
      }
    });

    /*
     * ---------------------------------------------------------
     * FINANCIAL CALCULATIONS
     * ---------------------------------------------------------
     */
    const thisMonthProfit =
      thisMonthIncome - thisMonthExpense;

    const lastMonthProfit =
      lastMonthIncome - lastMonthExpense;

    const profitMarginPct =
      thisMonthIncome > 0
        ? Math.round((thisMonthProfit / thisMonthIncome) * 100)
        : 0;

    const currentDayCount = today.getDate() || 1;

    const avgMilkPerDay =
      Math.round(
        (thisMonthMilkLiters / currentDayCount) * 10
      ) / 10;

    const incVar =
      lastMonthIncome > 0
        ? Math.round(
            ((thisMonthIncome - lastMonthIncome) /
              lastMonthIncome) *
              100
          )
        : 0;

    const expVar =
      lastMonthExpense > 0
        ? Math.round(
            ((thisMonthExpense - lastMonthExpense) /
              lastMonthExpense) *
              100
          )
        : 0;

    const prfVar =
      lastMonthProfit !== 0
        ? Math.round(
            ((thisMonthProfit - lastMonthProfit) /
              Math.abs(lastMonthProfit)) *
              100
          )
        : 0;

    /*
     * ---------------------------------------------------------
     * PRODUCER LEADERBOARD
     * ---------------------------------------------------------
     */
    let topProducerName = 'None';
    let topProducerQty = 0;

    let lowProducerName = 'None';
    let lowProducerQty = Infinity;

    Object.entries(cowProductionTotals).forEach(
      ([name, quantity]) => {
        if (quantity > topProducerQty) {
          topProducerQty = quantity;
          topProducerName = name;
        }

        if (quantity < lowProducerQty) {
          lowProducerQty = quantity;
          lowProducerName = name;
        }
      }
    );

    if (lowProducerQty === Infinity) {
      lowProducerQty = 0;
    }

    /*
     * ---------------------------------------------------------
     * HERD COUNTS
     * ---------------------------------------------------------
     */
    const activeMilkingCount = herd.filter(
      (cow) => cow.status === 'Milking'
    ).length;

    const heifersCount = herd.filter(
      (cow) => cow.status === 'Heifer'
    ).length;

    const calvesCount = herd.filter(
      (cow) => cow.status === 'Calf'
    ).length;

    const totalHeadCount = herd.filter(
      (cow) => !String(cow.status || '').startsWith('Archived')
    ).length;

    /*
     * ---------------------------------------------------------
     * CALVING ALERTS
     * ---------------------------------------------------------
     */
    const upcomingCalvingsList = pregnancies
      .filter(
        (pregnancy) =>
          !pregnancy.isDry &&
          pregnancy.expectedDueDate &&
          pregnancy.expectedDueDate >= todayStr
      )
      .sort(
        (a, b) =>
          new Date(a.expectedDueDate) -
          new Date(b.expectedDueDate)
      );

    /*
     * ---------------------------------------------------------
     * POST-CALVING HEAT
     * ---------------------------------------------------------
     */
    const postCalvingHeatAlerts = herd.filter((cow) => {
      if (
        !cow.calvingAlertStartDate ||
        !cow.calvingAlertEndDate
      ) {
        return false;
      }

      return (
        todayStr >= cow.calvingAlertStartDate &&
        todayStr <= cow.calvingAlertEndDate
      );
    });

    /*
     * ---------------------------------------------------------
     * RETURN HEAT
     * ---------------------------------------------------------
     */
    const returnHeatAlerts = breedingEvents
      .filter(
        (event) =>
          event.eventType === 'Insemination' &&
          event.result === 'Pending' &&
          event.returnWindowStart &&
          event.returnWindowStart <= todayStr
      )
      .sort(
        (a, b) =>
          new Date(a.returnWindowStart) -
          new Date(b.returnWindowStart)
      );

    /*
     * ---------------------------------------------------------
     * MEDICAL / WITHDRAWAL
     * ---------------------------------------------------------
     */
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    const activeSickLogs = healthLogs.filter((log) => {
      if (!log.treatmentDate) return false;

      const treatmentDate = new Date(log.treatmentDate);

      const withdrawalDays =
        Number(log.withdrawalDays) || 0;

      const releaseDate = new Date(log.treatmentDate);
      releaseDate.setDate(
        releaseDate.getDate() + withdrawalDays
      );

      const isWithdrawalRunning =
        withdrawalDays > 0 &&
        releaseDate > today;

      return (
        treatmentDate >= oneWeekAgo ||
        log.treatmentStatus === 'Chronic' ||
        isWithdrawalRunning
      );
    });

    /*
     * ---------------------------------------------------------
     * TODAY'S MILKING / ATTENTION
     * ---------------------------------------------------------
     */
    const activeAttentionCount =
      activeSickLogs.length +
      upcomingCalvingsList.filter((p) => {
        const due = new Date(p.expectedDueDate);
        const difference =
          Math.ceil(
            (due - new Date(todayStr)) /
              (1000 * 60 * 60 * 24)
          );

        return difference <= 14;
      }).length +
      returnHeatAlerts.length +
      postCalvingHeatAlerts.length;

    return {
      todayStr,
      todayMilkLiters,

      thisMonthIncome,
      thisMonthExpense,
      thisMonthMilkLiters,
      thisMonthProfit,
      profitMarginPct,
      avgMilkPerDay,

      incVar,
      expVar,
      prfVar,

      monthlyMilkTotal,
      monthlySaleTotal,
      monthlyOtherIncome,

      topProducerName,
      topProducerQty,
      lowProducerName,
      lowProducerQty,

      activeMilkingCount,
      heifersCount,
      calvesCount,
      totalHeadCount,

      calvesBornThisMonth,
      cowsAcquiredThisMonth,

      daily30DayMilk,
      trend3Months,

      upcomingCalvingsList,
      postCalvingHeatAlerts,
      returnHeatAlerts,
      activeSickLogs,

      activeAttentionCount,
    };
  }, [
    currentTime,
    herd,
    milkLogs,
    feedLogs,
    healthLogs,
    breedingEvents,
    pregnancies,
    manualIncomes,
    manualExpenses,
    milkPriceSetting,
  ]);

  const {
    todayStr,
    todayMilkLiters,
    thisMonthIncome,
    thisMonthExpense,
    thisMonthMilkLiters,
    thisMonthProfit,
    profitMarginPct,
    avgMilkPerDay,
    incVar,
    expVar,
    prfVar,
    monthlyMilkTotal,
    monthlySaleTotal,
    monthlyOtherIncome,
    topProducerName,
    topProducerQty,
    lowProducerName,
    lowProducerQty,
    activeMilkingCount,
    heifersCount,
    calvesCount,
    totalHeadCount,
    calvesBornThisMonth,
    cowsAcquiredThisMonth,
    daily30DayMilk,
    trend3Months,
    upcomingCalvingsList,
    postCalvingHeatAlerts,
    returnHeatAlerts,
    activeSickLogs,
    activeAttentionCount,
  } = dashboardData;

  /*
   * ---------------------------------------------------------
   * DYNAMIC CHART SCALES
   * ---------------------------------------------------------
   */
  const milkChartValues = Object.values(daily30DayMilk);

  const milkChartMaxRaw = Math.max(
    ...milkChartValues,
    0
  );

  const milkChartMax =
    Math.max(
      Math.ceil(milkChartMaxRaw / 10) * 10,
      10
    );

  const profitChartValues = Object.values(
    trend3Months
  ).map((item) => item.income - item.expense);

  const profitChartMaxRaw = Math.max(
    ...profitChartValues,
    0
  );

  const profitChartMax =
    Math.max(
      Math.ceil(profitChartMaxRaw / 10000) * 10000,
      10000
    );

  const attentionText =
    activeAttentionCount === 0
      ? 'Farm looks clear'
      : `${activeAttentionCount} item${
          activeAttentionCount === 1 ? '' : 's'
        } need attention`;

  const formattedToday = new Date(
    Number(todayStr.slice(0, 4)),
    Number(todayStr.slice(5, 7)) - 1,
    Number(todayStr.slice(8, 10))
  ).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="dashboard-viewport-wrapper">

      {/* =====================================================
          FARM TODAY HERO
      ====================================================== */}
      <section className="dashboard-today-hero">

        <div className="dashboard-hero-copy">
          <span className="dashboard-eyebrow">
            FARM DASHBOARD
          </span>

          <h1>Today on the farm.</h1>

          <p>{formattedToday}</p>
        </div>

        <div
          className={`dashboard-attention-pill ${
            activeAttentionCount > 0
              ? 'attention-active'
              : 'attention-clear'
          }`}
        >
          <span className="attention-dot" />
          {attentionText}
        </div>

      </section>


      {/* =====================================================
          TODAY'S QUICK NUMBERS
      ====================================================== */}
      <section className="dashboard-today-grid">

        <div className="today-stat-card milk-stat-card">
          <div className="today-stat-icon e">🥛</div>

          <div>
            <span>Today's Milk</span>
            <strong>{todayMilkLiters} L</strong>
          </div>

          <small>
            Current day's production
          </small>
        </div>


        <div className="today-stat-card herd-stat-card">
          <div className="today-stat-icon e">🐄</div>

          <div>
            <span>Active Herd</span>
            <strong>{totalHeadCount}</strong>
          </div>

          <small>
            {activeMilkingCount} currently milking
          </small>
        </div>


        <div className="today-stat-card profit-stat-card">
          <div className="today-stat-icon e">💰</div>

          <div>
            <span>Monthly Net</span>
            <strong>
              KSh {thisMonthProfit.toLocaleString()}
            </strong>
          </div>

          <small>
            {profitMarginPct}% profit margin
          </small>
        </div>


        <div className="today-stat-card attention-stat-card">
          <div className="today-stat-icon e">🔔</div>

          <div>
            <span>Attention</span>
            <strong>{activeAttentionCount}</strong>
          </div>

          <small>
            Active dashboard alerts
          </small>
        </div>

      </section>


      {/* =====================================================
          PERFORMANCE SUMMARY
      ====================================================== */}
      <section className="dashboard-card-box">

        <div className="section-heading-row">
          <div>
            <span className="section-kicker">
              PERFORMANCE
            </span>

            <h2>This Month</h2>
          </div>

          <span className="section-date-label">
            Compared with last month
          </span>
        </div>


        <div className="performance-grid">

          <div className="performance-item">
            <span>Milk Production</span>
            <strong>
              {thisMonthMilkLiters.toLocaleString()} L
            </strong>

            <small>
              {avgMilkPerDay} L/day average
            </small>
          </div>


          <div className="performance-item">
            <span>Income</span>
            <strong>
              KSh {thisMonthIncome.toLocaleString()}
            </strong>

            <small
              className={
                incVar >= 0
                  ? 'trend-positive'
                  : 'trend-negative'
              }
            >
              {incVar >= 0 ? '↑' : '↓'} {Math.abs(incVar)}%
            </small>
          </div>


          <div className="performance-item">
            <span>Expenses</span>
            <strong>
              KSh {thisMonthExpense.toLocaleString()}
            </strong>

            <small
              className={
                expVar <= 0
                  ? 'trend-positive'
                  : 'trend-negative'
              }
            >
              {expVar >= 0 ? '↑' : '↓'} {Math.abs(expVar)}%
            </small>
          </div>


          <div className="performance-item performance-highlight">
            <span>Net Profit</span>
            <strong>
              KSh {thisMonthProfit.toLocaleString()}
            </strong>

            <small
              className={
                prfVar >= 0
                  ? 'trend-positive'
                  : 'trend-negative'
              }
            >
              {prfVar >= 0 ? '↑' : '↓'} {Math.abs(prfVar)}%
            </small>
          </div>

        </div>

      </section>


      {/* =====================================================
          ATTENTION DESK
      ====================================================== */}
      <section className="dashboard-card-box attention-desk">

        <div className="section-heading-row">
          <div>
            <span className="section-kicker">
              TO WATCH
            </span>

            <h2>Things That Need Attention</h2>
          </div>
        </div>


        <div className="attention-grid">

          {/* Medical */}
          <div className="attention-panel attention-medical">

            <div className="attention-panel-header">
              <span className="attention-panel-icon e">🩺</span>

              <div>
                <h3>Medical</h3>
                <span>
                  {activeSickLogs.length} active record
                  {activeSickLogs.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {activeSickLogs.length === 0 ? (
              <p className="attention-empty">
                No active medical or withdrawal alerts.
              </p>
            ) : (
              <div className="attention-mini-list">
                {activeSickLogs.slice(0, 3).map((log) => {
                  const treatmentDate = new Date(
                    log.treatmentDate
                  );

                  const withdrawalDays =
                    Number(log.withdrawalDays) || 0;

                  const releaseDate = new Date(
                    treatmentDate
                  );

                  releaseDate.setDate(
                    releaseDate.getDate() +
                      withdrawalDays
                  );

                  const todayNoHours = new Date();
                  todayNoHours.setHours(0, 0, 0, 0);

                  const remainingDays =
                    withdrawalDays > 0
                      ? Math.max(
                          Math.ceil(
                            (releaseDate -
                              todayNoHours) /
                              (1000 * 60 * 60 * 24)
                          ),
                          0
                        )
                      : 0;

                  return (
                    <div
                      key={log.id}
                      className="attention-mini-row"
                    >
                      <div>
                        <strong>
                          {log.cowName}
                        </strong>

                        <span>
                          {log.diagnosis ||
                            'Medical treatment'}
                        </span>
                      </div>

                      {remainingDays > 0 && (
                        <b className="danger-badge">
                          DUMP {remainingDays}d
                        </b>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>


          {/* Calving */}
          <div className="attention-panel attention-calving">

            <div className="attention-panel-header">
              <span className="attention-panel-icon e">🐮</span>

              <div>
                <h3>Upcoming Calving</h3>
                <span>
                  {upcomingCalvingsList.length} pregnancy
                  {upcomingCalvingsList.length === 1
                    ? ''
                    : 'ies'}
                </span>
              </div>
            </div>

            {upcomingCalvingsList.length === 0 ? (
              <p className="attention-empty">
                No upcoming calving dates recorded.
              </p>
            ) : (
              <div className="attention-mini-list">
                {upcomingCalvingsList
                  .slice(0, 3)
                  .map((pregnancy) => (
                    <div
                      key={pregnancy.id}
                      className="attention-mini-row"
                    >
                      <div>
                        <strong>
                          {pregnancy.cowName}
                        </strong>

                        <span>
                          Due{' '}
                          {formatDate(
                            pregnancy.expectedDueDate
                          )}
                        </span>
                      </div>

                      <span className="soft-badge">
                        {pregnancy.cowTag || '—'}
                      </span>
                    </div>
                  ))}
              </div>
            )}

          </div>


          {/* Return Heat */}
          <div className="attention-panel attention-heat">

            <div className="attention-panel-header">
              <span className="attention-panel-icon e">🔄</span>

              <div>
                <h3>Return Heat</h3>
                <span>
                  {returnHeatAlerts.length} cow
                  {returnHeatAlerts.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {returnHeatAlerts.length === 0 ? (
              <p className="attention-empty">
                No cows currently due for return-heat checks.
              </p>
            ) : (
              <div className="attention-mini-list">
                {returnHeatAlerts
                  .slice(0, 3)
                  .map((event) => (
                    <div
                      key={event.id}
                      className="attention-mini-row"
                    >
                      <div>
                        <strong>
                          {event.cowName}
                        </strong>

                        <span>
                          Check from{' '}
                          {formatDate(
                            event.returnWindowStart
                          )}
                        </span>
                      </div>

                      <span className="orange-badge">
                        CHECK
                      </span>
                    </div>
                  ))}
              </div>
            )}

          </div>


          {/* Post-calving heat */}
          <div className="attention-panel attention-post-calving">

            <div className="attention-panel-header">
              <span className="attention-panel-icon e">🔥</span>

              <div>
                <h3>Heat Detection</h3>
                <span>
                  {postCalvingHeatAlerts.length} cow
                  {postCalvingHeatAlerts.length === 1
                    ? ''
                    : 's'}
                </span>
              </div>
            </div>

            {postCalvingHeatAlerts.length === 0 ? (
              <p className="attention-empty">
                No cows currently inside the post-calving
                heat window.
              </p>
            ) : (
              <div className="attention-mini-list">
                {postCalvingHeatAlerts
                  .slice(0, 3)
                  .map((cow) => (
                    <div
                      key={cow.id}
                      className="attention-mini-row"
                    >
                      <div>
                        <strong>
                          {cow.name}
                        </strong>

                        <span>
                          Watch for heat signs
                        </span>
                      </div>

                      <span className="orange-badge">
                        45–60d
                      </span>
                    </div>
                  ))}
              </div>
            )}

          </div>

        </div>

      </section>


      {/* =====================================================
          MILK CHART
      ====================================================== */}
      <section className="dashboard-card-box">

        <div className="section-heading-row">
          <div>
            <span className="section-kicker">
              PRODUCTION
            </span>

            <h2>Milk Yield — Last 30 Days</h2>
          </div>

          <span className="chart-summary">
            Today: {todayMilkLiters} L
          </span>
        </div>

        <div className="chart-wrapper-frame">

          <div className="svg-chart-container-with-y-axis">

            <div className="y-axis-labels-gutter-column">
              <span>{milkChartMax}L</span>
              <span>
                {Math.round(milkChartMax * 0.75)}L
              </span>
              <span>
                {Math.round(milkChartMax * 0.5)}L
              </span>
              <span>
                {Math.round(milkChartMax * 0.25)}L
              </span>
              <span>0L</span>
            </div>


            <div className="svg-canvas-viewport-window">

              <svg
                viewBox="0 0 500 150"
                className="svg-chart-canvas"
                preserveAspectRatio="none"
              >

                <defs>
                  <linearGradient
                    id="milkAreaGradient"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor="#2ecc71"
                      stopOpacity="0.25"
                    />

                    <stop
                      offset="100%"
                      stopColor="#2ecc71"
                      stopOpacity="0.02"
                    />
                  </linearGradient>
                </defs>


                <line
                  x1="0"
                  y1="10"
                  x2="500"
                  y2="10"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="42.5"
                  x2="500"
                  y2="42.5"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="75"
                  x2="500"
                  y2="75"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="107.5"
                  x2="500"
                  y2="107.5"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="140"
                  x2="500"
                  y2="140"
                  className="grid-line baseline"
                />


                {(() => {
                  const dataSlice =
                    Object.keys(daily30DayMilk).slice(-7);

                  const points = dataSlice.map(
                    (dateKey, index) => {
                      const liters =
                        daily30DayMilk[dateKey];

                      const x =
                        index *
                        (500 /
                          (dataSlice.length - 1 || 1));

                      const y =
                        140 -
                        Math.min(
                          liters *
                            (130 / milkChartMax),
                          130
                        );

                      return {
                        x,
                        y,
                        liters,
                        dateKey,
                      };
                    }
                  );

                  let curve = '';

                  if (points.length > 0) {
                    curve = `M ${points[0].x} ${points[0].y}`;

                    for (
                      let i = 0;
                      i < points.length - 1;
                      i++
                    ) {
                      const current =
                        points[i];

                      const next =
                        points[i + 1];

                      const middleX =
                        current.x +
                        (next.x -
                          current.x) /
                          2;

                      curve +=
                        ` C ${middleX} ${current.y}, ` +
                        `${middleX} ${next.y}, ` +
                        `${next.x} ${next.y}`;
                    }
                  }

                  const area =
                    curve && points.length
                      ? `${curve} L ${
                          points[
                            points.length - 1
                          ].x
                        } 140 L ${
                          points[0].x
                        } 140 Z`
                      : '';

                  return (
                    <>
                      {area && (
                        <path
                          d={area}
                          className="svg-area-fill"
                          fill="url(#milkAreaGradient)"
                        />
                      )}

                      {curve && (
                        <path
                          d={curve}
                          className="svg-smooth-curve-line milk-line"
                        />
                      )}

                      {points.map((point) => (
                        <circle
                          key={point.dateKey}
                          cx={point.x}
                          cy={point.y}
                          r="4.5"
                          className="marker-dot milk-dot"
                        />
                      ))}
                    </>
                  );
                })()}

              </svg>

            </div>

          </div>


          <div className="x-axis-dates-row-scale-deck milk-simple-axis">
            {Object.keys(daily30DayMilk)
              .slice(-7)
              .map((dateKey) => (
                <span key={dateKey}>
                  {dateKey.slice(5)}
                </span>
              ))}
          </div>

        </div>

      </section>


      {/* =====================================================
          PROFIT CHART
      ====================================================== */}
      <section className="dashboard-card-box">

        <div className="section-heading-row">
          <div>
            <span className="section-kicker">
              FINANCE
            </span>

            <h2>Net Profit — Last 3 Months</h2>
          </div>

          <span className="chart-summary">
            This month: KSh{' '}
            {thisMonthProfit.toLocaleString()}
          </span>
        </div>


        <div className="chart-wrapper-frame">

          <div className="svg-chart-container-with-y-axis">

            <div className="y-axis-labels-gutter-column">
              <span>
                {Math.round(
                  profitChartMax / 1000
                )}k
              </span>

              <span>
                {Math.round(
                  (profitChartMax * 0.75) /
                    1000
                )}k
              </span>

              <span>
                {Math.round(
                  (profitChartMax * 0.5) /
                    1000
                )}k
              </span>

              <span>
                {Math.round(
                  (profitChartMax * 0.25) /
                    1000
                )}k
              </span>

              <span>0</span>
            </div>


            <div className="svg-canvas-viewport-window">

              <svg
                viewBox="0 0 500 150"
                className="svg-chart-canvas"
                preserveAspectRatio="none"
              >

                <defs>
                  <linearGradient
                    id="profitAreaGradient"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop
                      offset="0%"
                      stopColor="#3498db"
                      stopOpacity="0.22"
                    />

                    <stop
                      offset="100%"
                      stopColor="#3498db"
                      stopOpacity="0.02"
                    />
                  </linearGradient>
                </defs>


                <line
                  x1="0"
                  y1="10"
                  x2="500"
                  y2="10"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="42.5"
                  x2="500"
                  y2="42.5"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="75"
                  x2="500"
                  y2="75"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="107.5"
                  x2="500"
                  y2="107.5"
                  className="grid-line"
                />

                <line
                  x1="0"
                  y1="140"
                  x2="500"
                  y2="140"
                  className="grid-line baseline"
                />


                {(() => {
                  const keys =
                    Object.keys(trend3Months);

                  const points = keys.map(
                    (key, index) => {
                      const info =
                        trend3Months[key];

                      const profit =
                        info.income -
                        info.expense;

                      const x =
                        index *
                        (500 /
                          (keys.length - 1 || 1));

                      const y =
                        140 -
                        Math.max(
                          0,
                          Math.min(
                            profit *
                              (130 /
                                profitChartMax),
                            130
                          )
                        );

                      return {
                        x,
                        y,
                        profit,
                        name: info.name,
                      };
                    }
                  );

                  let curve = '';

                  if (points.length > 0) {
                    curve = `M ${points[0].x} ${points[0].y}`;

                    for (
                      let i = 0;
                      i < points.length - 1;
                      i++
                    ) {
                      const current =
                        points[i];

                      const next =
                        points[i + 1];

                      const middleX =
                        current.x +
                        (next.x -
                          current.x) /
                          2;

                      curve +=
                        ` C ${middleX} ${current.y}, ` +
                        `${middleX} ${next.y}, ` +
                        `${next.x} ${next.y}`;
                    }
                  }

                  const area =
                    curve && points.length
                      ? `${curve} L ${
                          points[
                            points.length - 1
                          ].x
                        } 140 L ${
                          points[0].x
                        } 140 Z`
                      : '';

                  return (
                    <>
                      {area && (
                        <path
                          d={area}
                          className="svg-area-fill"
                          fill="url(#profitAreaGradient)"
                        />
                      )}

                      {curve && (
                        <path
                          d={curve}
                          className="svg-smooth-curve-line profit-line"
                        />
                      )}

                      {points.map(
                        (point, index) => (
                          <g key={index}>
                            {point.profit > 0 && (
                              <text
                                x={point.x}
                                y={
                                  point.y - 12
                                }
                                className="marker-label-text active-data-bubble bold"
                              >
                                KSh{' '}
                                {Math.round(
                                  point.profit /
                                    1000
                                )}
                                k
                              </text>
                            )}

                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="5.5"
                              className="marker-dot profit-dot"
                            />
                          </g>
                        )
                      )}
                    </>
                  );
                })()}

              </svg>

            </div>

          </div>


          <div className="x-axis-dates-row-scale-deck monthly">
            {Object.keys(trend3Months).map(
              (key) => (
                <span key={key}>
                  {trend3Months[key].name}
                </span>
              )
            )}
          </div>

        </div>

      </section>


      {/* =====================================================
          HERD + FINANCIAL BREAKDOWN
      ====================================================== */}
      <section className="dashboard-card-box split-grid-card">

        <div className="split-panel">

          <div className="split-panel-heading">
            <span className="e">🐄</span>

            <div>
              <span className="section-kicker">
                HERD
              </span>

              <h2>
                {totalHeadCount} Active Animals
              </h2>
            </div>
          </div>


          <ul className="inventory-list-stack">

            <li>
              <span>Active Milking</span>
              <strong>
                {activeMilkingCount}
              </strong>
            </li>

            <li>
              <span>Heifers</span>
              <strong>
                {heifersCount}
              </strong>
            </li>

            <li>
              <span>Calves</span>
              <strong>
                {calvesCount}
              </strong>
            </li>

          </ul>

        </div>


        <div className="split-panel">

          <div className="split-panel-heading">
            <span className="e">💰</span>

            <div>
              <span className="section-kicker">
                MONEY
              </span>

              <h2>
                This Month
              </h2>
            </div>
          </div>


          <ul className="inventory-list-stack">

            <li className="text-red">
              <span>Total Expenses</span>

              <strong>
                -KSh{' '}
                {thisMonthExpense.toLocaleString()}
              </strong>
            </li>

            <li className="text-green">
              <span>Milk Sales</span>

              <strong>
                +KSh{' '}
                {monthlyMilkTotal.toLocaleString()}
              </strong>
            </li>

            <li className="text-green">
              <span>Livestock Sales</span>

              <strong>
                +KSh{' '}
                {monthlySaleTotal.toLocaleString()}
              </strong>
            </li>

            <li className="text-green">
              <span>Other Income</span>

              <strong>
                +KSh{' '}
                {monthlyOtherIncome.toLocaleString()}
              </strong>
            </li>

          </ul>

        </div>

      </section>


      {/* =====================================================
          PRODUCTION LEADERBOARD
      ====================================================== */}
      <section className="dashboard-card-box">

        <div className="section-heading-row">
          <div>
            <span className="section-kicker">
              HERD PERFORMANCE
            </span>

            <h2>Production Snapshot</h2>
          </div>
        </div>


        <div className="leaderboard-grid">

          <div className="leaderboard-card top-producer-card">

            <span className="leaderboard-icon e">
              🏆
            </span>

            <div>
              <span>Top Producer</span>

              <strong>
                {topProducerName}
              </strong>

              <small>
                {topProducerQty.toFixed(1)} L
                recorded
              </small>
            </div>

          </div>


          <div className="leaderboard-card low-producer-card">

            <span className="leaderboard-icon e">
              📊
            </span>

            <div>
              <span>Lowest Recorded</span>

              <strong>
                {lowProducerName}
              </strong>

              <small>
                {lowProducerQty.toFixed(1)} L
                recorded
              </small>
            </div>

          </div>


          <div className="leaderboard-card additions-card">

            <span className="leaderboard-icon e">
              🐮
            </span>

            <div>
              <span>New This Month</span>

              <strong>
                +{calvesBornThisMonth +
                  cowsAcquiredThisMonth}
              </strong>

              <small>
                {calvesBornThisMonth} calves •{' '}
                {cowsAcquiredThisMonth} other
              </small>
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          COMPACT CALVING LIST
      ====================================================== */}
      {/* <section className="dashboard-card-box secondary-alert-card">

        <div className="section-heading-row">
          <div>
            <span className="section-kicker">
              BREEDING
            </span>

            <h2>Upcoming Calving Watch</h2>
          </div>

          <span className="section-count-badge">
            {upcomingCalvingsList.length}
          </span>
        </div>


        {upcomingCalvingsList.length === 0 ? (
          <p className="clean-empty-label-notice">
            No upcoming calving dates recorded.
          </p>
        ) : (
          <div className="compact-list">

            {upcomingCalvingsList
              .slice(0, 5)
              .map((pregnancy) => (
                <div
                  key={pregnancy.id}
                  className="compact-list-row"
                >
                  <span className="compact-list-icon">
                    🔔
                  </span>

                  <div>
                    <strong>
                      {pregnancy.cowName}
                    </strong>

                    <span>
                      Due{' '}
                      {formatDate(
                        pregnancy.expectedDueDate
                      )}

                      {pregnancy.cowTag
                        ? ` • Tag ${pregnancy.cowTag}`
                        : ''}
                    </span>
                  </div>

                  {pregnancy.semenTag && (
                    <small>
                      Sire: {pregnancy.semenTag}
                    </small>
                  )}
                </div>
              ))}

          </div>
        )}

      </section> */}


      {/* =====================================================
          DASHBOARD FOOTER
      ====================================================== */}
      <div className="dashboard-footer-note">
        <span>
          Dairy Management by Kuitech Solutions
        </span>

        <span>
          Data is stored locally.
        </span>
      </div>

    </div>
  );
}

export default Dashboard;