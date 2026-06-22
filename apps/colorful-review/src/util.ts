export const createDropDownOption = (
  value: {
    description: string;
    innerText: string;
  },
  text: string
): HTMLOptionElement => {
  const option = document.createElement('option');
  option.value = value.innerText;
  option.text = text;
  option.title = value.description || text;
  return option;
};

// The decorations are raw KaTeX markdown (e.g. $`\colorbox{...}`$). GitLab's
// rich-text editor (tiptap/ProseMirror) escapes backslashes when it serializes
// to markdown, turning \colorbox into \\colorbox and breaking the math block.
// Only the plain-text/markdown textarea preserves the source verbatim, so we
// always insert there — switching the editor out of rich-text mode if needed.
// Only the visible <textarea> belongs to plain-text mode. Note that rich-text
// mode keeps a hidden <input id="note_note"> backing field, so we must match on
// the textarea tag and check visibility rather than the id alone.
const TEXTAREA_SELECTOR =
  'textarea.js-gfm-input, textarea.note-textarea, textarea#note_note, textarea#note-body';
// form.common-note-form survives the rich/plain-text editor mode switch.
const FORM_SELECTOR =
  'form.common-note-form, .js-discussion-note-form, form.js-main-target-form, form';
const SWITCHER_SELECTOR = '[data-testid="editing-mode-switcher"]';

export const handleDropdownSelection = (dropdown: HTMLSelectElement): void => {
  const selectedValue = dropdown.value;
  // Reset to the placeholder so the same decoration can be chosen again. Do this
  // up front because switching editor modes detaches the dropdown.
  dropdown.selectedIndex = 0;
  // The placeholder option has an empty value; nothing to insert.
  if (!selectedValue) {
    return;
  }

  const form = dropdown.closest(FORM_SELECTOR);
  if (!form) {
    return;
  }

  const textArea = findVisibleTextArea(form);
  if (textArea) {
    insertIntoTextArea(textArea, selectedValue);
    return;
  }

  // No textarea means the rich-text editor is active. Switch to plain text and
  // insert once the markdown textarea has mounted.
  const switcher = form.querySelector<HTMLElement>(SWITCHER_SELECTOR);
  if (switcher) {
    switcher.click();
    waitForTextArea(form, (ta) => insertIntoTextArea(ta, selectedValue));
  }
};

const insertIntoTextArea = (
  textArea: HTMLTextAreaElement,
  value: string
): void => {
  textArea.focus();
  const start = textArea.selectionStart ?? textArea.value.length;
  const end = textArea.selectionEnd ?? textArea.value.length;
  textArea.setRangeText(`${value} `, start, end, 'end');
  // Notify GitLab's Vue model that the value changed.
  textArea.dispatchEvent(new Event('input', { bubbles: true }));
};

const findVisibleTextArea = (root: Element): HTMLTextAreaElement | null => {
  const textAreas = Array.from(
    root.querySelectorAll<HTMLTextAreaElement>(TEXTAREA_SELECTOR)
  );
  return textAreas.find((textArea) => textArea.offsetParent !== null) ?? null;
};

const waitForTextArea = (
  root: Element,
  callback: (textArea: HTMLTextAreaElement) => void,
  attemptsLeft = 20
): void => {
  const textArea = findVisibleTextArea(root);
  if (textArea) {
    callback(textArea);
    return;
  }
  if (attemptsLeft <= 0) {
    return;
  }
  setTimeout(() => waitForTextArea(root, callback, attemptsLeft - 1), 50);
};
