type GreetingPeriod = "Morning" | "Afternoon" | "Evening" | "Night";

export function greetingPeriod(date = new Date()): GreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

export function greetingLine(name: string, date = new Date()) {
  return `Good ${greetingPeriod(date)}, ${name}`;
}

export function territoryZoneLabel(territoryNames: string[]) {
  const names = territoryNames.filter(Boolean);
  if (names.length === 0) return "Unassigned Zone";
  if (names.length === 1) return `${names[0]} Zone`;
  return `${names[0]} +${names.length - 1} Zones`;
}
