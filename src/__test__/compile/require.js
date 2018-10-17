const knownExternal = require('_mock_external_import_');
knownExternal();
const unknownRelative = require('./foo.js');
unknownRelative();
