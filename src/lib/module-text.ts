const SEMESTER_4_SUFFIX = ' (SVM/SPM)';

export const formatSemesterLabel = (semester: number) =>
  semester === 4 ? `4${SEMESTER_4_SUFFIX}` : String(semester);

export const formatSemesterDisplay = (semester: number) => `Semester ${formatSemesterLabel(semester)}`;

export const buildModulePerkara = (baseModul: string, semester: number, tahun: number) => {
  const modul = baseModul.trim();
  return `${modul} SEMESTER ${formatSemesterLabel(semester)} (KOHORT ${tahun}) KOLEJ VOKASIONAL`;
};

export const buildSebutHargaTitle = (perkara: string) => {
  const modul = perkara.trim();
  return `SEBUTHARGA BAGI MEMBEKALKAN ${modul}`;
};

export const extractSemesterFromPerkara = (perkara: string): number | null => {
  const match = perkara.toUpperCase().match(/SEMESTER\s*([1-4])/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
};

export const extractSemesterLabelFromPerkara = (perkara: string) => {
  const semester = extractSemesterFromPerkara(perkara);
  return semester ? formatSemesterDisplay(semester) : '';
};
