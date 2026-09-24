import React, { useEffect, useMemo, useState } from 'react';
import './BreedingLog.css';

/*
  Breeding & AI module
  --------------------
  Storage used by this module:
    dairy_herd
    dairy_breeding_events
    dairy_pregnancies

  The breeding event log is the permanent reproductive record.
  dairy_pregnancies contains only the cow's current/active pregnancy.
*/

const HEAT_BLOCK_DAYS = 14;
const AI_RECOMMENDED_START_HOURS = 4;
const AI_RECOMMENDED_END_HOURS = 16;
const AI_LAST_ALLOWED_HOURS = 24;
const RETURN_HEAT_START_DAYS = 18;
const RETURN_HEAT_END_DAYS = 24;
const EARLIEST_PREGNANCY_CHECK_DAYS = 18; 
const DRY_OFF_DAYS = 60;

const EVENT_TYPES = [
  'Heat',
  'Insemination',
  'Pregnancy Check',
  'Dry-off',
  'Calving',
  'Return to Heat',
  'Pregnancy Correction',
];

const uid = (prefix = 'breeding') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const readStorage = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const pad = value => String(value).padStart(2, '0');

const toDateInput = date => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toTimeInput = date => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const todayString = () => toDateInput(new Date());

const dateTimeValue = (dateString, timeString = '00:00') => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = (timeString || '00:00').split(':').map(Number);

  const value = new Date(
    year,
    (month || 1) - 1,
    day || 1,
    hours || 0,
    minutes || 0,
    0,
    0
  );

  return Number.isNaN(value.getTime()) ? null : value;
};

const addDays = (dateString, days) => {
  const value = dateTimeValue(dateString);
  if (!value) return '';
  value.setDate(value.getDate() + days);
  return toDateInput(value);
};

const addHours = (dateString, timeString, hours) => {
  const value = dateTimeValue(dateString, timeString);
  if (!value) return null;
  value.setHours(value.getHours() + hours);
  return value;
};

