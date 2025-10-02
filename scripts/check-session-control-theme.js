const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const targets = [
  'components/session/ActionButton.tsx',
  'components/session/OutputToggle.tsx',
  'components/session/KeyerButton.tsx',
  'components/session/ChallengeKeyboard.tsx',
  'components/session/LessonChoices.tsx',
];

const missing = targets.filter((relativePath) => {
  const filePath = path.join(projectRoot, relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  return !content.includes('sessionControlTheme');
});

if (missing.length > 0) {
  console.error('sessionControlTheme not referenced in:', missing.join(', '));
  process.exit(1);
}

console.log('Session control components reference sessionControlTheme.');
