const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { createProjectFs } = require('../shared/project-fs.cjs');

const store = createProjectFs(() => path.join(app.getPath('userData'), 'projects'));

function mediaExists(file) {
  if (!file || typeof file !== 'string') return false;
  if (/^(blob:|data:)/i.test(file)) return false;
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

module.exports = {
  dispatch: store.dispatch,
  mediaExists,
  root: store.root,
};
