const getBirthDate = (dob) => {
  if (typeof dob !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);

  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  return birthDate;
};

export const getCowAgeInMonths = (dob, today = new Date()) => {
  const birthDate = getBirthDate(dob);
  if (!birthDate) return 0;

  let ageInMonths =
    (today.getFullYear() - birthDate.getFullYear()) * 12 +
    today.getMonth() -
    birthDate.getMonth();

  if (today.getDate() < birthDate.getDate()) ageInMonths -= 1;
  return Math.max(0, ageInMonths);
};

export const formatCowAge = (dob, today = new Date()) => {
  const birthDate = getBirthDate(dob);
  if (!birthDate || birthDate > today) return 'Age unavailable';

  const daysOld = Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())) /
      86400000
  );

  const months = getCowAgeInMonths(dob, today);
  if (months > 0 && months < 12) return `${months} month${months === 1 ? '' : 's'} old`;

  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (!remainingMonths) return `${years} year${years === 1 ? '' : 's'} old`;

    return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'} old`;
  }

  if (daysOld < 7) return daysOld === 0 ? 'Newborn' : `${daysOld} day${daysOld === 1 ? '' : 's'} old`;
  const weeks = Math.floor(daysOld / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} old`;
};
