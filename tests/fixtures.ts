export type ScoreRange = {
  hook: [number, number];
  overall: [number, number];
  retention: [number, number];
};

export type TestCase = {
  name: string;
  title: string;
  script: string;
  expected: ScoreRange;
};

export const testCases: TestCase[] = [
  {
    name: "Dog grave story",
    title: "The Dog That Refused to Leave the Grave",
    script: `This dog refused to leave his owner’s grave for six years.
Every morning, people saw him lying in the same spot, even during rain and freezing nights.
At first, workers tried to move him away, but he always came back before sunrise.
The strangest part was that nobody had trained him to do this.
He simply remembered where his owner was buried and stayed there until the day he died.`,
    expected: {
      hook: [70, 90],
      overall: [68, 88],
      retention: [20, 45],
    },
  },
  {
    name: "Coma language story",
    title: "The Man Who Woke Up Speaking Another Language",
    script: `A man woke up from a coma speaking a language he had never learned.
Before the accident, he only spoke English.
But when doctors asked him simple questions, he answered in fluent Spanish.
His family thought he was confused, but the words were real.
Even stranger, after a few days, the Spanish slowly disappeared, and his normal voice came back like nothing happened.`,
    expected: {
      hook: [75, 92],
      overall: [70, 90],
      retention: [20, 45],
    },
  },
  {
    name: "Village vanished story",
    title: "The Village That Vanished Overnight",
    script: `An entire village vanished overnight.
The next morning, every house was still standing, every table was still set, and even food was left untouched.
But not a single person was found.
Search teams checked the roads, the forest, and the nearby river.
To this day, nobody knows where they went.`,
    expected: {
      hook: [80, 95],
      overall: [70, 90],
      retention: [20, 45],
    },
  },
  {
    name: "Pacific Ocean weak factual script",
    title: "The Pacific Ocean Is the Largest Ocean on Earth",
    script: `The Pacific Ocean is the largest ocean on Earth.
It covers more area than any other ocean.
It is very deep and contains many islands.
Many countries are located around the Pacific Ocean.
It is an important part of the planet.`,
    expected: {
      hook: [25, 50],
      overall: [25, 55],
      retention: [45, 85],
    },
  },
  {
    name: "Startup losing money story",
    title: "The Startup That Lost $50,000 Every Month",
    script: `This startup was losing $50,000 every month.
The founders thought one more feature would save it.
But every launch made the losses worse.
Then they removed their biggest product and focused on one tiny problem.
Within 90 days, revenue finally passed expenses.`,
    expected: {
      hook: [75, 95],
      overall: [70, 90],
      retention: [20, 45],
    },
  },
  {
    name: "Generic motivation weak script",
    title: "Success Takes Hard Work",
    script: `Success is very important.
Many people want to become successful.
You need to work hard and stay focused.
Never give up on your dreams.
Anything is possible if you believe in yourself.`,
    expected: {
      hook: [15, 45],
      overall: [15, 50],
      retention: [50, 90],
    },
  },
];
