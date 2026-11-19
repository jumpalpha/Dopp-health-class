/* exit_survey_data.js — the 20 Exit Survey questions (2026-11-19).
 * Used by exit_survey.html (students) and exit_survey_teacher.js (Teacher Dashboard tallies).
 * Answers are saved as letters A–D, so if you reword a choice, keep its meaning in the same slot. */
window.EXIT_SURVEY = {
  sections: [
    { title: '📚 The Class', from: 1, to: 11 },
    { title: '🧑‍🏫 Mr. Dopp', from: 12, to: 16 },
    { title: '🤖 AI & Learning', from: 17, to: 20 }
  ],
  questions: [
    { q: 'Overall, how would you rate WELL 255: Wellness Through Healthy Living?',
      c: ['Excellent — one of my best classes', 'Good — I liked it', 'Okay — it was fine', 'Poor — I did not like it'] },
    { q: 'What was your FAVORITE part of the class?',
      c: ['Games — the arcade, Coin Quest, Jeopardy and other class games', 'Projects — Weight Control Quest, Cost of Your Future, PSA video, family project',
          'My Wellness Sprite, Quest XP and badges', 'Discussions — Survey of the Day, Pick a Side, real-life stories'] },
    { q: 'What was the WORST part of the class for you?',
      c: ['Reading the chapters', 'Classwork — vocabulary and personal stories', 'Tests — Chapter, Unit and Final Exam', 'Projects and group work'] },
    { q: 'Which part of the class will help you most in real life?',
      c: ['Mental and emotional health, stress and coping (Ch. 1–5)', 'Relationships, family and handling conflict (Ch. 6–9)',
          'Nutrition, weight and fitness (Ch. 10–12)', 'Body systems, personal care, first aid and CPR'] },
    { q: 'Be honest: how much of the chapter reading did you actually do?',
      c: ['All or almost all of it', 'Most of it', 'I skimmed it', 'Very little of it'] },
    { q: 'How easy was doppsclass.com to use?',
      c: ['Very easy — I always knew what to do', 'Mostly easy', 'Confusing at times', 'Hard to use or find things'] },
    { q: 'How was the workload?',
      c: ['Too much', 'A little too much', 'Just right', 'Too easy'] },
    { q: 'Did this class change any of your actual habits (sleep, food, exercise, stress, relationships)?',
      c: ['Yes — I changed a lot', 'Yes — a few things', 'I thought about it but didn’t change much', 'No'] },
    { q: 'SUGGESTED CHANGE: What should Mr. Dopp do MORE of?',
      c: ['More games and competitions', 'More hands-on activities (CPR, labs, projects)', 'More class discussion and real-life examples', 'More class time to get work done'] },
    { q: 'SUGGESTED CHANGE: What should Mr. Dopp do LESS of?',
      c: ['Reading assignments', 'Vocabulary and Classwork', 'Tests and quizzes', 'Screen time — time on the website'] },
    { q: 'Would you recommend this class to a friend?',
      c: ['Definitely', 'Probably', 'Not sure', 'No'] },

    { q: 'Mr. Dopp explains things clearly.',
      c: ['Always', 'Usually', 'Sometimes', 'Rarely'] },
    { q: 'I felt respected and cared about by Mr. Dopp.',
      c: ['Very much', 'Mostly', 'A little', 'Not really'] },
    { q: 'I felt comfortable asking Mr. Dopp a question (in person or with Ask Mr. Dopp).',
      c: ['Very comfortable', 'Mostly comfortable', 'A little uncomfortable', 'Not comfortable'] },
    { q: 'What is Mr. Dopp’s BEST quality as a teacher?',
      c: ['He makes class fun', 'His real-life stories and experience', 'He is fair and organized', 'He truly cares about students'] },
    { q: 'What is ONE thing Mr. Dopp could do better?',
      c: ['Give clearer directions', 'Give grades and feedback faster', 'Teach more face-to-face, less on the computer', 'Mix up what we do each day'] },

    { q: 'How often did you use AI (ChatGPT, Gemini, Snapchat AI, etc.) for this class?',
      c: ['Never', 'Once or twice', 'Sometimes', 'A lot'] },
    { q: 'When AI was used for school work, what was it MOSTLY used for?',
      c: ['I didn’t use it', 'To explain things I didn’t understand', 'To quiz me or check my work after I did it', 'To do the work or answers for me'] },
    { q: 'Which is the BEST way for a student to use AI so they still actually learn?',
      c: ['Have AI quiz me on what I read', 'Ask AI to explain a topic in simpler words', 'Do the work myself first, then ask AI for feedback', 'Students shouldn’t use AI for school work at all'] },
    { q: 'How should Mr. Dopp handle AI in this class next trimester?',
      c: ['Teach us how to use AI as a study tutor', 'Allow AI for brainstorming only, not final answers', 'More in-class and handwritten work so AI can’t do it', 'Ban AI completely'] }
  ]
};
