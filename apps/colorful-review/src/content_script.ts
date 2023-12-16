import { createDropDownOption } from './util';
import { styleDropdown } from './stylesUtil';

let elementById = document.getElementById('user-profile-frame');
console.log('FROM CONTENT:', elementById);
if (elementById) {
  elementById.style.background = 'pink';
}

var dropdown = document.createElement('select');
const dropdownOptions = [
  { value: '1', text: 'Option 1' },
  { value: '2', text: 'Option 2' },
  { value: '3', text: 'Option 3' },
  { value: '4', text: 'Option 4' }
];

styleDropdown(dropdown);
dropdownOptions.forEach((optionItem) => {
  const option = createDropDownOption(optionItem.value, optionItem.text);
  dropdown.appendChild(option);
});

elementById?.appendChild(dropdown);
