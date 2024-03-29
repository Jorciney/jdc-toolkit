export const conventionalComments = {
  'Select an option': {
    innerText: '',
    description: 'Select an option',
  },
  Praise: {
    innerText:
      '$`\\colorbox{#02B532}{\\textcolor{#FFFFFF}{\\textsf{Praise:}}}`$',
    description:
      'Praises highlight something positive. Try to leave at least one of these comments per review. Do not leave false praise (which can actually be damaging). Do look for something to sincerely praise.',
  },
  Nitpick: {
    innerText:
      '$`\\colorbox{#866CA6}{\\textcolor{#FFFFFF}{\\textsf{Nitpick:}}}`$',
    description:
      'Nitpicks are trivial preference-based requests. These should be non-blocking by nature.',
  },
  Suggestion: {
    innerText:
      '$`\\colorbox{#17BD93}{\\textcolor{#FFFFFF}{\\textsf{Suggestion:}}}`$',
    description:
      "Suggestions propose improvements to the current subject. It's important to be explicit and clear on what is being suggested and why it is an improvement. Consider using patches and the blocking or non-blocking decorations to further communicate your intent.",
  },
  Issue: {
    innerText:
      '$`\\colorbox{#FF47B6}{\\textcolor{#FFFFFF}{\\textsf{Issue:}}}`$',
    description:
      'Issues highlight specific problems with the subject under review. These problems can be user-facing or behind the scenes. It is strongly recommended to pair this comment with a suggestion. If you are not sure if a problem exists or not, consider leaving a question.',
  },
  Improvement: {
    innerText:
      '$`\\colorbox{#0078FF}{\\textcolor{#FFFFFF}{\\textsf{Improvement:}}}`$',
    description:
      'Not a problem, but a potential improvement. This is a great way to suggest a better way of doing something. It is strongly recommended to pair this comment with a suggestion.',
  },
  Todo: {
    innerText: '$`\\colorbox{#0e739e}{\\textcolor{#FFFFFF}{\\textsf{Todo:}}}`$',
    description:
      "TODO's are small, trivial, but necessary changes. Distinguishing todo comments from issues: or suggestions: helps direct the reader's attention to comments requiring more involvement.",
  },
  Question: {
    innerText:
      '$`\\colorbox{#9E0E4A}{\\textcolor{#FFFFFF}{\\textsf{Question:}}}`$',
    description:
      "Questions are appropriate if you have a potential concern but are not quite sure if it's relevant or not. Asking the author for clarification or investigation can lead to a quick resolution.",
  },
  Thought: {
    innerText:
      '$`\\colorbox{#FDA14A}{\\textcolor{#FFFFFF}{\\textsf{Thought:}}}`$',
    description:
      'Thoughts represent an idea that popped up from reviewing. These comments are non-blocking by nature, but they are extremely valuable and can lead to more focused initiatives and mentoring opportunities.',
  },
  Chore: {
    innerText:
      '$`\\colorbox{#B2ADF0}{\\textcolor{#FFFFFF}{\\textsf{Chore:}}}`$',
    description:
      'Chores are simple tasks that must be done before the subject can be “officially” accepted. Usually, these comments reference some common process. Try to leave a link to the process description so that the reader knows how to resolve the chore.',
  },
  Note: {
    innerText: '$`\\colorbox{#594917}{\\textcolor{#FFFFFF}{\\textsf{Note:}}}`$',
    description:
      'Notes are always non-blocking and simply highlight something the reader should take note of.',
  },
  'Non-blocking': {
    innerText:
      '$`\\colorbox{gray}{\\textcolor{#FFFFFF}{\\textsf{Non-blocking:}}}`$',
    description:
      'A comment with this decoration should not prevent the subject under review from being accepted. This is helpful for organizations that consider comments blocking by default.',
  },
  Blocking: {
    innerText: '$`\\colorbox{red}{\\textcolor{#FFFFFF}{\\textsf{Blocking:}}}`$',
    description:
      'A comment with this decoration should prevent the subject under review from being accepted, until it is resolved. This is helpful for organizations that consider comments non-blocking by default.',
  },
  Minor: {
    innerText:
      '$`\\colorbox{#777777}{\\textcolor{#FFFFFF}{\\textsf{Minor:}}}`$',
    description:
      'This decoration gives some freedom to the author that they should resolve the comment only if the changes ends up being minor or trivial.',
  },
};
