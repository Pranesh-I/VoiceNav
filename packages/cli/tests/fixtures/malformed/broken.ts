// Deliberately malformed — this file cannot be parsed by Babel.
// Used to verify that parseFile() degrades gracefully and does not throw.

const x = {{{{{{{{{ this is not valid JavaScript or TypeScript at all
function ???() {
  return !!!@@@###;
}

export default <- broken;
