export const IDENTITY_REVELATIONS = [
  { id: 'inconnu', level: 1, name: "L'INCONNU", text: '«Otro Inconnu... Sin nombre, recuerdos ni procedencia. Y, aun así, tu silencio me resulta familiar. Como si varias voluntades hubieran aprendido a respirar juntas.»' },
  { id: 'lin', level: 3, name: 'LIN', text: '«Lin... Qué curioso. La palabra vino sola. ¿Te recuerda a algo? No la tomes por tu nombre; quizá sea un recuerdo que ninguno de los dos vivió.»' },
  { id: 'lincon', level: 6, name: 'LINCON', text: '«Lincon. Otra vez en estos registros rotos. Tal vez alguien cercano a ti... o apenas un fragmento de otra vida. Los nombres suelen sobrevivir a sus dueños.»' },
  { id: 'nuconi', level: 10, name: 'LIN. NUCONI.', text: "«Lin. Nuconi... Al mover sus letras, casi oigo L'INCONNU. Queda un eco de más. ¿Un nombre escondido, o varias vidas cosidas por un deseo? No sabría decir de quién.»" },
] as const;

export type IdentityId = typeof IDENTITY_REVELATIONS[number]['id'];
export function normalizeIdentitySeen(value: unknown): IdentityId[] {
  if (!Array.isArray(value)) return [];
  return IDENTITY_REVELATIONS.filter(r => value.includes(r.id)).map(r => r.id);
}
export function nextIdentityRevelation(level: number, seen: readonly string[]) {
  return IDENTITY_REVELATIONS.find(r => level >= r.level && !seen.includes(r.id));
}