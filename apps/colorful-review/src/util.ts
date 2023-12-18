export const createDropDownOption = (value: {
  description: string,
  innerText: string
}, text: string): HTMLOptionElement => {
  const option = document.createElement('option');
  option.value = value.innerText;
  option.text = text;
  option.title = value.description || text;
  return option;
};

export const handleDropdownSelection = (eventDropdown: HTMLSelectElement, nodeElement: Element): void => {
  const selectedValue = eventDropdown?.value;
  // TODO make this more generic and query parent elements until it finds the textarea
  const textArea = nodeElement.parentElement?.parentElement?.parentElement?.querySelector('#note-body') as HTMLTextAreaElement || nodeElement.parentElement?.parentElement?.parentElement?.querySelector('#note_note') as HTMLTextAreaElement;
  const textArray = textArea?.value?.split('`$') || [];
  if (textArray.length && textArray[0].includes('colorbox')) {
    textArray[0] = selectedValue;
  } else {
    textArray.unshift(selectedValue);
  }
  textArea.value = textArray?.join('');
};
