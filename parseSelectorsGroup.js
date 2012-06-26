/*jslint regexp: true, vars: true, indent: 2 */

var parseSelectorsGroup = (function () {
  "use strict";

  var ident = /^\-?(?:[_a-z]|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])(?:[_a-z0-9\-]|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*/i;
  var cssString = /^(?:\"([^\n\r\f\\"]|\\(?:\n|\r\n|\r|\f)|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*\"|\'([^\n\r\f\\']|\\(?:\n|\r\n|\r|\f)|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*\')/i;
  var whitespace = /^[ \t\r\n\f]+/;

  function unescapeIdent(s) {
    return s.replace(/\\([0-9a-f]{1,6})(?:\r\n|[ \n\r\t\f])?|\\([^\n\r\f0-9a-f])/gi, function (a, b, c) {
      return b ? String.fromCharCode(parseInt(b, 16)) : c;
    });
  }

  function unescapeString(s) {
    return unescapeIdent(s.replace(/\\(\n|\r\n|\r|\f)/g, ''));
  }

  function parseTypeSelector(s) {
    var tmp = ident.exec(s);
    return tmp ? unescapeIdent(tmp[0]) : null;
  }

  function ltrim(s) {
    var tmp = whitespace.exec(s);
    return tmp ? s.slice(tmp[0].length) : s;
  }

  function parseClassSelector(s) {
    if (s.slice(0, 1) === '.') {
      s = s.slice(1);
      var tmp = ident.exec(s);
      return !tmp ? null : {
        rest: s.slice(tmp[0].length),
        data: unescapeIdent(tmp[0])
      };
    }
    return null;
  }

  function parseAttributeSelector(s) {
    if (s.slice(0, 1) !== '[') {
      return null;
    }
    s = s.slice(1);
    s = ltrim(s);
    var tmp = ident.exec(s);
    if (!tmp) {
      return null;
    }
    var result = {
      name: '',
      operator: '',
      value: ''
    };
    result.name = unescapeIdent(tmp[0]);
    s = s.slice(tmp[0].length);
    s = ltrim(s);
    tmp = (/^[\^\$\*~|]?\=/).exec(s);
    if (tmp) {
      result.operator = tmp[0];
      s = s.slice(tmp[0].length);
      s = ltrim(s);
      tmp = ident.exec(s);
      if (tmp) {
        result.value = unescapeIdent(tmp[0]);
        s = s.slice(tmp[0].length);
      } else {
        tmp = cssString.exec(s);
        if (!tmp) {
          return null;
        }
        result.value = unescapeString(tmp[0].slice(1, -1));
        s = s.slice(tmp[0].length);
      }
    }
    s = ltrim(s);
    if (s.slice(0, 1) !== ']') {
      return null;
    }
    s = s.slice(1);
    return {
      rest: s,
      data: result
    };
  }

  function parseNegation(s) {
    var x = /^\:(?:n|\\0{0,4}(4e|6e)(\r\n|[ \t\r\n\f])?|\\n)(?:o|\\0{0,4}(4f|6f)(\r\n|[ \t\r\n\f])?|\\o)(?:t|\\0{0,4}(54|74)(\r\n|[ \t\r\n\f])?|\\t)\(/i;
    var tmp = x.exec(s);
    if (!tmp) {
      return null;
    }
    s = s.slice(tmp[0].length);
    s = ltrim(s);
    var t = parseSimpleSelectorSequence(s, null);
    if (!t) {
      return null;
    }
    s = t.rest;
    s = ltrim(s);
    if (s.slice(0, 1) !== ')') {
      return null;
    }
    s = s.slice(1);
    return {
      rest: s,
      data: t.data
    };
  }

  function parseSimpleSelectorSequence(s, combinator) {
    var tmp = s === '*' ? '*' : parseTypeSelector(s);
    var result = {
      combinator: combinator,
      typeSelector: tmp || '*',
      classSelectors: [],
      attributeSelectors: [],
      negations: []
    };
    var wasSomething = !!tmp;
    if (tmp) {
      s = s.slice(tmp.length);
    }
    while (true) {
      tmp = parseClassSelector(s);
      if (!tmp) {
        tmp = parseAttributeSelector(s);
        if (!tmp) {
          tmp = parseNegation(s);
          if (!tmp) {
            break;
          } else {
            result.negations.push(tmp.data);
            s = tmp.rest;
          }
        } else {
          result.attributeSelectors.push(tmp.data);
          s = tmp.rest;
        }
      } else {
        result.classSelectors.push(tmp.data);
        s = tmp.rest;
      }
      wasSomething = true;
    }
    if (!wasSomething) {
      return null;
    }
    return {
      rest: s,
      data: result
    };
  }

  function parseSelector(s, firstCombinator, combinator1, combinator2, parseNext) {
    var tmp = parseNext(s, firstCombinator);
    if (!tmp) {
      return null;
    }
    var selectorSequences = [];
    s = tmp.rest;
    selectorSequences.push(tmp.data);
    while (s !== '') {
      var tmp2 = ltrim(s);
      var wasWhitespace = tmp2 !== s;
      tmp = tmp2.slice(0, 1);
      if (wasWhitespace && tmp !== '+' && tmp !== '>' && tmp !== '~') {
        tmp = ' ';
      }
      if (tmp !== combinator1 && tmp !== combinator2) {
        break;
      }
      s = tmp2;
      if (tmp !== ' ') {
        s = s.slice(1);
        s = ltrim(s);
      }
      tmp = parseNext(s, tmp);
      if (!tmp) {
        return null;
      }
      selectorSequences.push(tmp.data);
      s = tmp.rest;
    }
    return {
      rest: s,
      data: selectorSequences
    };
  }

  function parseSiblingsSelector(s, combinator) {
    var tmp = parseSelector(s, combinator, '+', '~', parseSimpleSelectorSequence);
    if (!tmp) {
      return null;
    }
    return {
      rest: tmp.rest,
      data: {
        combinator: combinator,
        simpleSelectorSequences: tmp.data
      }
    };
  }

  return function parseSelectorsGroup(s) {
    s = String(s);
    s = ltrim(s);
    var tmp = parseSelector(s, ' ', '>', ' ', parseSiblingsSelector);
    if (!tmp) {
      return null;
    }
    var result = [];
    result.push(tmp.data);
    s = tmp.rest;
    s = ltrim(s);
    while (s !== '') {
      if (s.slice(0, 1) !== ',') {
        return null;
      }
      s = s.slice(1);
      s = ltrim(s);
      tmp = parseSelector(s, ' ', '>', ' ', parseSiblingsSelector);
      if (!tmp) {
        return null;
      }
      result.push(tmp.data);
      s = tmp.rest;
      s = ltrim(s);
    }
    return result;
  };

}());

/*

console.log(JSON.stringify(parseSelectorsGroup('a[href^="ya.ru+ "] ~ b, a.test'), null, 2));
console.log(JSON.stringify(parseSelectorsGroup('.\\=\\][tes\\t]'), null, 2));
console.log(JSON.stringify(parseSelectorsGroup('h1, h2, ul > li, .things'), null, 2));

*/
