const knownExternal = require('cbor');
knownExternal();
const unknownRelative = require('./foo.js');
unknownRelative();
