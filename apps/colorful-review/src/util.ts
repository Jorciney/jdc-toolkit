export const createDropDownOption = (value: string, text: string, description?: string): HTMLOptionElement => {
  const option = document.createElement('option');
  option.value = value;
  option.text = text;
  return option;
};