const formatDate = dateString => {
  if (!dateString) return 'Not recorded';
  const value = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(value.getTime())) return 'Not recorded';
  return value.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (dateString, timeString) => {
  if (!dateString) return 'Not recorded';
  const value = dateTimeValue(dateString, timeString);
  if (!value) return formatDate(dateString);
  return value.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const hoursBetween = (startDate, startTime, endDate, endTime) => {
  const start = dateTimeValue(startDate, startTime);
  const end = dateTimeValue(endDate, endTime);
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
};

const daysBetween = (startDate, endDate) => {
  const start = dateTimeValue(startDate);
  const end = dateTimeValue(endDate);
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
};

const isArchived = cow =>
  String(cow?.status || '').toLowerCase().startsWith('archived');

const isFemaleCow = cow =>
  String(cow?.gender || '').toLowerCase() === 'female' &&
  !isArchived(cow) &&
  String(cow?.status || '').toLowerCase() !== 'calf';

const isPregnant = (cow, pregnancies) =>
  String(cow?.status || '').toLowerCase() === 'pregnant' ||
  String(cow?.status || '').toLowerCase() === 'dry' ||
  pregnancies.some(item => String(item.cowId) === String(cow?.id));

const isEligibleBreedingFemale = (cow, pregnancies) =>
  isFemaleCow(cow) && !isPregnant(cow, pregnancies);

const latestEventForCow = (events, cowId, eventType) =>
  [...events]
    .filter(
      event =>
        String(event.cowId) === String(cowId) &&
        (!eventType || event.eventType === eventType)
    )
    .sort((a, b) => {
      const aTime = dateTimeValue(a.eventDate, a.eventTime || '00:00')?.getTime() || 0;
      const bTime = dateTimeValue(b.eventDate, b.eventTime || '00:00')?.getTime() || 0;
      return bTime - aTime;
    })[0];

const getCowName = cow => cow?.name || cow?.tagNumber || 'Unnamed cow';

const eventMatchesSearch = (event, search) =>
  `${event.cowName || ''} ${event.cowTag || ''} ${event.eventType || ''} ${event.notes || ''}`
    .toLowerCase()
    .includes(search.toLowerCase());

function BreedingLog() {
  const [herd, setHerd] = useState([]);
  const [events, setEvents] = useState([]);
  const [pregnancies, setPregnancies] = useState([]);

  const [formType, setFormType] = useState('Heat');
  const [selectedCowId, setSelectedCowId] = useState('');

  const [eventDate, setEventDate] = useState(todayString());
  const [eventTime, setEventTime] = useState(toTimeInput(new Date()));

  const [heatSigns, setHeatSigns] = useState('');
  const [semenTag, setSemenTag] = useState('');
  const [vetName, setVetName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const [pregnancyResult, setPregnancyResult] = useState('Pregnant');
  const [pregnancyMethod, setPregnancyMethod] = useState('');
  const [pregnancyReason, setPregnancyReason] = useState('');

  const [calfTag, setCalfTag] = useState('');
  const [calfGender, setCalfGender] = useState('Female');
  const [calfOutcome, setCalfOutcome] = useState('Live');
  const [calfTags, setCalfTags] = useState('');
  const [calvingAssistance, setCalvingAssistance] = useState('Unassisted');

  const [historySearch, setHistorySearch] = useState('');
  const [historyType, setHistoryType] = useState('All');
  const [historyCowId, setHistoryCowId] = useState('All');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  const refresh = () => {
    setHerd(readStorage('dairy_herd'));
    setEvents(readStorage('dairy_breeding_events'));
    setPregnancies(readStorage('dairy_pregnancies'));
  };

  useEffect(() => {
    refresh();
  }, []);

  const heatEvents = useMemo(
    () => events.filter(event => event.eventType === 'Heat'),
    [events]
  );

  const aiEvents = useMemo(
    () => events.filter(event => event.eventType === 'Insemination'),
    [events]
  );

  const pendingAi = useMemo(
    () => aiEvents.filter(event => ['Pending', 'Uncertain'].includes(event.result)),
    [aiEvents]
  );

  const updateCow = (cowId, changes) => {
    const currentHerd = readStorage('dairy_herd');
    const updated = currentHerd.map(cow =>
      String(cow.id) === String(cowId) ? { ...cow, ...changes } : cow
    );
    writeStorage('dairy_herd', updated);
  };

  const addEvent = newEvent => {
    const current = readStorage('dairy_breeding_events');
    writeStorage('dairy_breeding_events', [newEvent, ...current]);
  };

  const getLatestHeat = cowId =>
    latestEventForCow(
      events.filter(event => event.eventType === 'Heat'),
      cowId,
      'Heat'
    );

  const getLatestPendingAi = cowId =>
    [...aiEvents]
      .filter(
        ai =>
          String(ai.cowId) === String(cowId) &&
          ['Pending', 'Uncertain'].includes(ai.result)
      )
      .sort(
        (a, b) =>
          (dateTimeValue(b.eventDate, b.eventTime || '00:00')?.getTime() || 0) -
          (dateTimeValue(a.eventDate, a.eventTime || '00:00')?.getTime() || 0)
      )[0];

  /*
    HEAT eligibility:
    - female
    - not calf
    - not archived
    - not pregnant/dry
    - no heat recorded in the previous 14 days
  */
  const heatCandidates = useMemo(() => {
    const today = todayString();

    return herd.filter(cow => {
      if (!isEligibleBreedingFemale(cow, pregnancies)) return false;

      const recentHeat = heatEvents.find(heat => {
        const age = daysBetween(heat.eventDate, today);
        return (
          String(heat.cowId) === String(cow.id) &&
          age !== null &&
          age >= 0 &&
          age < HEAT_BLOCK_DAYS
        );
      });

      return !recentHeat;
    });
  }, [herd, pregnancies, heatEvents]);

  /*
    AI eligibility:
    A heat observation can be entered historically.
    The AI form looks at the heat's actual date/time.
    The farmer may still record an AI for up to 24 hours after heat onset.
  */
  const aiCandidates = useMemo(() => {
    const now = new Date();

    return herd
      .filter(cow => isEligibleBreedingFemale(cow, pregnancies))
      .map(cow => {
        const heat = getLatestHeat(cow.id);
        if (!heat || heat.aiPerformed) return null;

        const heatStart = dateTimeValue(
          heat.eventDate,
          heat.eventTime || '00:00'
        );

        if (!heatStart) return null;

        const elapsed = (now.getTime() - heatStart.getTime()) / (1000 * 60 * 60);

        if (elapsed < 0 || elapsed >= AI_LAST_ALLOWED_HOURS) return null;

        return {
          ...cow,
          latestHeat: heat,
          elapsedHours: elapsed,
        };
      })
      .filter(Boolean);
  }, [herd, pregnancies, events]);

  /*
    Pregnancy check eligibility:
    - cow has an AI still awaiting a final result
    - at least 18 days have passed since AI
    - pregnancy check date itself cannot be before the 18-day point
  */
  const pregnancyCandidates = useMemo(() => {
    const today = todayString();

    return herd
      .filter(cow => isFemaleCow(cow))
      .map(cow => {
        const ai = getLatestPendingAi(cow.id);
        if (!ai) return null;

        const daysSinceAi = daysBetween(ai.eventDate, today);
        if (daysSinceAi === null || daysSinceAi < EARLIEST_PREGNANCY_CHECK_DAYS) {
          return null;
        }

        return { ...cow, pendingAi: ai, daysSinceAi };
      })
      .filter(Boolean);
  }, [herd, events, pregnancies]);

  /*
    Dry eligibility:
    Any pregnant cow can be dried. If there is no due date, the system cannot
    calculate a safe dry-off window, so it asks the farmer to record/repair
    the pregnancy due date rather than guessing.
  */
  const dryCandidates = useMemo(() => {
    const today = todayString();

    return herd
      .filter(cow => isFemaleCow(cow) && isPregnant(cow, pregnancies))
      .map(cow => {
        const pregnancy = pregnancies.find(
          item => String(item.cowId) === String(cow.id)
        );

        const dueDate =
          pregnancy?.expectedDueDate ||
          cow.calvingDate ||
          cow.expectedDueDate ||
          '';

        if (!dueDate) {
          return {
            ...cow,
            pregnancy,
            dueDate: '',
            dryOffReady: false,
            daysToDue: null,
          };
        }

        const daysToDue = daysBetween(today, dueDate);

        return {
          ...cow,
          pregnancy,
          dueDate,
          dryOffReady:
            daysToDue !== null &&
            daysToDue <= DRY_OFF_DAYS &&
            daysToDue >= 0 &&
            String(cow.status || '').toLowerCase() !== 'dry',
          daysToDue,
        };
      })
      .filter(cow => cow.dryOffReady);
  }, [herd, pregnancies]);

  /*
    Calving eligibility:
    Any pregnant cow may calve. Due date is informative, not a gate.
  */
  const calvingCandidates = useMemo(
    () =>
      herd.filter(cow => isFemaleCow(cow) && isPregnant(cow, pregnancies)),
    [herd, pregnancies]
  );

  const candidates = useMemo(() => {
    if (formType === 'Heat') return heatCandidates;
    if (formType === 'Insemination') return aiCandidates;
    if (formType === 'Pregnancy Check') return pregnancyCandidates;
    if (formType === 'Dry-off') return dryCandidates;
    return calvingCandidates;
  }, [
    formType,
    heatCandidates,
    aiCandidates,
    pregnancyCandidates,
    dryCandidates,
    calvingCandidates,
  ]);

  useEffect(() => {
    if (
      candidates.length &&
      !candidates.some(cow => String(cow.id) === String(selectedCowId))
    ) {
      setSelectedCowId(String(candidates[0].id));
    }

    if (!candidates.length) setSelectedCowId('');
  }, [candidates, selectedCowId]);

  const selectedCow = herd.find(
    cow => String(cow.id) === String(selectedCowId)
  );

  const selectedHeat =
    formType === 'Insemination' ? getLatestHeat(selectedCowId) : null;

  const selectedPendingAi =
    formType === 'Pregnancy Check'
      ? getLatestPendingAi(selectedCowId)
      : null;

  const selectedDry =
    formType === 'Dry-off'
      ? dryCandidates.find(cow => String(cow.id) === String(selectedCowId))
      : null;

  const selectedPregnancy =
    pregnancies.find(
      pregnancy => String(pregnancy.cowId) === String(selectedCowId)
    ) || null;

  const aiTiming = useMemo(() => {
    if (!selectedHeat) return null;

    const recommendedStart = addHours(
      selectedHeat.eventDate,
      selectedHeat.eventTime || '00:00',
      AI_RECOMMENDED_START_HOURS
    );

    const recommendedEnd = addHours(
      selectedHeat.eventDate,
      selectedHeat.eventTime || '00:00',
      AI_RECOMMENDED_END_HOURS
    );

    const lastAllowed = addHours(
      selectedHeat.eventDate,
      selectedHeat.eventTime || '00:00',
      AI_LAST_ALLOWED_HOURS
    );

    const chosenAiTime = dateTimeValue(eventDate, eventTime || '00:00');

    let state = 'waiting';

    if (chosenAiTime && recommendedStart && recommendedEnd && lastAllowed) {
      if (chosenAiTime < recommendedStart) state = 'early';
      else if (chosenAiTime <= recommendedEnd) state = 'recommended';
      else if (chosenAiTime <= lastAllowed) state = 'late';
      else state = 'expired';
    }

    return {
      recommendedStart,
      recommendedEnd,
      lastAllowed,
      state,
    };
  }, [selectedHeat, eventDate, eventTime]);

  const resetFormFields = () => {
    setHeatSigns('');
    setSemenTag('');
    setVetName('');
    setCost('');
    setNotes('');
    setPregnancyResult('Pregnant');
    setPregnancyMethod('');
    setPregnancyReason('');
    setCalfTag('');
    setCalfGender('Female');
    setCalfOutcome('Live');
    setCalfTags('');
    setCalvingAssistance('Unassisted');
    setEventDate(todayString());
    setEventTime(toTimeInput(new Date()));
  };

  const changeFormType = type => {
    setFormType(type);
    setSuccessMessage('');
    setErrorMessage('');
    resetFormFields();
  };

  const validateDateTime = () => {
    const chosen = dateTimeValue(eventDate, eventTime || '00:00');
    if (!chosen) return 'Enter a valid date and time.';
    if (chosen.getTime() > Date.now()) {
      return 'Breeding events cannot be recorded in the future.';
    }
    return '';
  };

  const saveHeat = () => {
    if (!selectedCow) return 'Select a cow first.';

    const duplicate = heatEvents.some(heat => {
      if (String(heat.cowId) !== String(selectedCow.id)) return false;
      const age = daysBetween(heat.eventDate, eventDate);
      return age !== null && age >= 0 && age < HEAT_BLOCK_DAYS;
    });

    if (duplicate) {
      return 'This cow already has a heat observation within the previous 14 days.';
    }

    const pendingAi = getLatestPendingAi(selectedCow.id);
    let returnAi = null;

    if (pendingAi) {
      const elapsed = hoursBetween(
        pendingAi.eventDate,
        pendingAi.eventTime || '00:00',
        eventDate,
        eventTime || '00:00'
      );

      if (
        elapsed !== null &&
        elapsed >= RETURN_HEAT_START_DAYS * 24 &&
        elapsed <= RETURN_HEAT_END_DAYS * 24
      ) {
        returnAi = pendingAi;
      }
    }

    const newHeat = {
      id: uid('heat'),
      eventType: 'Heat',
      cowId: selectedCow.id,
      cowName: getCowName(selectedCow),
      cowTag: selectedCow.tagNumber || '',
      eventDate,
      eventTime: eventTime || '00:00',
      recordedAt: new Date().toISOString(),
      heatSigns: heatSigns.trim(),
      notes: notes.trim(),
      aiPerformed: false,
      aiEventId: null,
      possibleReturnAiId: returnAi?.id || null,
    };

    const currentEvents = readStorage('dairy_breeding_events');

    if (returnAi) {
      const updatedEvents = currentEvents.map(item =>
        String(item.id) === String(returnAi.id)
          ? {
              ...item,
              result: 'Return to Heat',
              returnHeatEventId: newHeat.id,
            }
          : item
      );

      const returnEvent = {
        id: uid('return-heat'),
        eventType: 'Return to Heat',
        cowId: selectedCow.id,
        cowName: getCowName(selectedCow),
        cowTag: selectedCow.tagNumber || '',
        eventDate,
        eventTime: eventTime || '00:00',
        recordedAt: new Date().toISOString(),
        aiEventId: returnAi.id,
        notes:
          notes.trim() ||
          'Heat recorded during the expected 18–24 day return-to-heat window.',
      };

      writeStorage('dairy_breeding_events', [
        newHeat,
        returnEvent,
        ...updatedEvents,
      ]);
    } else {
      writeStorage('dairy_breeding_events', [newHeat, ...currentEvents]);
    }

    updateCow(selectedCow.id, { status: 'Milking' });

    return '';
  };

  const saveAi = () => {
    if (!selectedCow || !selectedHeat) {
      return 'Record a heat observation before insemination.';
    }

    const chosenHours = hoursBetween(
      selectedHeat.eventDate,
      selectedHeat.eventTime || '00:00',
      eventDate,
      eventTime || '00:00'
    );

    if (chosenHours === null) return 'The heat and AI date/time could not be calculated.';
    if (chosenHours < 0) {
      return 'The AI cannot be recorded before the recorded heat observation.';
    }

    if (chosenHours >= AI_LAST_ALLOWED_HOURS) {
      return 'The 24-hour AI recording window has passed. This cow is no longer available for insemination.';
    }

    const priorServices = aiEvents.filter(
      item => String(item.cowId) === String(selectedCow.id)
    ).length;

    const aiId = uid('ai');

    const newAi = {
      id: aiId,
      eventType: 'Insemination',
      cowId: selectedCow.id,
      cowName: getCowName(selectedCow),
      cowTag: selectedCow.tagNumber || '',
      eventDate,
      eventTime: eventTime || '00:00',
      recordedAt: new Date().toISOString(),
      semenTag: semenTag.trim(),
      vetName: vetName.trim(),
      cost: Number(cost) || 0,
      notes: notes.trim(),
      heatEventId: selectedHeat.id,
      heatObservedAt: {
        date: selectedHeat.eventDate,
        time: selectedHeat.eventTime || '00:00',
      },
      serviceNumber: priorServices + 1,
      result: 'Pending',
      returnWindowStart: addDays(eventDate, RETURN_HEAT_START_DAYS),
      returnWindowEnd: addDays(eventDate, RETURN_HEAT_END_DAYS),
      returnWindowStartDateTime: addHours(
        eventDate,
        eventTime || '00:00',
        RETURN_HEAT_START_DAYS * 24
      )?.toISOString(),
      returnWindowEndDateTime: addHours(
        eventDate,
        eventTime || '00:00',
        RETURN_HEAT_END_DAYS * 24
      )?.toISOString(),
      failureReason: '',
      pregnancyCheckId: null,
    };

    const currentEvents = readStorage('dairy_breeding_events');
    const updatedEvents = currentEvents.map(item =>
      String(item.id) === String(selectedHeat.id)
        ? {
            ...item,
            aiPerformed: true,
            aiEventId: aiId,
          }
        : item
    );

    writeStorage('dairy_breeding_events', [newAi, ...updatedEvents]);

    // AI does not make a cow pregnant.
    updateCow(selectedCow.id, {
      status: selectedCow.status === 'Dry' ? 'Dry' : 'Milking',
    });

    return '';
  };

  const savePregnancyCheck = () => {
    if (!selectedCow || !selectedPendingAi) {
      return 'This cow does not have an AI awaiting pregnancy confirmation.';
    }

    const elapsedDays = daysBetween(selectedPendingAi.eventDate, eventDate);

    if (elapsedDays === null || elapsedDays < EARLIEST_PREGNANCY_CHECK_DAYS) {
      return `Pregnancy confirmation is not available until at least ${EARLIEST_PREGNANCY_CHECK_DAYS} days after the AI.`;
    }

    const checkId = uid('preg-check');
    const normalizedResult =
      pregnancyResult === 'Pregnant'
        ? 'Pregnant'
        : pregnancyResult === 'Not pregnant'
          ? 'Not Pregnant'
          : 'Uncertain';

    const newCheck = {
      id: checkId,
      eventType: 'Pregnancy Check',
      cowId: selectedCow.id,
      cowName: getCowName(selectedCow),
      cowTag: selectedCow.tagNumber || '',
      eventDate,
      eventTime: eventTime || '00:00',
      recordedAt: new Date().toISOString(),
      examinationDate: eventDate,
      examinationTime: eventTime || '00:00',
      aiEventId: selectedPendingAi.id,
      result: normalizedResult,
      pregnancyMethod: pregnancyMethod.trim(),
      vetName: vetName.trim(),
      notes: notes.trim(),
      assessmentReason: pregnancyReason.trim(),
      isCorrection: false,
    };

    const currentEvents = readStorage('dairy_breeding_events');

    let updatedEvents = currentEvents.map(item =>
      String(item.id) === String(selectedPendingAi.id)
        ? {
            ...item,
            result: normalizedResult,
            pregnancyCheckId: checkId,
          }
        : item
    );

    if (normalizedResult === 'Pregnant') {
      /*
        Approximate due date is calculated from AI/service date.
        This is deliberately not calculated from the pregnancy-check date.
        The farmer/vet can edit/repair the due date elsewhere if necessary.
      */
      const pregnancy = {
        id: uid('pregnancy'),
        cowId: selectedCow.id,
        cowName: getCowName(selectedCow),
        cowTag: selectedCow.tagNumber || '',
        source: 'AI',
        aiEventId: selectedPendingAi.id,
        inseminationDate: selectedPendingAi.eventDate,
        inseminationTime: selectedPendingAi.eventTime || '',
        semenTag: selectedPendingAi.semenTag || '',
        expectedDueDate:
          selectedPendingAi.expectedDueDate ||
          addDays(selectedPendingAi.eventDate, 283),
        pregnancyCheckDate: eventDate,
        pregnancyCheckTime: eventTime || '',
        pregnancyCheckId: checkId,
        pregnancyMethod: pregnancyMethod.trim(),
        isDry: false,
        dryDate: '',
        notes: notes.trim(),
      };

      const existing = readStorage('dairy_pregnancies');
      writeStorage('dairy_pregnancies', [
        pregnancy,
        ...existing.filter(
          item => String(item.cowId) !== String(selectedCow.id)
        ),
      ]);

      updateCow(selectedCow.id, {
        status: 'Pregnant',
        calvingDate: pregnancy.expectedDueDate,
        sireTag: selectedPendingAi.semenTag || selectedCow.sireTag || '',
      });
    } else if (normalizedResult === 'Not Pregnant') {
      const existing = readStorage('dairy_pregnancies');
      writeStorage(
        'dairy_pregnancies',
        existing.filter(item => String(item.cowId) !== String(selectedCow.id))
      );

      updateCow(selectedCow.id, {
        status: 'Milking',
        calvingDate: '',
      });
    }

    writeStorage('dairy_breeding_events', [newCheck, ...updatedEvents]);

    return '';
  };

  const saveDryOff = () => {
    if (!selectedCow || !selectedPregnancy) {
      return 'This cow does not have an active pregnancy record.';
    }

    const dueDate =
      selectedPregnancy.expectedDueDate ||
      selectedCow.calvingDate ||
      selectedCow.expectedDueDate;

    if (!dueDate) {
      return 'This pregnancy has no expected due date. Record the due date before marking the cow dry.';
    }

    const daysToDue = daysBetween(eventDate, dueDate);

    if (daysToDue === null || daysToDue < 0) {
      return 'The selected dry-off date is after the expected due date.';
    }

    if (daysToDue > DRY_OFF_DAYS) {
      return `This cow is not yet within the ${DRY_OFF_DAYS}-day dry-off window.`;
    }

    const dryEvent = {
      id: uid('dry'),
      eventType: 'Dry-off',
      cowId: selectedCow.id,
      cowName: getCowName(selectedCow),
      cowTag: selectedCow.tagNumber || '',
      eventDate,
      eventTime: eventTime || '00:00',
      recordedAt: new Date().toISOString(),
      expectedDueDate: dueDate,
      daysBeforeDue: Math.round(daysToDue),
      pregnancyId: selectedPregnancy.id,
      notes: notes.trim(),
    };

    const updatedPregnancy = {
      ...selectedPregnancy,
      isDry: true,
      dryDate: eventDate,
      dryEventId: dryEvent.id,
    };

    const currentPregnancies = readStorage('dairy_pregnancies');

    writeStorage(
      'dairy_pregnancies',
      currentPregnancies.map(item =>
        String(item.id) === String(selectedPregnancy.id)
          ? updatedPregnancy
          : item
      )
    );

    addEvent(dryEvent);

    updateCow(selectedCow.id, {
      status: 'Dry',
      calvingDate: dueDate,
    });

    return '';
  };

  const saveCalving = () => {
    if (!selectedCow || !selectedPregnancy) {
      return 'Select a pregnant cow to record calving.';
    }

    const enteredTags = calfTags
      .split(',')
      .map(value => value.trim().toUpperCase())
      .filter(Boolean);

    const tags = enteredTags.length
      ? enteredTags
      : calfTag.trim()
        ? [calfTag.trim().toUpperCase()]
        : [];

    if (!tags.length) {
      return 'Enter at least one calf tag ID.';
    }

    const currentHerd = readStorage('dairy_herd');
    const currentPregnancies = readStorage('dairy_pregnancies');

    const newCalves = tags.map((tag, index) => {
      const isLive = calfOutcome === 'Live';

      return {
        id: uid('calf'),
        tagNumber: tag,
        name:
          tags.length === 1
            ? `${getCowName(selectedCow)}'s calf`
            : `${getCowName(selectedCow)}'s calf ${index + 1}`,
        breed: selectedCow.breed || '',
        dob: eventDate,
        birthTime: eventTime || '',
        gender: calfGender,
        status: isLive ? 'Calf' : 'Archived',
        archiveReason: isLive ? '' : 'Died - Stillborn',
        deathDate: isLive ? '' : eventDate,
        sireTag: selectedCow.sireTag || selectedPregnancy.semenTag || 'Unknown',
        damTag: selectedCow.tagNumber || '',
        parentageLocked: true,
        notes: notes.trim(),
      };
    });

    const calvingEvent = {
      id: uid('calving'),
      eventType: 'Calving',
      cowId: selectedCow.id,
      cowName: getCowName(selectedCow),
      cowTag: selectedCow.tagNumber || '',
      eventDate,
      eventTime: eventTime || '00:00',
      recordedAt: new Date().toISOString(),
      pregnancyId: selectedPregnancy.id,
      expectedDueDate: selectedPregnancy.expectedDueDate || selectedCow.calvingDate || '',
      calfCount: newCalves.length,
      calves: newCalves.map(calf => ({
        calfId: calf.id,
        calfTag: calf.tagNumber,
        gender: calf.gender,
        outcome: calf.status === 'Calf' ? 'Live' : 'Stillborn',
      })),
      assistance: calvingAssistance,
      notes: notes.trim(),
    };

    writeStorage('dairy_herd', [...currentHerd, ...newCalves]);

    writeStorage(
      'dairy_pregnancies',
      currentPregnancies.filter(
        item => String(item.cowId) !== String(selectedCow.id)
      )
    );

    addEvent(calvingEvent);

    updateCow(selectedCow.id, {
      status: 'Milking',
      calvingDate: '',
    });

    return '';
  };

  const handleSubmit = event => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const dateError = validateDateTime();
    if (dateError) {
      setErrorMessage(dateError);
      return;
    }

    let error = '';

    if (formType === 'Heat') error = saveHeat();
    else if (formType === 'Insemination') error = saveAi();
    else if (formType === 'Pregnancy Check') error = savePregnancyCheck();
    else if (formType === 'Dry-off') error = saveDryOff();
    else if (formType === 'Calving') error = saveCalving();

    if (error) {
      setErrorMessage(error);
      return;
    }

    const cowName = selectedCow ? getCowName(selectedCow) : 'cow';
    setSuccessMessage(`${formType} recorded for ${cowName}.`);
    resetFormFields();
    refresh();
  };

  /*
    Pregnancy corrections:
    The original check stays in the historical record.
    A correction is another event and the active pregnancy/AI state is updated.
  */
  const createPregnancyCorrection = (pregnancyCheck, correctedResult, reason) => {
    if (!pregnancyCheck) return;

    const cow = herd.find(
      item => String(item.id) === String(pregnancyCheck.cowId)
    );

    if (!cow) return;

    const correction = {
      id: uid('preg-correction'),
      eventType: 'Pregnancy Correction',
      cowId: cow.id,
      cowName: getCowName(cow),
      cowTag: cow.tagNumber || '',
      eventDate: todayString(),
      eventTime: toTimeInput(new Date()),
      recordedAt: new Date().toISOString(),
      originalPregnancyCheckId: pregnancyCheck.id,
      originalResult: pregnancyCheck.result,
      correctedResult,
      reason: reason || 'Previous assessment corrected.',
    };

    const currentEvents = readStorage('dairy_breeding_events');
    const updatedEvents = currentEvents.map(item =>
      String(item.id) === String(pregnancyCheck.id)
        ? {
            ...item,
            corrected: true,
            correctedByEventId: correction.id,
          }
        : item
    );

    writeStorage('dairy_breeding_events', [correction, ...updatedEvents]);

    const currentPregnancies = readStorage('dairy_pregnancies');

    if (correctedResult === 'Pregnant') {
      const ai = aiEvents.find(
        item => String(item.id) === String(pregnancyCheck.aiEventId)
      );

      const pregnancy = {
        id: uid('pregnancy'),
        cowId: cow.id,
        cowName: getCowName(cow),
        cowTag: cow.tagNumber || '',
        source: 'AI',
        aiEventId: ai?.id || null,
        inseminationDate: ai?.eventDate || '',
        inseminationTime: ai?.eventTime || '',
        semenTag: ai?.semenTag || '',
        expectedDueDate: ai?.expectedDueDate || addDays(ai?.eventDate, 283),
        pregnancyCheckDate: todayString(),
        pregnancyCheckId: correction.id,
        pregnancyMethod: '',
        isDry: false,
        dryDate: '',
        notes: `Corrected from ${pregnancyCheck.result}. ${correction.reason}`,
      };

      writeStorage('dairy_pregnancies', [
        pregnancy,
        ...currentPregnancies.filter(
          item => String(item.cowId) !== String(cow.id)
        ),
      ]);

      if (ai) {
        const updated = readStorage('dairy_breeding_events').map(item =>
          String(item.id) === String(ai.id)
            ? { ...item, result: 'Pregnant', pregnancyCheckId: correction.id }
            : item
        );
        writeStorage('dairy_breeding_events', updated);
      }

      updateCow(cow.id, {
        status: 'Pregnant',
        calvingDate: pregnancy.expectedDueDate,
      });
    } else {
      writeStorage(
        'dairy_pregnancies',
        currentPregnancies.filter(item => String(item.cowId) !== String(cow.id))
      );

      if (pregnancyCheck.aiEventId) {
        const updated = readStorage('dairy_breeding_events').map(item =>
          String(item.id) === String(pregnancyCheck.aiEventId)
            ? { ...item, result: 'Not Pregnant', correctionEventId: correction.id }
            : item
        );
        writeStorage('dairy_breeding_events', updated);
      }

      updateCow(cow.id, {
        status: 'Milking',
        calvingDate: '',
      });
    }

    refresh();
    setSuccessMessage('Pregnancy assessment correction recorded without deleting the original record.');
  };

  const allHistory = useMemo(() => {
    return [...events].sort((a, b) => {
      const aTime =
        dateTimeValue(a.eventDate, a.eventTime || '00:00')?.getTime() || 0;
      const bTime =
        dateTimeValue(b.eventDate, b.eventTime || '00:00')?.getTime() || 0;
      return bTime - aTime;
    });
  }, [events]);

  const filteredHistory = allHistory.filter(event => {
    const typeMatches = historyType === 'All' || event.eventType === historyType;
    const cowMatches =
      historyCowId === 'All' || String(event.cowId) === String(historyCowId);
    return typeMatches && cowMatches && eventMatchesSearch(event, historySearch);
  });

  const selectedCowHistory = selectedCowId
    ? allHistory.filter(event => String(event.cowId) === String(selectedCowId))
    : [];

  const getAiForHeat = heat =>
    aiEvents.find(ai => String(ai.heatEventId) === String(heat.id));

  const getResultClass = result =>
    `result-badge result-${String(result || '')
      .toLowerCase()
      .replace(/[^a-z]+/g, '-')}`;

  const aiWindowLabel = timing => {
    if (!timing) return null;

    return {
      recommended: 'Recommended AI window',
      early: 'Too early for the recommended window',
      late: 'Recommended window has passed — AI still allowed',
      expired: '24-hour AI window has passed',
      waiting: 'Enter the AI date and time',
    }[timing.state];
  };

  return (
    <div className="breeding-dashboard">
      <header className="breeding-dashboard-header">
        <div>
          <p className="eyebrow">Reproductive record system</p>
          <h1>Breeding &amp; AI</h1>
        </div>

        <div className="breeding-header-date">
          Today
          <br />
          <strong>{formatDate(todayString())}</strong>
        </div>
      </header>

      <section className="breeding-workflow-strip">
        <p>
          Record the reproductive life of every cow from:
        </p>
        <div>
          <span>Heat</span>
          <span>→</span>
          <span>Insemination</span>
          <span>→</span>
          <span>Pregnancy check</span>
          <span>→</span>
          <span>Dry</span>
          <span>→</span>
          <span>Calving</span>
        </div>
      </section>

      <section className="breeding-dashboard-grid">
        <div className="breeding-card-box event-entry-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Record an event</p>
              <h2>Reproductive Event</h2>
            </div>
          </div>

          <div className="event-type-tabs">
            {['Heat', 'Insemination', 'Pregnancy Check', 'Dry-off', 'Calving'].map(
              type => (
                <button
                  type="button"
                  key={type}
                  className={formType === type ? 'active' : ''}
                  onClick={() => changeFormType(type)}
                >
                  {type}
                </button>
              )
            )}
          </div>

          {successMessage && (
            <div className="breeding-alert alert-success">{successMessage}</div>
          )}

          {errorMessage && (
            <div className="breeding-alert alert-danger">{errorMessage}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="breeding-row-grid">
              <label>
                Cow
                <select
                  value={selectedCowId}
                  onChange={event => setSelectedCowId(event.target.value)}
                  required
                >
                  <option value="">
                    {candidates.length ? 'Select cow' : 'No matching cows'}
                  </option>

                  {candidates.map(cow => (
                    <option key={cow.id} value={cow.id}>
                      {getCowName(cow)} · {cow.tagNumber || 'No tag'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Event date
                <input
                  type="date"
                  value={eventDate}
                  max={todayString()}
                  onChange={event => setEventDate(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="breeding-row-grid">
              <label>
                Event time
                <input
                  type="time"
                  value={eventTime}
                  onChange={event => setEventTime(event.target.value)}
                  required
                />
              </label>

              <div className="recorded-info">
                <span>Recorded in system</span>
                <strong>{formatDate(todayString())}</strong>
                <small>
                  The event date/time above is when it actually happened.
                </small>
              </div>
            </div>

            {formType === 'Heat' && (
              <>
                <label>
                  Heat signs
                  <textarea
                    value={heatSigns}
                    onChange={event => setHeatSigns(event.target.value)}
                    placeholder="Standing, mounting, restlessness, mucus, swollen vulva..."
                  />
                </label>
              </>
            )}

            {formType === 'Insemination' && (
              <>
                {selectedHeat && aiTiming && (
                  <div className={`ai-window-box ai-${aiTiming.state}`}>
                    <strong>{aiWindowLabel(aiTiming)}</strong>

                    <p>
                      Heat observed:{' '}
                      <b>
                        {formatDateTime(
                          selectedHeat.eventDate,
                          selectedHeat.eventTime
                        )}
                      </b>
                    </p>

                    <p>
                      Recommended:{' '}
                      <b>
                        {formatDateTime(
                          toDateInput(aiTiming.recommendedStart),
                          toTimeInput(aiTiming.recommendedStart)
                        )}{' '}
                        –{' '}
                        {formatDateTime(
                          toDateInput(aiTiming.recommendedEnd),
                          toTimeInput(aiTiming.recommendedEnd)
                        )}
                      </b>
                    </p>

                    <p>
                      Last allowed recording:{' '}
                      <b>
                        {formatDateTime(
                          toDateInput(aiTiming.lastAllowed),
                          toTimeInput(aiTiming.lastAllowed)
                        )}
                      </b>
                    </p>

                    {aiTiming.state === 'late' && (
                      <small>
                        The recommended window has passed, but this cow may
                        still be recorded as inseminated until 24 hours after
                        the recorded onset of heat.
                      </small>
                    )}

                    {aiTiming.state === 'early' && (
                      <small>
                        The selected AI time is earlier than the recommended
                        window. Check the heat observation time before saving.
                      </small>
                    )}
                  </div>
                )}

                <div className="breeding-row-grid">
                  <label>
                    Service number
                    <input
                      value={
                        selectedCow
                          ? aiEvents.filter(
                              item =>
                                String(item.cowId) === String(selectedCow.id)
                            ).length + 1
                          : ''
                      }
                      readOnly
                    />
                  </label>

                  <label>
                    Semen / bull ID
                    <input
                      value={semenTag}
                      onChange={event => setSemenTag(event.target.value)}
                      placeholder="BULL-23"
                    />
                  </label>
                </div>

                <div className="breeding-row-grid">
                  <label>
                    Technician / vet
                    <input
                      value={vetName}
                      onChange={event => setVetName(event.target.value)}
                      placeholder="Name"
                    />
                  </label>

                  <label>
                    AI cost (KES)
                    <input
                      type="number"
                      min="0"
                      value={cost}
                      onChange={event => setCost(event.target.value)}
                      placeholder="500"
                    />
                  </label>
                </div>

                <label>
                  Notes
                  <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="Optional notes about the insemination"
                  />
                </label>
              </>
            )}

            {formType === 'Pregnancy Check' && (
              <>
                {selectedPendingAi && (
                  <div className="context-box">
                    <strong>
                      AI #{selectedPendingAi.serviceNumber} —{' '}
                      {formatDate(selectedPendingAi.eventDate)}
                    </strong>
                    <span>
                      Pregnancy check is available from{' '}
                      {formatDate(
                        addDays(
                          selectedPendingAi.eventDate,
                          EARLIEST_PREGNANCY_CHECK_DAYS
                        )
                      )}
                    </span>
                  </div>
                )}

                <label>
                  Result
                  <select
                    value={pregnancyResult}
                    onChange={event => setPregnancyResult(event.target.value)}
                  >
                    <option>Pregnant</option>
                    <option>Not pregnant</option>
                    <option>Uncertain</option>
                  </select>
                </label>

                <label>
                  Confirmation method
                  <input
                    value={pregnancyMethod}
                    onChange={event => setPregnancyMethod(event.target.value)}
                    placeholder="Ultrasound, palpation, vet examination, not recorded..."
                  />
                </label>

                <label>
                  Why do you believe this result?
                  <textarea
                    value={pregnancyReason}
                    onChange={event => setPregnancyReason(event.target.value)}
                    placeholder="Describe what the farmer/vet observed or why the result was recorded."
                  />
                </label>

                <label>
                  Vet / technician
                  <input
                    value={vetName}
                    onChange={event => setVetName(event.target.value)}
                  />
                </label>

                <label>
                  Notes
                  <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="Additional examination notes"
                  />
                </label>

                <div className="form-hint">
                  A pregnancy result is a recorded assessment. The system does
                  not assume a cow is pregnant simply because she did not return
                  to heat.
                </div>
              </>
            )}

            {formType === 'Dry-off' && (
              <>
                {selectedDry && (
                  <div className="context-box">
                    <strong>
                      Expected due date: {formatDate(selectedDry.dueDate)}
                    </strong>
                    <span>
                      Approximately {selectedDry.daysToDue} days before due
                      date.
                    </span>
                  </div>
                )}

                <label>
                  Notes
                  <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="Reason or observations about drying off"
                  />
                </label>

                <div className="form-hint">
                  Dry-off keeps the active pregnancy. The cow's current herd
                  status becomes Dry.
                </div>
              </>
            )}

            {formType === 'Calving' && (
              <>
                <div className="context-box">
                  <strong>Pregnancy due date</strong>
                  <span>
                    {selectedPregnancy?.expectedDueDate
                      ? formatDate(selectedPregnancy.expectedDueDate)
                      : 'Not recorded'}
                  </span>
                  <small>
                    A cow can be recorded as calving even if the actual date is
                    earlier or later than the estimated due date.
                  </small>
                </div>

                <div className="breeding-row-grid">
                  <label>
                    Calf tag(s)
                    <input
                      value={calfTags || calfTag}
                      onChange={event => {
                        setCalfTags(event.target.value);
                        setCalfTag('');
                      }}
                      placeholder="CALF-001, CALF-002 for twins"
                    />
                    <small>Separate multiple calf tags with commas.</small>
                  </label>

                  <label>
                    Calf sex
                    <select
                      value={calfGender}
                      onChange={event => setCalfGender(event.target.value)}
                    >
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </label>
                </div>

                <div className="breeding-row-grid">
                  <label>
                    Calf outcome
                    <select
                      value={calfOutcome}
                      onChange={event => setCalfOutcome(event.target.value)}
                    >
                      <option value="Live">Live</option>
                      <option value="Stillborn">Stillborn</option>
                    </select>
                  </label>

                  <label>
                    Calving assistance
                    <select
                      value={calvingAssistance}
                      onChange={event =>
                        setCalvingAssistance(event.target.value)
                      }
                    >
                      <option>Unassisted</option>
                      <option>Assisted</option>
                      <option>Caesarean section</option>
                      <option>Unknown</option>
                    </select>
                  </label>
                </div>

                <label>
                  Notes
                  <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    placeholder="Birth notes, complications, observations..."
                  />
                </label>

                <div className="form-hint">
                  Live calves enter the herd with status <b>Calf</b>.
                  Stillborn calves enter the herd archive as <b>Died -
                  Stillborn</b>.
                </div>
              </>
            )}

            <button
              className="commit-breeding-btn"
              type="submit"
              disabled={!candidates.length}
            >
              Save {formType}
            </button>
          </form>
        </div>
      </section>

      {selectedCowId && (
        <section className="breeding-card-box cow-timeline-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cow timeline</p>
              <h2>
                {selectedCow ? getCowName(selectedCow) : 'Selected cow'}
              </h2>
              <p>
                Full reproductive timeline for this animal.
              </p>
            </div>
          </div>

          {selectedCowHistory.length === 0 ? (
            <p className="empty-sub-notice">
              No reproductive events have been recorded for this cow yet.
            </p>
          ) : (
            <div className="reproductive-timeline">
              {selectedCowHistory.map(record => (
                <div className="timeline-event" key={record.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-heading">
                      <strong>{record.eventType}</strong>
                      <span>
                        {formatDate(record.eventDate)} ·{' '}
                        {record.eventTime || 'time not recorded'}
                      </span>
                    </div>

                    {record.eventType === 'Insemination' && (
                      <p>
                        AI #{record.serviceNumber} ·{' '}
                        {record.semenTag || 'Semen not recorded'} · KES{' '}
                        {(Number(record.cost) || 0).toLocaleString()} ·{' '}
                        {record.result || 'Pending'}
                      </p>
                    )}

                    {record.eventType === 'Pregnancy Check' && (
                      <p>
                        {record.result} ·{' '}
                        {record.pregnancyMethod || 'method not recorded'}
                        {record.assessmentReason
                          ? ` · ${record.assessmentReason}`
                          : ''}
                      </p>
                    )}

                    {record.eventType === 'Heat' && (
                      <p>
                        {record.heatSigns || 'Heat signs not recorded'}
                        {record.notes ? ` · ${record.notes}` : ''}
                      </p>
                    )}

                    {record.eventType === 'Dry-off' && (
                      <p>
                        Dry-off recorded. Expected due date:{' '}
                        {formatDate(record.expectedDueDate)}
                      </p>
                    )}

                    {record.eventType === 'Calving' && (
                      <p>
                        {record.calfCount} calf/calf(s) recorded.
                      </p>
                    )}

                    {record.eventType === 'Return to Heat' && (
                      <p>
                        Heat returned during the expected 18–24 day AI
                        follow-up window.
                      </p>
                    )}

                    {record.eventType === 'Pregnancy Correction' && (
                      <p>
                        Assessment corrected from {record.originalResult} to{' '}
                        {record.correctedResult}. Reason: {record.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="breeding-card-box reproductive-record-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Permanent history</p>
            <h2>Reproductive Record</h2>
            <p>
              Every reproductive event stays connected to the cow. Nothing is
              silently overwritten just because a later assessment changes.
            </p>
          </div>
          <span className="count-badge">{allHistory.length}</span>
        </div>

        <div className="history-controls">
          <input
            className="history-filter-input"
            value={historySearch}
            onChange={event => setHistorySearch(event.target.value)}
            placeholder="Search cow, tag, event or notes..."
          />

          <select
            value={historyCowId}
            onChange={event => setHistoryCowId(event.target.value)}
          >
            <option value="All">All cows</option>
            {herd
              .filter(cow => isFemaleCow(cow))
              .map(cow => (
                <option key={cow.id} value={cow.id}>
                  {getCowName(cow)} · {cow.tagNumber || 'No tag'}
                </option>
              ))}
          </select>

          <select
            value={historyType}
            onChange={event => setHistoryType(event.target.value)}
          >
            <option value="All">All event types</option>
            {EVENT_TYPES.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {historyCowId !== 'All' && (
          <div className="cow-history-summary">
            {(() => {
              const cow = herd.find(
                item => String(item.id) === String(historyCowId)
              );

              const cowHeats = heatEvents.filter(
                item => String(item.cowId) === String(historyCowId)
              );

              const cowAis = aiEvents.filter(
                item => String(item.cowId) === String(historyCowId)
              );

              const totalCost = cowAis.reduce(
                (sum, item) => sum + (Number(item.cost) || 0),
                0
              );

              return (
                <>
                  <div>
                    <span>Cow</span>
                    <strong>{getCowName(cow)}</strong>
                    <small>{cow?.tagNumber || 'No tag'}</small>
                  </div>
                  <div>
                    <span>Current status</span>
                    <strong>{cow?.status || 'Unknown'}</strong>
                  </div>
                  <div>
                    <span>Heat observations</span>
                    <strong>{cowHeats.length}</strong>
                  </div>
                  <div>
                    <span>AI services</span>
                    <strong>{cowAis.length}</strong>
                  </div>
                  <div>
                    <span>Total AI cost</span>
                    <strong>KES {totalCost.toLocaleString()}</strong>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <div className="table-scroll-frame">
          <table className="breeding-history-table reproductive-table">
            <thead>
              <tr>
                <th>Date / time</th>
                <th>Cow</th>
                <th>Event</th>
                <th>Details</th>
                <th>Result</th>
                <th>Links</th>
              </tr>
            </thead>

            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-table-cell">
                    No reproductive records match this search.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(record => {
                  const linkedAi = record.aiEventId
                    ? aiEvents.find(
                        ai => String(ai.id) === String(record.aiEventId)
                      )
                    : null;

                  const linkedHeat = record.heatEventId
                    ? heatEvents.find(
                        heat => String(heat.id) === String(record.heatEventId)
                      )
                    : null;

                  return (
                    <tr key={record.id}>
                      <td>
                        <strong>{formatDate(record.eventDate)}</strong>
                        <small>{record.eventTime || 'Time not recorded'}</small>
                      </td>

                      <td>
                        <strong>{record.cowName}</strong>
                        <small>{record.cowTag || 'No tag'}</small>
                      </td>

                      <td>
                        <span className="event-type-label">
                          {record.eventType}
                        </span>
                      </td>

                      <td>
                        {record.eventType === 'Heat' && (
                          <>
                            <strong>{record.heatSigns || 'Heat signs not recorded'}</strong>
                            <small>{record.notes || 'No notes'}</small>
                          </>
                        )}

                        {record.eventType === 'Insemination' && (
                          <>
                            <strong>
                              AI #{record.serviceNumber} ·{' '}
                              {record.semenTag || 'Semen not recorded'}
                            </strong>
                            <small>
                              Cost: KES {(Number(record.cost) || 0).toLocaleString()}
                            </small>
                          </>
                        )}

                        {record.eventType === 'Pregnancy Check' && (
                          <>
                            <strong>
                              {record.pregnancyMethod || 'Method not recorded'}
                            </strong>
                            <small>
                              {record.assessmentReason || record.notes || 'No reason recorded'}
                            </small>
                          </>
                        )}

                        {record.eventType === 'Dry-off' && (
                          <>
                            <strong>Expected due: {formatDate(record.expectedDueDate)}</strong>
                            <small>
                              {record.daysBeforeDue} days before expected due date
                            </small>
                          </>
                        )}

                        {record.eventType === 'Calving' && (
                          <>
                            <strong>{record.calfCount} calf/calf(s)</strong>
                            <small>
                              {record.assistance || 'Assistance not recorded'}
                            </small>
                          </>
                        )}

                        {record.eventType === 'Return to Heat' && (
                          <small>
                            Recorded during the expected return-to-heat window.
                          </small>
                        )}

                        {record.eventType === 'Pregnancy Correction' && (
                          <>
                            <strong>
                              {record.originalResult} → {record.correctedResult}
                            </strong>
                            <small>{record.reason}</small>
                          </>
                        )}
                      </td>

                      <td>
                        {record.result ? (
                          <span className={getResultClass(record.result)}>
                            {record.result}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td>
                        {linkedAi && (
                          <small>
                            AI #{linkedAi.serviceNumber} ·{' '}
                            {formatDate(linkedAi.eventDate)}
                          </small>
                        )}

                        {linkedHeat && (
                          <small>
                            Heat · {formatDate(linkedHeat.eventDate)}
                          </small>
                        )}

                        {record.eventType === 'Pregnancy Check' &&
                          !record.corrected && (
                            <button
                              type="button"
                              className="table-action-button"
                              onClick={() => {
                                const correctionReason = window.prompt(
                                  'Why is this pregnancy assessment being corrected?'
                                );

                                if (!correctionReason) return;

                                const corrected =
                                  record.result === 'Pregnant'
                                    ? 'Not Pregnant'
                                    : 'Pregnant';

                                createPregnancyCorrection(
                                  record,
                                  corrected,
                                  correctionReason
                                );
                              }}
                            >
                              Correct
                            </button>
                          )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="breeding-card-box follow-up-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Action queue</p>
              <h2>What needs attention?</h2>
            </div>
          </div>

          <div className="follow-up-list">
            {pendingAi.length === 0 && (
              <p className="empty-sub-notice">
                No AI services are currently awaiting pregnancy follow-up.
              </p>
            )}

            {pendingAi.map(ai => {
              const cow = herd.find(
                item => String(item.id) === String(ai.cowId)
              );

              const today = todayString();
              const days = daysBetween(ai.eventDate, today);

              return (
                <button
                  type="button"
                  className="follow-up-row follow-up-button"
                  key={ai.id}
                  onClick={() => {
                    setFormType('Pregnancy Check');
                    setSelectedCowId(String(ai.cowId));
                    setEventDate(todayString());
                    setEventTime(toTimeInput(new Date()));
                  }}
                >
                  <div>
                    <strong>{getCowName(cow)}</strong>
                    <span>
                      AI #{ai.serviceNumber} · {formatDate(ai.eventDate)}
                    </span>
                    <small>
                      Return-to-heat watch:{' '}
                      {formatDate(ai.returnWindowStart)} –{' '}
                      {formatDate(ai.returnWindowEnd)}
                    </small>
                  </div>

                  <b
                    className={
                      days >= EARLIEST_PREGNANCY_CHECK_DAYS
                        ? 'due-badge'
                        : 'waiting-badge'
                    }
                  >
                    {days >= EARLIEST_PREGNANCY_CHECK_DAYS
                      ? 'Check available'
                      : 'Waiting'}
                  </b>
                </button>
              );
            })}
          </div>

          <div className="queue-divider" />

          <div className="queue-mini-grid">
            <div>
              <span>Heats awaiting AI</span>
              <strong>{aiCandidates.length}</strong>
            </div>
            <div>
              <span>Pregnancy checks available</span>
              <strong>{pregnancyCandidates.length}</strong>
            </div>
            <div>
              <span>Dry-off due</span>
              <strong>{dryCandidates.length}</strong>
            </div>
            <div>
              <span>Pregnant cows</span>
              <strong>{pregnancies.length}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BreedingLog;
