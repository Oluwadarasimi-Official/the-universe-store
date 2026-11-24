/* Blocks prohibited / age-restricted products from AI drafting and publishing.
   Keyword screening is a first line only: uncertain items are flagged for owner review. */
const BLOCKED: Array<[string, RegExp]> = [
  ["alcohol", /\b(alcohol|beer|wine|whisk(e)?y|vodka|gin|rum|brandy|liquor|champagne|cognac|tequila|schnapps)\b/i],
  ["tobacco / nicotine", /\b(tobacco|cigar(ette)?s?|nicotine|snus|shisha|hookah)\b/i],
  ["vaping", /\b(vape|vaping|e-?cig(arette)?|e-?liquid|vape pen)\b/i],
  ["drugs", /\b(cannabis|marijuana|weed|thc|cbd|kush|codeine|tramadol|cocaine|lsd|psilocybin)\b/i],
  ["weapons / ammunition", /\b(gun|pistol|rifle|shotgun|firearm|ammo|ammunition|bullet|taser|stun gun|machete|crossbow|knuckle ?duster)\b/i],
  ["explosives / fireworks", /\b(explosive|dynamite|grenade|firework|detonator)\b/i],
  ["gambling", /\b(gambling|casino|betting|sportsbet|slot machine|poker chips?)\b/i],
  ["adult products", /\b(sex toy|dildo|vibrator|adult toy|porn|erotic|aphrodisiac|lingerie for adults)\b/i],
  ["counterfeit", /\b(replica|counterfeit|fake (brand|designer)|first copy|master copy)\b/i],
  ["hazardous substances", /\b(pesticide|insecticide concentrate|mercury|cyanide|acid for|bleach concentrate)\b/i],
];
const UNCERTAIN = /\b(supplement|weight loss|slimming|enhancement|bleaching cream|skin lightening|herbal cure|knife|pepper spray|laser pointer|drone)\b/i;

export function screenProduct(text: string): { blocked: string[]; flagged: boolean } {
  const blocked = BLOCKED.filter(([, re]) => re.test(text)).map(([n]) => n);
  return { blocked, flagged: !blocked.length && UNCERTAIN.test(text) };
}
